import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Withdrawal from "@/models/Withdrawal";
import User from "@/models/User";
import Transaction from "@/models/Transaction";
import { requireAuth } from "@/lib/auth/guards";
import { ok, fail } from "@/lib/api";
import { creditWithdrawalRefundIfAbsent, withdrawalRefundTransactionExists } from "@/lib/payments/withdrawal-refund";
import { logInfo } from "@/lib/observability/logger";

export async function GET(request) {
  const auth = await requireAuth(["admin", "support"]);
  if (auth.error) return auth.error;
  await connectDB();
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") || 1);
  const pageSize = Math.min(100, Number(searchParams.get("pageSize") || 20));
  const status = String(searchParams.get("status") || "").trim();
  const sortDir = searchParams.get("sortDir") === "asc" ? 1 : -1;

  const filter = status ? { status } : {};
  const [total, withdrawals] = await Promise.all([
    Withdrawal.countDocuments(filter),
    Withdrawal.find(filter).sort({ createdAt: sortDir }).skip((page - 1) * pageSize).limit(pageSize).lean(),
  ]);

  const users = await User.find({ _id: { $in: withdrawals.map((item) => item.userId) } }).select("username email").lean();
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  const withdrawalIds = withdrawals.map((w) => w._id).filter(Boolean);
  const refundedIds =
    withdrawalIds.length === 0
      ? []
      : await Transaction.distinct("metadata.withdrawalId", {
          type: "refund",
          "metadata.withdrawalId": { $in: withdrawalIds },
        });
  const refundedSet = new Set(refundedIds.map((id) => String(id)));

  const data = withdrawals.map((w) => ({
    ...w,
    user: userMap.get(String(w.userId)) || null,
    hasRefundTransaction: refundedSet.has(String(w._id)),
  }));
  return ok({ data, total, page, pageSize });
}

export async function PATCH(request) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;
  await connectDB();
  const body = await request.json().catch(() => null);
  if (!body?.withdrawalId) return fail("withdrawalId required");

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
    return ok({ message: "Refund issued to wallet", totalCredited });
  }

  if (!body?.status) return fail("withdrawalId and status required");
  await Withdrawal.findByIdAndUpdate(body.withdrawalId, { status: body.status, notes: body.notes || "" });
  return ok({ message: "Withdrawal updated" });
}
