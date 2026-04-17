import connectDB from "@/lib/db";
import ActivationPayment from "@/models/ActivationPayment";
import User from "@/models/User";
import { requireAuth } from "@/lib/auth/guards";
import { initiateCheckout } from "@/lib/payments/wavepay";
import { getZetupayCredentials } from "@/models/Settings";
import { ok, fail, guardBlockedIp } from "@/lib/api";
import { resolveActivationFee } from "@/lib/payments/activation-fee";
import { logInfo } from "@/lib/observability/logger";

export async function GET() {
  const auth = await requireAuth(["user", "admin"]);
  if (auth.error) return auth.error;
  const activation = await resolveActivationFee();
  const amount = Number(activation.amount || 0);
  return ok({ data: { amount } });
}

export async function POST(request) {
  const blocked = await guardBlockedIp(request);
  if (blocked) return blocked;
  const auth = await requireAuth(["user", "admin"]);
  if (auth.error) return auth.error;
  await connectDB();
  const body = await request.json().catch(() => ({}));
  const phoneNumber = String(body.phoneNumber || "").trim();
  if (!phoneNumber) return fail("Phone number is required");
  if (!/^\+?\d{10,15}$/.test(phoneNumber)) return fail("Invalid phone number format");
  const activation = await resolveActivationFee();
  const amount = Number(activation.amount || 0);
  if (amount <= 0) return fail("Activation amount not configured");
  const creds = await getZetupayCredentials(false);
  if (creds?.error) return fail("Zetupay credentials missing", 500);
  const draft = await ActivationPayment.create({
    userId: auth.payload.sub,
    amount,
    currency: "KES",
    reference: `ACT-${Date.now()}`,
    status: "pending",
    metadata: {
      requestIp: request.headers.get("x-forwarded-for") || "unknown",
      amountSource: activation.source,
    },
  });
  let result;
  try {
    result = await initiateCheckout({
      publicKey: creds.publicKey,
      privateKey: creds.privateKey,
      walletId: creds.walletId,
      amount,
      reference: draft.reference,
      redirectUrl: body.redirectUrl || `${process.env.APP_URL}/dashboard`,
      identifier: draft._id.toString(),
      phoneNumber,
    });
  } catch {
    return fail("Checkout provider request failed", 502);
  }
  if (!result.success) return fail(result.error || "Failed to initiate checkout", 400);
  if (phoneNumber) {
    await User.findByIdAndUpdate(auth.payload.sub, { phoneNumber });
  }
  await ActivationPayment.findByIdAndUpdate(draft._id, { paymentKey: result.paymentKey });
  logInfo("activation.checkout_initiated", {
    userId: auth.payload.sub,
    activationPaymentId: draft._id.toString(),
    amount,
    amountSource: activation.source,
    ip: request.headers.get("x-forwarded-for") || "unknown",
  });
  return ok({ data: result });
}
