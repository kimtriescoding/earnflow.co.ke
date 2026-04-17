import connectDB from "@/lib/db";
import { requireAuth } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/api";
import LuckySpinTopup from "@/models/LuckySpinTopup";
import { initiateCheckout } from "@/lib/payments/wavepay";
import { getZetupayCredentials } from "@/models/Settings";

export async function POST(request) {
  const auth = await requireAuth(["user", "admin"]);
  if (auth.error) return auth.error;
  await connectDB();

  const body = await request.json().catch(() => ({}));
  const amount = Number(body.amount || 0);
  const phoneNumber = String(body.phoneNumber || "").trim();
  if (!Number.isFinite(amount) || amount <= 0) return fail("Invalid top-up amount");

  const creds = await getZetupayCredentials(false);
  if (creds?.error) return fail("Zetupay credentials missing", 500);

  const draft = await LuckySpinTopup.create({
    userId: auth.payload.sub,
    amount,
    method: "checkout",
    status: "pending",
    reference: `LSC-${Date.now()}`,
    phoneNumber,
  });

  const result = await initiateCheckout({
    publicKey: creds.publicKey,
    privateKey: creds.privateKey,
    walletId: creds.walletId,
    amount,
    reference: draft.reference,
    redirectUrl: body.redirectUrl || `${process.env.APP_URL}/dashboard/lucky-spin`,
    identifier: draft._id.toString(),
    phoneNumber,
  });

  if (!result.success) return fail("Failed to initiate checkout", 400);
  await LuckySpinTopup.findByIdAndUpdate(draft._id, { paymentKey: result.paymentKey });
  return ok({ data: { ...result, topupId: draft._id } });
}
