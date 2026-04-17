import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import LuckySpinTopup from "@/models/LuckySpinTopup";
import ActivationPayment from "@/models/ActivationPayment";
import { creditLuckySpinWallet } from "@/lib/lucky-spin/wallet";
import { getZetupayCredentials } from "@/models/Settings";
import { resolveActivationFee } from "@/lib/payments/activation-fee";
import { isTrustedCallback } from "@/lib/payments/callback-security";
import { logError, logInfo } from "@/lib/observability/logger";
import { auditPaymentCallback, handleActivationCallbackPipeline } from "@/lib/payments/activation-callback-core";

export async function POST(request) {
  const t0 = Date.now();
  try {
    await connectDB();
    const body = await request.json().catch(() => ({}));
    const payment = body.payment || body;
    const identifier = payment.identifier;
    if (!identifier) return NextResponse.json({ success: false, message: "identifier required" }, { status: 400 });

    const [topup, activation] = await Promise.all([LuckySpinTopup.findById(identifier), ActivationPayment.findById(identifier)]);
    if (!topup && !activation) return NextResponse.json({ success: true, message: "ack" }, { status: 200 });

    const creds = await getZetupayCredentials(false);
    if (creds?.error) {
      logError("spin.topup_callback_no_credentials", { identifier: String(identifier) });
      return NextResponse.json({ success: false, message: "Gateway not configured" }, { status: 503 });
    }
    const trusted = isTrustedCallback(request, creds);
    await auditPaymentCallback({
      route: "spin/topup-callback",
      identifier: String(identifier),
      payment,
      trusted,
    });
    if (!trusted) {
      return NextResponse.json({ success: false, message: "Invalid callback secret" }, { status: 401 });
    }

    const status = String(payment.status || "").toLowerCase();

    // Handle lucky spin checkout top-up callbacks.
    if (topup) {
      if (topup.status === "completed") {
        return NextResponse.json({ success: true, message: "already processed" }, { status: 200 });
      }
      if (status === "success" || status === "completed") {
        const updated = await LuckySpinTopup.findOneAndUpdate(
          { _id: topup._id, status: { $ne: "completed" } },
          {
            $set: {
              status: "completed",
              processedAt: new Date(),
              metadata: payment,
            },
          },
          { new: true }
        );
        if (updated) {
          await creditLuckySpinWallet({
            userId: topup.userId,
            amount: Number(topup.amount || 0),
            type: "topup_checkout",
            metadata: { topupId: topup._id, paymentKey: topup.paymentKey || "", reference: topup.reference || "" },
          });
        }
      } else {
        topup.status = "failed";
        topup.metadata = payment;
        await topup.save();
      }
      logInfo("spin.topup_callback_done", { identifier: String(identifier), ms: Date.now() - t0 });
      return NextResponse.json({ success: true, message: "topup callback processed" }, { status: 200 });
    }

    // Handle activation callbacks as fallback (same pipeline as main checkout callback).
    if (activation) {
      const effectiveFee = await resolveActivationFee();
      const result = await handleActivationCallbackPipeline({
        request,
        activation,
        payment,
        status,
        effectiveFee,
        routeTag: "spin-topup-callback",
      });
      logInfo("spin.topup_callback_activation_done", { identifier: String(identifier), ms: Date.now() - t0 });
      return NextResponse.json(result.json, { status: result.status });
    }

    return NextResponse.json({ success: true, message: "ack" }, { status: 200 });
  } catch (err) {
    logError("spin.topup_callback_crash", { error: err?.message || "unknown" });
    return NextResponse.json({ success: false, message: "internal error" }, { status: 500 });
  }
}
