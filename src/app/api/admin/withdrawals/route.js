import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Withdrawal from "@/models/Withdrawal";
import User from "@/models/User";
import Transaction from "@/models/Transaction";
import { requireAuth } from "@/lib/auth/guards";
import { ok, fail } from "@/lib/api";
import { creditWithdrawalRefundIfAbsent, withdrawalRefundTransactionExists } from "@/lib/payments/withdrawal-refund";
import { logInfo } from "@/lib/observability/logger";
import { ADMIN_WITHDRAWALS_CACHE, invalidateAdminCaches, invalidateDashboardUserCaches } from "@/lib/cache/get-cache-invalidation";
import { createGetTimer, withPrivateCacheControl } from "@/lib/observability/get-timing";

export async function GET(request) {
  const timer = createGetTimer("api_admin_withdrawals");
  const auth = await requireAuth(["admin", "support"]);
  if (auth.error) return auth.error;
  await connectDB();
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") || 1);
  const pageSize = Math.min(100, Number(searchParams.get("pageSize") || 20));
  const search = String(searchParams.get("search") || "").trim();
  const status = String(searchParams.get("status") || "").trim();
  const sortDir = searchParams.get("sortDir") === "asc" ? 1 : -1;
  const cacheKey = `${status}|${page}|${pageSize}|${sortDir}|${search}`;
  const cached = ADMIN_WITHDRAWALS_CACHE.get(cacheKey);
  if (cached) {
    timer.markCacheHit();
    return timer.finish(withPrivateCacheControl(ok(cached), 30));
  }

  const filter = status ? { status } : {};
  if (search) {
    const matchedUsers = await User.find({
      $or: [
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ]
    }).select("_id").lean();
    const userIds = matchedUsers.map((u) => u._id);

    const searchConditions = [{ phoneNumber: { $regex: search, $options: "i" } }];
    if (userIds.length > 0) {
      searchConditions.push({ userId: { $in: userIds } });
    }
    if (mongoose.Types.ObjectId.isValid(search)) {
      searchConditions.push({ _id: new mongoose.Types.ObjectId(search) });
    }
    
    filter.$and = filter.$and || [];
    filter.$and.push({ $or: searchConditions });
  }

  const [total, withdrawals] = await Promise.all([
    Withdrawal.countDocuments(filter),
    Withdrawal.find(filter).sort({ createdAt: sortDir }).skip((page - 1) * pageSize).limit(pageSize).lean(),
  ]);

  const withdrawalIds = withdrawals.map((w) => w._id).filter(Boolean);
  const [users, refundedIds] = await Promise.all([
    User.find({ _id: { $in: withdrawals.map((item) => item.userId) } }).select("username email").lean(),
    withdrawalIds.length === 0
      ? Promise.resolve([])
      : Transaction.distinct("metadata.withdrawalId", {
          type: "refund",
          "metadata.withdrawalId": { $in: withdrawalIds },
        }),
  ]);
  const userMap = new Map(users.map((u) => [String(u._id), u]));
  const refundedSet = new Set(refundedIds.map((id) => String(id)));

  const data = withdrawals.map((w) => ({
    ...w,
    user: userMap.get(String(w.userId)) || null,
    hasRefundTransaction: refundedSet.has(String(w._id)),
  }));
  const payload = { data, total, page, pageSize };
  ADMIN_WITHDRAWALS_CACHE.set(cacheKey, payload);
  return timer.finish(withPrivateCacheControl(ok(payload), 30));
}

export async function PATCH(request) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;
  await connectDB();
  const body = await request.json().catch(() => null);
  if (!body?.withdrawalId) return fail("withdrawalId required");

  if (body.action === "post_to_gateway") {
    if (!mongoose.Types.ObjectId.isValid(String(body.withdrawalId))) {
      return fail("Invalid withdrawalId", 400);
    }
    const withdrawal = await Withdrawal.findById(body.withdrawalId);
    if (!withdrawal) return fail("Withdrawal not found", 404);
    if (withdrawal.status !== "pending") {
      return fail("Only pending withdrawals can be posted to the gateway", 400);
    }

    const { getZetupayCredentials } = await import("@/models/Settings");
    const creds = await getZetupayCredentials(false);
    if (creds?.error) {
      return fail(creds.error || "Payout gateway credentials missing", 500);
    }

    const { initiatePayout } = await import("@/lib/payments/wavepay");
    const result = await initiatePayout({
      publicKey: creds.publicKey,
      privateKey: creds.privateKey,
      walletId: creds.walletId,
      amount: withdrawal.amount,
      identifier: withdrawal._id.toString(),
      phoneNumber: withdrawal.phoneNumber,
    });

    if (!result.success) {
      return fail(result.error || "Payout initiation failed", 400);
    }

    await Withdrawal.findByIdAndUpdate(withdrawal._id, {
      $set: {
        "metadata.payoutGatewayQueued": true,
        "metadata.payoutGatewayQueuedAt": new Date(),
      },
    });

    invalidateAdminCaches();
    if (withdrawal.userId) invalidateDashboardUserCaches(String(withdrawal.userId));
    return ok({ message: "Payout posted to gateway successfully" });
  }

  if (body.action === "complete_manual") {
    if (!mongoose.Types.ObjectId.isValid(String(body.withdrawalId))) {
      return fail("Invalid withdrawalId", 400);
    }
    const withdrawal = await Withdrawal.findById(body.withdrawalId);
    if (!withdrawal) return fail("Withdrawal not found", 404);
    if (withdrawal.status !== "pending") {
      return fail("Only pending withdrawals can be completed manually", 400);
    }

    const totalDeduction = withdrawal.amount + withdrawal.fee;
    const transitioned = await Withdrawal.findOneAndUpdate(
      { _id: withdrawal._id, status: "pending" },
      {
        $set: {
          status: "completed",
          transactionId: body.transactionId || `manual-${withdrawal._id}`,
          processedAt: new Date(),
          notes: body.notes || "Payout completed manually by admin.",
          metadata: {
            ...(withdrawal.metadata || {}),
            completedManually: true,
            completedManuallyAt: new Date(),
            completedManuallyBy: auth.payload.sub,
          },
        },
      },
      { returnDocument: "after" }
    );

    if (!transitioned) {
      return fail("Withdrawal already processed", 400);
    }

    try {
      await Transaction.create({
        userId: withdrawal.userId,
        type: "withdrawal",
        amount: -totalDeduction,
        description: "Withdrawal",
        status: "completed",
        metadata: {
          withdrawalId: withdrawal._id,
          referenceNumber: body.transactionId || `manual-${withdrawal._id}`,
          amount: withdrawal.amount,
          phoneNumber: withdrawal.phoneNumber,
          notes: body.notes || "Completed manually by admin.",
        },
      });
    } catch (e) {
      if (e?.code !== 11000) throw e;
    }

    const { ensureOutboxJob } = await import("@/lib/payments/outbox-enqueue");
    const { processOutboxJobByKey } = await import("@/lib/payments/outbox-processor");

    const notifyKey = `payout_notify_success:${withdrawal._id}`;
    await ensureOutboxJob({
      type: "payout_notify_success",
      idempotencyKey: notifyKey,
      payload: {
        userId: withdrawal.userId,
        withdrawalId: withdrawal._id,
        amount: withdrawal.amount,
        referenceNumber: body.transactionId || `manual-${withdrawal._id}`,
        method: withdrawal.method,
        phoneNumber: withdrawal.phoneNumber,
      },
      status: "pending",
    });

    try {
      await processOutboxJobByKey(notifyKey);
    } catch (err) {
      logInfo("payout.complete_manual_notification_error", { withdrawalId: String(withdrawal._id), error: err.message });
    }

    invalidateAdminCaches();
    invalidateDashboardUserCaches(String(withdrawal.userId));
    return ok({ message: "Withdrawal completed manually." });
  }

  if (body.action === "cancel") {
    if (!mongoose.Types.ObjectId.isValid(String(body.withdrawalId))) {
      return fail("Invalid withdrawalId", 400);
    }
    const withdrawal = await Withdrawal.findById(body.withdrawalId);
    if (!withdrawal) return fail("Withdrawal not found", 404);
    if (withdrawal.status !== "pending") {
      return fail("Only pending withdrawals can be cancelled", 400);
    }

    const updated = await Withdrawal.findByIdAndUpdate(
      withdrawal._id,
      {
        status: "failed",
        notes: body.notes || "Cancelled by admin",
        processedAt: new Date(),
      },
      { returnDocument: "after" }
    );

    const r = await creditWithdrawalRefundIfAbsent(updated, {
      skipReservationGate: true,
      source: "admin_manual_cancel",
    });

    invalidateAdminCaches();
    invalidateDashboardUserCaches(String(withdrawal.userId));
    return ok({ message: "Withdrawal cancelled and refunded", refundApplied: r.didApply });
  }

  if (body.action === "acknowledge_no_refund") {
    if (!mongoose.Types.ObjectId.isValid(String(body.withdrawalId))) {
      return fail("Invalid withdrawalId", 400);
    }
    const withdrawal = await Withdrawal.findById(body.withdrawalId);
    if (!withdrawal) return fail("Withdrawal not found", 404);
    if (withdrawal.status !== "failed") {
      return fail("Ledger verification is only for failed withdrawals", 400);
    }
    if (await withdrawalRefundTransactionExists(withdrawal._id)) {
      return fail("A refund transaction already exists for this withdrawal", 409);
    }
    if (
      withdrawal.metadata?.balanceRefunded === true &&
      withdrawal.metadata?.payoutGatewayQueued === false
    ) {
      return fail(
        "This withdrawal never reached the payout gateway; the wallet was rolled back when initiation failed. Manual refund does not apply.",
        400
      );
    }
    if (withdrawal.metadata?.noRefundLedgerAcknowledged) {
      return ok({ message: "Ledger was already verified for this withdrawal.", alreadyAcknowledged: true });
    }
    await Withdrawal.findByIdAndUpdate(withdrawal._id, {
      $set: {
        "metadata.noRefundLedgerAcknowledged": true,
        "metadata.noRefundLedgerAcknowledgedAt": new Date(),
        ...(auth.payload?.sub && mongoose.Types.ObjectId.isValid(String(auth.payload.sub))
          ? { "metadata.noRefundLedgerAcknowledgedBy": new mongoose.Types.ObjectId(String(auth.payload.sub)) }
          : {}),
      },
    });
    logInfo("withdrawal.admin_no_refund_acknowledged", { withdrawalId: String(withdrawal._id) });
    return ok({ message: "Ledger verified. You can credit the wallet when ready." });
  }

  if (body.action === "issue_refund") {
    if (!mongoose.Types.ObjectId.isValid(String(body.withdrawalId))) {
      return fail("Invalid withdrawalId", 400);
    }
    const withdrawal = await Withdrawal.findById(body.withdrawalId);
    if (!withdrawal) return fail("Withdrawal not found", 404);
    if (withdrawal.status !== "failed") {
      return fail("Manual refund is only allowed for failed withdrawals", 400);
    }
    if (!withdrawal.metadata?.noRefundLedgerAcknowledged) {
      return fail("Use the green Refund step to verify the ledger before crediting the wallet.", 400);
    }
    if (await withdrawalRefundTransactionExists(withdrawal._id)) {
      return fail("A refund transaction already exists for this withdrawal", 409);
    }
    if (
      withdrawal.metadata?.balanceRefunded === true &&
      withdrawal.metadata?.payoutGatewayQueued === false
    ) {
      return fail(
        "This withdrawal never reached the payout gateway; the wallet was rolled back. No wallet credit is required.",
        400
      );
    }
    const plain = withdrawal.toObject({ flattenMaps: true });
    const r = await creditWithdrawalRefundIfAbsent(plain, {
      skipReservationGate: true,
      source: "admin_withdrawal_refund",
    });
    if (!r.didApply) {
      return fail("Unable to issue refund (amount is zero or invalid)", 400);
    }
    if (r.alreadyRecorded) {
      return ok({
        message: "Refund was already recorded for this withdrawal; metadata was synced if needed.",
        alreadyRecorded: true,
      });
    }
    const totalCredited = Number(withdrawal.amount || 0) + Number(withdrawal.fee || 0);
    logInfo("withdrawal.admin_refund_issued", {
      withdrawalId: String(withdrawal._id),
      userId: String(withdrawal.userId),
      totalCredited,
    });
    invalidateAdminCaches();
    invalidateDashboardUserCaches(String(withdrawal.userId));
    return ok({ message: "Refund issued to wallet", totalCredited });
  }

  if (!body?.status) return fail("withdrawalId and status required");
  const updated = await Withdrawal.findByIdAndUpdate(
    body.withdrawalId,
    { status: body.status, notes: body.notes || "" },
    { returnDocument: "after" }
  );
  invalidateAdminCaches();
  if (updated?.userId) invalidateDashboardUserCaches(String(updated.userId));
  return ok({ message: "Withdrawal updated" });
}
