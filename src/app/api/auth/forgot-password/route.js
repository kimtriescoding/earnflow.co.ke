import connectDB from "@/lib/db";
import User from "@/models/User";
import PasswordResetToken from "@/models/PasswordResetToken";
import { generateResetToken, hashResetToken } from "@/lib/auth/reset-password";
import { ok, guardRateLimit } from "@/lib/api";
import { getEnv } from "@/lib/env";
import { sendPasswordResetEmail } from "@/lib/email-utils";
import { logInfo } from "@/lib/observability/logger";

export async function POST(request) {
  const limited = guardRateLimit(request, "auth.forgot_password", 8, 60_000);
  if (limited) return limited;
  await connectDB();
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  if (!email) return ok({ message: "If the email exists, a reset link has been sent." });

  const user = await User.findOne({ email }).select("_id email").lean();
  if (!user) return ok({ message: "If the email exists, a reset link has been sent." });

  const token = generateResetToken();
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

  await PasswordResetToken.create({
    userId: user._id,
    tokenHash,
    expiresAt,
  });

  const env = getEnv();
  const resetUrl = `${env.APP_URL.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
  const sendResult = await sendPasswordResetEmail({ to: email, resetUrl });
  if (!sendResult?.sent && env.NODE_ENV === "development") {
    logInfo("email.password_reset.dev_fallback_link", { to: email, resetUrl });
  }

  return ok({ message: "If the email exists, a reset link has been sent." });
}
