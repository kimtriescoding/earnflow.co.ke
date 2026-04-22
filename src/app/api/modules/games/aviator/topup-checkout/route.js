import connectDB from "@/lib/db";
import { requireAuth } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/api";
import AviatorTopup from "@/models/AviatorTopup";
import { initiateCheckout } from "@/lib/payments/wavepay";
import { getSetting, getZetupayCredentials } from "@/models/Settings";
import { isModuleEnabled } from "@/lib/modules/module-access";
import { getPaymentRealSwitches } from "@/lib/payments/reality-switch";

export async function POST(request) {
  const auth = await requireAuth(["user", "admin"]);
  if (auth.error) return auth.error;
  await connectDB();

  const moduleStatus = await getSetting("module_status", {});
  if (!isModuleEnabled(moduleStatus, "aviator")) return fail("Aviator is disabled", 403);

  const body = await request.json().catch(() => ({}));
  const amount = Number(body.amount || 0);
  const phoneNumber = String(body.phoneNumber || "").trim();
  if (!Number.isFinite(amount) || amount <= 0) return fail("Invalid top-up amount");

  const creds = await getZetupayCredentials(false);
  if (creds?.error) return fail("Zetupay credentials missing", 500);
  const switches = await getPaymentRealSwitches();
  const real = switches.aviatorTopup;

  const draft = await AviatorTopup.create({
    userId: auth.payload.sub,
    amount,
    method: "checkout",
    status: "pending",
    reference: `AVC-${Date.now()}`,
    phoneNumber,
    metadata: { real },
  });

  const result = await initiateCheckout({
    publicKey: creds.publicKey,
    privateKey: creds.privateKey,
    walletId: creds.walletId,
    amount,
    reference: draft.reference,
    redirectUrl: body.redirectUrl || `${process.env.APP_URL}/dashboard/aviator`,
    identifier: draft._id.toString(),
    phoneNumber,
    real,
  });

  if (!result.success) return fail("Failed to initiate checkout", 400);
  await AviatorTopup.findByIdAndUpdate(draft._id, { paymentKey: result.paymentKey });
  return ok({ data: { ...result, topupId: draft._id } });
}
