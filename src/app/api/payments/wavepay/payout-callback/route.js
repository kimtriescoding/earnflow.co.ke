import { NextResponse, after } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Withdrawal from "@/models/Withdrawal";
import User from "@/models/User";
import Wallet from "@/models/Wallet";
import Transaction from "@/models/Transaction";
import { getZetupayCredentials } from "@/models/Settings";
import { isTrustedCallback } from "@/lib/payments/callback-security";
import { ensureOutboxJob } from "@/lib/payments/outbox-enqueue";
import { processOutboxJobByKey } from "@/lib/payments/outbox-processor";
import { logInfo, logSecurity } from "@/lib/observability/logger";

function normalizePayoutPayload(body) {
  const payout = body?.payout || body?.data?.payout || body?.data || body;
  const rawStatus =
    payout?.status ??
    payout?.payoutStatus ??
    payout?.state ??
    payout?.paymentStatus ??
    body?.status;
  const statusNorm = String(rawStatus ?? "").trim().toLowerCase();
  return { payout, rawStatus: rawStatus ?? "", statusNorm };
}

function resolveWithdrawalIdentifier(body, payout) {
  const candidate = [
    payout?.identifier,
    body?.identifier,
    payout?.referenceNumber,
    body?.referenceNumber,
    payout?.reference,
    body?.reference,
    payout?.merchantReference,
    body?.merchantReference,
    payout?.externalReference,
    body?.externalReference,
    payout?.clientReference,
    body?.clientReference,
  ].find((value) => String(value || "").trim().length > 0);
  return String(candidate || "").trim();
}

const PAYOUT_SUCCESS = new Set(["success", "completed", "successful", "paid", "complete"]);
const PAYOUT_WAITING = new Set(["pending", "processing", "queued", "in_progress", "in-progress", "initiated", "submitted"]);

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function POST(request) {
  try {
    await connectDB();
    const contentType = request.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      return NextResponse.json({ success: false, message: "Invalid content type" }, { status: 400 });
    }

    const rawBody = await request.text();
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ success: false, message: "Invalid JSON format" }, { status: 400 });
    }

    const { payout, rawStatus, statusNorm } = normalizePayoutPayload(body);
    if (!payout) {
      return NextResponse.json({ success: false, message: "Payout data is required" }, { status: 400 });
    }

    const { payoutID, phoneNumber, amount, receiverName, referenceNumber } = payout;
    const identifier = resolveWithdrawalIdentifier(body, payout);
    if (!identifier) {
      return NextResponse.json({ success: false, message: "Identifier is required" }, { status: 400 });
    }

    const withdrawal = mongoose.Types.ObjectId.isValid(String(identifier))
      ? await Withdrawal.findById(identifier)
      : null;
    if (!withdrawal) {
      logInfo("payout.callback_withdrawal_not_found", { identifier: String(identifier) });
      return NextResponse.json({ success: true, message: "Withdrawal not found but callback acknowledged" }, { status: 200 });
    }

    const hasReferrer = withdrawal?.metadata?.gatewayType === "referral";
    const credentials = await getZetupayCredentials(hasReferrer);
    if (credentials?.error) {
      logInfo("payout.callback_no_credentials", { withdrawalId: String(withdrawal._id) });
      return NextResponse.json({ success: false, message: "Gateway not configured" }, { status: 503 });
    }
    if (!isTrustedCallback(request, credentials)) {
      logSecurity("payout.callback_invalid_secret", { withdrawalId: String(withdrawal._id) });
      return NextResponse.json({ success: false, message: "Invalid secret" }, { status: 401 });
    }

    if (withdrawal.status === "completed" || withdrawal.status === "failed") {
      return NextResponse.json({ success: true, message: "Withdrawal already processed" }, { status: 200 });
    }

    if (!statusNorm) {
      logInfo("payout.callback_missing_status", { withdrawalId: String(withdrawal._id), keys: Object.keys(payout || {}) });
      return NextResponse.json({ success: true, message: "Missing payout status" }, { status: 200 });
    }

    if (PAYOUT_WAITING.has(statusNorm)) {
      logInfo("payout.callback_in_progress", { withdrawalId: String(withdrawal._id), status: rawStatus });
      return NextResponse.json({ success: true, message: "Payout in progress" }, { status: 200 });
    }

    if (PAYOUT_SUCCESS.has(statusNorm)) {
      const totalDeduction = withdrawal.amount + withdrawal.fee;
      const wasReserved = Boolean(withdrawal?.metadata?.balanceReserved);

      const transitioned = await Withdrawal.findOneAndUpdate(
        { _id: withdrawal._id, status: "pending" },
        {
          $set: {
            status: "completed",
            transactionId: referenceNumber || payoutID,
            processedAt: new Date(),
            notes: `Payout completed via Zetupay. Reference: ${referenceNumber || payoutID}`,
            metadata: {
              ...(withdrawal.metadata || {}),
              balanceReserved: wasReserved,
              balanceSettledAt: new Date(),
            },
          },
        },
        { new: true }
      );

      if (!transitioned) {
        return NextResponse.json({ success: true, message: "Withdrawal already processed" }, { status: 200 });
      }

      let wallet;
      if (!wasReserved) {
        wallet = await Wallet.findOneAndUpdate(
          { userId: withdrawal.userId },
          {
            $inc: {
              availableBalance: -totalDeduction,
            },
          },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        );
      } else {
        wallet = await Wallet.findOne({ userId: withdrawal.userId }).lean();
      }
      await User.findByIdAndUpdate(withdrawal.userId, { $set: { balance: Number(wallet?.availableBalance || 0) } });

      try {
        await Transaction.create({
          userId: withdrawal.userId,
          type: "withdrawal",
          amount: -totalDeduction,
          description: "Withdrawal",
          status: "completed",
          metadata: {
            withdrawalId: withdrawal._id,
            referenceNumber: referenceNumber || payoutID,
            amount,
            phoneNumber,
            receiverName,
          },
        });
      } catch (e) {
        if (e?.code !== 11000) throw e;
      }

      const ref = String(referenceNumber || payoutID || "");
      const notifyKey = `payout_notify_success:${withdrawal._id}`;
      await ensureOutboxJob({
        type: "payout_notify_success",
        idempotencyKey: notifyKey,
        payload: {
          userId: withdrawal.userId,
          withdrawalId: withdrawal._id,
          amount: withdrawal.amount,
          referenceNumber: ref,
          method: withdrawal.method,
          phoneNumber: withdrawal.phoneNumber,
        },
        status: "pending",
      });
      after(async () => {
        await processOutboxJobByKey(notifyKey);
      });
    } else {
      logInfo("payout.callback_terminal_non_success", {
        withdrawalId: String(withdrawal._id),
        status: rawStatus || statusNorm || "(empty)",
      });
      const totalDeduction = Number(withdrawal.amount || 0) + Number(withdrawal.fee || 0);
      const wasReserved = Boolean(withdrawal?.metadata?.balanceReserved);
      const hasReservationHint =
        withdrawal?.metadata?.totalDeduction !== undefined || withdrawal?.metadata?.balanceReservedAt !== undefined;
      const alreadyRefunded = Boolean(withdrawal?.metadata?.balanceRefunded);
      const shouldRefund = !alreadyRefunded && (wasReserved || hasReservationHint);
      const callbackProcessedAt = new Date();
      const failedWithdrawal = await Withdrawal.findOneAndUpdate(
        { _id: withdrawal._id, status: { $nin: ["completed", "failed"] } },
        {
          $set: {
            status: "failed",
            notes: `Payout failed. Status: ${rawStatus || statusNorm || "unknown"}. Reference: ${referenceNumber || payoutID}`,
            processedAt: callbackProcessedAt,
            "metadata.lastCallbackStatus": rawStatus || statusNorm,
            "metadata.lastCallbackAt": callbackProcessedAt,
            ...(shouldRefund
              ? {
                  "metadata.balanceRefunded": true,
                  "metadata.balanceRefundedAt": callbackProcessedAt,
                }
              : {}),
          },
        },
        { new: true }
      );
      const didProcessFailure = Boolean(failedWithdrawal);
      if (didProcessFailure && shouldRefund) {
        const wallet = await Wallet.findOneAndUpdate(
          { userId: withdrawal.userId },
          {
            $inc: {
              availableBalance: totalDeduction,
            },
          },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        await User.findByIdAndUpdate(withdrawal.userId, { $set: { balance: Number(wallet?.availableBalance || 0) } });
        try {
          await Transaction.create({
            userId: withdrawal.userId,
            type: "refund",
            amount: totalDeduction,
            description: "Withdrawal refund",
            status: "completed",
            metadata: {
              withdrawalId: withdrawal._id,
              referenceNumber: referenceNumber || payoutID,
              source: "wavepay_payout_callback",
              callbackStatus: rawStatus || statusNorm,
            },
          });
        } catch (e) {
          if (e?.code !== 11000) throw e;
        }
      }
      if (didProcessFailure) {
        const ref = String(referenceNumber || payoutID || "");
        const notifyKey = `payout_notify_failure:${withdrawal._id}`;
        await ensureOutboxJob({
          type: "payout_notify_failure",
          idempotencyKey: notifyKey,
          payload: {
            userId: withdrawal.userId,
            withdrawalId: withdrawal._id,
            amount: withdrawal.amount,
            referenceNumber: ref,
            status: rawStatus || statusNorm,
            reason: `Payout failed with status: ${rawStatus || statusNorm || "unknown"}`,
          },
          status: "pending",
        });
        after(async () => {
          await processOutboxJobByKey(notifyKey);
        });
      }
    }

    return NextResponse.json({ success: true, message: "Payout callback processed successfully" }, { status: 200 });
  } catch {
    return NextResponse.json({ success: true, message: "Callback received" }, { status: 200 });
  }
}
