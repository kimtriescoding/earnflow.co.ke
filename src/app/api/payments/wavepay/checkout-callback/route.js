import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import ActivationPayment from "@/models/ActivationPayment";
import LuckySpinTopup from "@/models/LuckySpinTopup";
import AviatorTopup from "@/models/AviatorTopup";
import ClientOrder from "@/models/ClientOrder";
import { creditLuckySpinWallet } from "@/lib/lucky-spin/wallet";
import { creditAviatorWallet } from "@/lib/aviator/wallet";
import { getZetupayCredentials } from "@/models/Settings";
import { resolveActivationFee } from "@/lib/payments/activation-fee";
import { isTrustedCallback, validateClientOrderPayment } from "@/lib/payments/callback-security";
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
    const [activation, topup, aviatorTopup, clientOrder] = await Promise.all([
      ActivationPayment.findById(identifier),
      LuckySpinTopup.findById(identifier),
      AviatorTopup.findById(identifier),
      ClientOrder.findById(identifier),
    ]);
    if (!activation && !topup && !aviatorTopup && !clientOrder) {
      return NextResponse.json({ success: true, message: "ack" }, { status: 200 });
    }
    const status = String(payment.status || "").toLowerCase();

    const creds = await getZetupayCredentials(false);
    if (creds?.error) {
      logError("checkout_callback.no_credentials", { identifier: String(identifier) });
      return NextResponse.json({ success: false, message: "Gateway not configured" }, { status: 503 });
    }
    const trusted = isTrustedCallback(request, creds);
    await auditPaymentCallback({
      route: "wavepay/checkout-callback",
      identifier: String(identifier),
      payment,
      trusted,
    });
    if (!trusted) {
      logError("checkout_callback.untrusted", { identifier: String(identifier), status });
      return NextResponse.json({ success: false, message: "Invalid callback secret" }, { status: 401 });
    }

    // Handle activation callbacks.
    if (activation) {
      const effectiveFee = await resolveActivationFee();
      const result = await handleActivationCallbackPipeline({
        request,
        activation,
        payment,
        status,
        effectiveFee,
        routeTag: "checkout-callback",
      });
      logInfo("checkout_callback.activation_done", { identifier: String(identifier), ms: Date.now() - t0 });
      return NextResponse.json(result.json, { status: result.status });
    }

    // Handle client-service order callbacks.
    if (clientOrder) {
      if (clientOrder.paymentStatus === "success") {
        return NextResponse.json({ success: true, message: "already processed" }, { status: 200 });
      }
      if (status === "success" || status === "completed") {
        const ordCheck = validateClientOrderPayment(clientOrder, payment);
        if (!ordCheck.ok) {
          clientOrder.paymentStatus = "failed";
          clientOrder.status = "cancelled";
          clientOrder.metadata = { ...(clientOrder.metadata || {}), payment, fraudReason: "amount_or_reference_mismatch" };
          await clientOrder.save();
          logError("checkout_callback.client_order_rejected", { identifier: String(identifier), ...ordCheck });
          return NextResponse.json({ success: true, message: "client order payment rejected" }, { status: 200 });
        }
        clientOrder.paymentStatus = "success";
        clientOrder.status = "pending_approval";
        clientOrder.metadata = { ...(clientOrder.metadata || {}), payment };
      } else {
        clientOrder.paymentStatus = "failed";
        clientOrder.status = "cancelled";
        clientOrder.metadata = { ...(clientOrder.metadata || {}), payment };
      }
      await clientOrder.save();
      return NextResponse.json({ success: true, message: "client order callback processed" }, { status: 200 });
    }

    // Handle aviator checkout top-up callbacks.
    if (aviatorTopup) {
      if (aviatorTopup.status === "completed") {
        return NextResponse.json({ success: true, message: "already processed" }, { status: 200 });
      }
      if (status === "success" || status === "completed") {
        const updated = await AviatorTopup.findOneAndUpdate(
          { _id: aviatorTopup._id, status: { $ne: "completed" } },
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
          await creditAviatorWallet({
            userId: aviatorTopup.userId,
            amount: Number(aviatorTopup.amount || 0),
            type: "topup_checkout",
            metadata: { topupId: aviatorTopup._id, paymentKey: aviatorTopup.paymentKey || "", reference: aviatorTopup.reference || "" },
          });
        }
      } else {
        aviatorTopup.status = "failed";
        aviatorTopup.metadata = payment;
        await aviatorTopup.save();
      }
      return NextResponse.json({ success: true, message: "aviator topup callback processed" }, { status: 200 });
    }

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
      return NextResponse.json({ success: true, message: "topup callback processed" }, { status: 200 });
    }

    return NextResponse.json({ success: true, message: "ack" }, { status: 200 });
  } catch (err) {
    logError("checkout_callback.crash", { error: err?.message || "unknown" });
    return NextResponse.json({ success: false, message: "internal error" }, { status: 500 });
  }
}
