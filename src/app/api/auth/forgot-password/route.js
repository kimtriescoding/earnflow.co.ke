import connectDB from "@/lib/db";
import User from "@/models/User";
import PasswordResetToken from "@/models/PasswordResetToken";
import { generateResetToken, hashResetToken } from "@/lib/auth/reset-password";
import { ok, guardRateLimit } from "@/lib/api";

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

  const url = `${process.env.APP_URL || "http://localhost:3000"}/reset-password?token=${token}`;
  // Replace with real email provider integration.
  console.log(`[Earnflow] Password reset link for ${email}: ${url}`);

  return ok({ message: "If the email exists, a reset link has been sent." });
}
