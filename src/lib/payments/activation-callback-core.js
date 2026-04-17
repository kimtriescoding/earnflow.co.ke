import crypto from "node:crypto";
import { after } from "next/server";
import ActivationPayment from "@/models/ActivationPayment";
import User from "@/models/User";
import PaymentCallbackAudit from "@/models/PaymentCallbackAudit";
import { validateActivationPayment } from "@/lib/payments/callback-security";
import { recordActivationFeeDebit } from "@/lib/payments/activation-transaction";
import { blockIpNow } from "@/lib/api";
import { logError, logInfo } from "@/lib/observability/logger";
import { ensureOutboxJob } from "@/lib/payments/outbox-enqueue";
import { processOutboxJobByKey } from "@/lib/payments/outbox-processor";

function hashPayload(payment) {
  try {
    return crypto.createHash("sha256").update(JSON.stringify(payment ?? {})).digest("hex");
  } catch {
    return "";
  }
}

export async function auditPaymentCallback({ route, identifier, payment, trusted }) {
  try {
    await PaymentCallbackAudit.create({
      route,
      identifier: String(identifier || ""),
      bodyHash: hashPayload(payment),
      trusted,
      status: "received",
    });
  } catch {
    // non-fatal
  }
}

/**
 * Shared activation success/failure handling for ZetuPay callbacks (idempotent, CAS success transition).
 * Returns a plain object for the route to turn into NextResponse.
 */
export async function handleActivationCallbackPipeline({
  request,
  activation,
  payment,
  status,
  effectiveFee,
  routeTag = "checkout-callback",
}) {
  const identifier = String(activation?._id || "");
  const t0 = Date.now();

  if (activation.status === "success") {
    logInfo("activation.callback_duplicate_ack", { identifier, routeTag, ms: Date.now() - t0 });
    return { json: { success: true, message: "already processed" }, status: 200 };
  }

  const statusNorm = String(status || "").toLowerCase();
  const isSuccess = statusNorm === "success" || statusNorm === "completed";
  const isWaiting =
    statusNorm === "pending" ||
    statusNorm === "processing" ||
    statusNorm === "queued" ||
    statusNorm === "in_progress" ||
    statusNorm === "in-progress" ||
    statusNorm === "initiated" ||
    statusNorm === "submitted";
  const isFailure =
    statusNorm === "failed" ||
    statusNorm === "failure" ||
    statusNorm === "cancelled" ||
    statusNorm === "canceled" ||
    statusNorm === "rejected" ||
    statusNorm === "expired";

  if (isWaiting || !statusNorm) {
    return { json: { success: true, message: "activation pending" }, status: 200 };
  }

  if (!isSuccess && isFailure) {
    await ActivationPayment.findOneAndUpdate(
      { _id: activation._id, status: "pending" },
      { $set: { status: "failed", metadata: payment } }
    );
    return { json: { success: true, message: "activation failed" }, status: 200 };
  }

  if (!isSuccess) {
    // Unknown status: acknowledge without changing terminal state.
    return { json: { success: true, message: "activation status acknowledged" }, status: 200 };
  }

  const check = validateActivationPayment(activation, payment, effectiveFee.amount);
  if (!check.ok) {
    await ActivationPayment.findOneAndUpdate(
      { _id: activation._id, status: "pending" },
      {
        $set: {
          status: "failed",
          metadata: { ...payment, fraudReason: "amount_or_reference_mismatch", expectedAmount: effectiveFee.amount },
        },
      }
    );
    if (check.paidAmount < Number(effectiveFee.amount || 0)) {
      await blockIpNow({
        request,
        ipOverride: activation?.metadata?.requestIp || "",
        reason: "activation_underpayment",
        evidence: { identifier, paidAmount: check.paidAmount, expectedAmount: effectiveFee.amount },
      });
    }
    logError("activation.callback_validation_failed", { identifier, ...check, routeTag, expectedAmount: effectiveFee.amount });
    return { json: { success: true, message: "activation payment rejected" }, status: 200 };
  }

  const transitioned = await ActivationPayment.findOneAndUpdate(
    {
      _id: activation._id,
      status: { $in: ["pending", "failed"] },
      amount: check.paidAmount,
      reference: activation.reference,
    },
    { $set: { status: "success", metadata: payment } },
    { new: true }
  );

  const idem = `activation_referral:${activation._id}`;

  async function scheduleReferralOutbox() {
    await ensureOutboxJob({
      type: "activation_referral",
      idempotencyKey: idem,
      payload: {
        userId: activation.userId,
        activationPaymentId: activation._id.toString(),
        paidAmount: check.paidAmount,
      },
      status: "pending",
    });
    after(async () => {
      await processOutboxJobByKey(idem);
    });
  }

  if (!transitioned) {
    const cur = await ActivationPayment.findById(activation._id).lean();
    if (cur?.status === "success") {
      await User.findByIdAndUpdate(activation.userId, { $set: { isActivated: true } });
      await recordActivationFeeDebit({
        userId: activation.userId,
        paidAmount: check.paidAmount,
        activationPaymentId: activation._id,
        reference: activation.reference,
      });
      await scheduleReferralOutbox();
      logInfo("activation.callback_idempotent_replay", { identifier, routeTag, ms: Date.now() - t0 });
      return { json: { success: true, message: "activation callback processed" }, status: 200 };
    }
    logError("activation.callback_cas_lost", { identifier, routeTag, currentStatus: cur?.status });
    return { json: { success: true, message: "activation state conflict" }, status: 200 };
  }

  await recordActivationFeeDebit({
    userId: activation.userId,
    paidAmount: check.paidAmount,
    activationPaymentId: activation._id,
    reference: activation.reference,
  });
  await User.findByIdAndUpdate(activation.userId, { $set: { isActivated: true } });
  await scheduleReferralOutbox();

  logInfo("activation.callback_success", { identifier, paidAmount: check.paidAmount, routeTag, ms: Date.now() - t0 });
  return { json: { success: true, message: "activation callback processed" }, status: 200 };
}
