import connectDB from "@/lib/db";
import ChatUnlockPayment from "@/models/ChatUnlockPayment";
import User from "@/models/User";
import { requireAuth } from "@/lib/auth/guards";
import { initiateCheckout } from "@/lib/payments/wavepay";
import { getZetupayCredentials } from "@/models/Settings";
import { ok, fail, guardBlockedIp } from "@/lib/api";
import { resolveChatUnlockConfig } from "@/lib/payments/chat-unlock-config";
import { logInfo } from "@/lib/observability/logger";
import { getPaymentRealSwitches } from "@/lib/payments/reality-switch";

export async function GET() {
  const auth = await requireAuth(["user", "admin"]);
  if (auth.error) return auth.error;
  await connectDB();
  const [config, user] = await Promise.all([
    resolveChatUnlockConfig(),
    User.findById(auth.payload.sub).select("chatUnlocked phoneNumber").lean(),
  ]);
  return ok({
    data: {
      fee: Number(config.fee || 0),
      unlocked: Boolean(user?.chatUnlocked),
      phoneNumber: String(user?.phoneNumber || ""),
    },
  });
}

export async function POST(request) {
  const blocked = await guardBlockedIp(request);
  if (blocked) return blocked;
  const auth = await requireAuth(["user", "admin"]);
  if (auth.error) return auth.error;
  await connectDB();
  const user = await User.findById(auth.payload.sub).select("chatUnlocked").lean();
  if (user?.chatUnlocked) return ok({ data: { unlocked: true } });
  const body = await request.json().catch(() => ({}));
  const phoneNumber = String(body.phoneNumber || "").trim();
  if (!phoneNumber) return fail("Phone number is required");
  if (!/^\+?\d{10,15}$/.test(phoneNumber)) return fail("Invalid phone number format");
  const config = await resolveChatUnlockConfig();
  const amount = Number(config.fee || 0);
  if (amount <= 0) return fail("Chat unlock amount not configured");
  const creds = await getZetupayCredentials(false);
  if (creds?.error) return fail("Zetupay credentials missing", 500);
  const switches = await getPaymentRealSwitches();
  const real = switches.activation;
  const draft = await ChatUnlockPayment.create({
    userId: auth.payload.sub,
    amount,
    currency: "KES",
    reference: `CHATU-${Date.now()}`,
    status: "pending",
    metadata: {
      requestIp: request.headers.get("x-forwarded-for") || "unknown",
      referrerBonus: Number(config.referrerBonus || 0),
      real,
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
      redirectUrl: body.redirectUrl || `${process.env.APP_URL}/dashboard/chat`,
      identifier: draft._id.toString(),
      phoneNumber,
      real,
    });
  } catch {
    return fail("Checkout provider request failed", 502);
  }
  if (!result.success) return fail(result.error || "Failed to initiate checkout", 400);
  await User.findByIdAndUpdate(auth.payload.sub, { phoneNumber });
  await ChatUnlockPayment.findByIdAndUpdate(draft._id, { paymentKey: result.paymentKey });
  logInfo("chat_unlock.checkout_initiated", {
    userId: auth.payload.sub,
    chatUnlockPaymentId: draft._id.toString(),
    amount,
    ip: request.headers.get("x-forwarded-for") || "unknown",
  });
  return ok({ data: result });
}
