import mongoose from "mongoose";
import connectDB from "@/lib/db";
import { isStandaloneMongoTransactionError } from "@/lib/db/mongo-transaction-support";
import Withdrawal from "@/models/Withdrawal";
import User from "@/models/User";
import Wallet from "@/models/Wallet";
import Transaction from "@/models/Transaction";

function isDuplicateKeyError(err) {
  if (err?.code === 11000 || err?.cause?.code === 11000) return true;
  return /E11000 duplicate key/i.test(String(err?.message || ""));
}

async function healBalanceRefundedFlag(withdrawalId) {
  await Withdrawal.findByIdAndUpdate(withdrawalId, {
    $set: {
      "metadata.balanceRefunded": true,
      "metadata.balanceRefundedAt": new Date(),
    },
  });
}

/**
 * True if a refund ledger row exists for this withdrawal (unique index on type + metadata.withdrawalId).
 */
export async function withdrawalRefundTransactionExists(withdrawalId) {
  await connectDB();
  const tx = await Transaction.findOne({
    type: "refund",
    "metadata.withdrawalId": withdrawalId,
  })
    .select("_id")
    .lean();
  return Boolean(tx);
}

/**
 * Credits wallet and writes a refund transaction once per withdrawal (idempotent).
 *
 * - Callbacks: pass skipReservationGate false so only reserved Wavepay flows are credited.
 * - Admin manual: pass skipReservationGate true only after verifying status === "failed" and no refund tx.
 *
 * Idempotency: unique index on (type, metadata.withdrawalId) for refund/withdrawal; we always re-check
 * for an existing refund row before mutating balances.
 */
export async function creditWithdrawalRefundIfAbsent(withdrawal, options = {}) {
  await connectDB();
  const {
    referenceNumber,
    payoutID,
    rawStatus,
    statusNorm,
    source = "withdrawal_refund",
    skipReservationGate = false,
  } = options;

  const wid = withdrawal._id;
  const userId = withdrawal.userId;
  const totalDeduction = Number(withdrawal.amount || 0) + Number(withdrawal.fee || 0);
  if (!Number.isFinite(totalDeduction) || totalDeduction <= 0) {
    return { didApply: false };
  }

  if (!skipReservationGate) {
    const wasReserved = Boolean(withdrawal?.metadata?.balanceReserved);
    const hasReservationHint =
      withdrawal?.metadata?.totalDeduction !== undefined || withdrawal?.metadata?.balanceReservedAt !== undefined;
    if (!(wasReserved || hasReservationHint)) {
      return { didApply: false };
    }
  }

  const existingRefund = await Transaction.findOne({
    type: "refund",
    "metadata.withdrawalId": wid,
  })
    .select("_id")
    .lean();
  if (existingRefund) {
    if (!withdrawal?.metadata?.balanceRefunded) {
      await healBalanceRefundedFlag(wid);
    }
    return { didApply: true, alreadyRecorded: true };
  }

  const refundDoc = {
    userId,
    type: "refund",
    amount: totalDeduction,
    description: "Withdrawal refund",
    status: "completed",
    metadata: {
      withdrawalId: wid,
      referenceNumber: String(referenceNumber || payoutID || ""),
      source,
      ...(rawStatus || statusNorm ? { callbackStatus: rawStatus || statusNorm } : {}),
    },
  };

  const session = await mongoose.startSession();
  let result = { didApply: false };
  try {
    await session.withTransaction(async () => {
      const again = await Transaction.findOne({
        type: "refund",
        "metadata.withdrawalId": wid,
      })
        .session(session)
        .lean();
      if (again) {
        if (!withdrawal?.metadata?.balanceRefunded) {
          await Withdrawal.findByIdAndUpdate(
            wid,
            {
              $set: {
                "metadata.balanceRefunded": true,
                "metadata.balanceRefundedAt": new Date(),
              },
            },
            { session }
          );
        }
        result = { didApply: true, alreadyRecorded: true };
        return;
      }

      await Transaction.create([refundDoc], { session });
      const wallet = await Wallet.findOneAndUpdate(
        { userId },
        { $inc: { availableBalance: totalDeduction } },
        { session, returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
      );
      await User.findByIdAndUpdate(userId, { $set: { balance: Number(wallet?.availableBalance || 0) } }, { session });
      await Withdrawal.findByIdAndUpdate(
        wid,
        {
          $set: {
            "metadata.balanceRefunded": true,
            "metadata.balanceRefundedAt": new Date(),
          },
        },
        { session }
      );
      result = { didApply: true };
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      if (!withdrawal?.metadata?.balanceRefunded) {
        await healBalanceRefundedFlag(wid);
      }
      return { didApply: true, alreadyRecorded: true };
    }
    if (!isStandaloneMongoTransactionError(err)) throw err;
    result = await creditWithdrawalRefundSequentialFallback(refundDoc, withdrawal, wid, userId, totalDeduction);
  } finally {
    session.endSession();
  }
  return result;
}

/**
 * Standalone / dev Mongo: wallet first, then refund tx; on duplicate tx, reverse the wallet increment.
 */
async function creditWithdrawalRefundSequentialFallback(refundDoc, withdrawal, wid, userId, totalDeduction) {
  const existingRefund = await Transaction.findOne({
    type: "refund",
    "metadata.withdrawalId": wid,
  })
    .select("_id")
    .lean();
  if (existingRefund) {
    if (!withdrawal?.metadata?.balanceRefunded) {
      await healBalanceRefundedFlag(wid);
    }
    return { didApply: true, alreadyRecorded: true };
  }

  const wallet = await Wallet.findOneAndUpdate(
    { userId },
    { $inc: { availableBalance: totalDeduction } },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
  );
  await User.findByIdAndUpdate(userId, { $set: { balance: Number(wallet?.availableBalance || 0) } });

  try {
    await Transaction.create(refundDoc);
  } catch (e) {
    if (isDuplicateKeyError(e)) {
      const rolledBack = await Wallet.findOneAndUpdate(
        { userId },
        { $inc: { availableBalance: -totalDeduction } },
        { returnDocument: "after" }
      );
      await User.findByIdAndUpdate(userId, { $set: { balance: Number(rolledBack?.availableBalance || 0) } });
      if (!withdrawal?.metadata?.balanceRefunded) {
        await healBalanceRefundedFlag(wid);
      }
      return { didApply: true, alreadyRecorded: true };
    }
    const rolledBack = await Wallet.findOneAndUpdate(
      { userId },
      { $inc: { availableBalance: -totalDeduction } },
      { returnDocument: "after" }
    );
    await User.findByIdAndUpdate(userId, { $set: { balance: Number(rolledBack?.availableBalance || 0) } });
    throw e;
  }

  await Withdrawal.findByIdAndUpdate(wid, {
    $set: {
      "metadata.balanceRefunded": true,
      "metadata.balanceRefundedAt": new Date(),
    },
  });
  return { didApply: true };
}
