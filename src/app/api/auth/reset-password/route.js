import connectDB from "@/lib/db";
import PasswordResetToken from "@/models/PasswordResetToken";
import User from "@/models/User";
import { hashResetToken } from "@/lib/auth/reset-password";
import { hashPassword } from "@/lib/auth/password";
import { ok, fail, guardRateLimit } from "@/lib/api";

export async function POST(request) {
  const limited = guardRateLimit(request, "auth.reset_password", 10, 60_000);
  if (limited) return limited;
  await connectDB();
  const body = await request.json().catch(() => ({}));
  const token = String(body.token || "");
  const password = String(body.password || "");
  if (!token || password.length < 6) return fail("Token and valid password required");

  const tokenHash = hashResetToken(token);
  const record = await PasswordResetToken.findOne({ tokenHash, usedAt: null });
  if (!record) return fail("Invalid or expired reset token", 400);
  if (record.expiresAt.getTime() < Date.now()) return fail("Reset token has expired", 400);

  await User.findByIdAndUpdate(record.userId, { passwordHash: await hashPassword(password) });
  record.usedAt = new Date();
  await record.save();

  return ok({ message: "Password reset successful. You can now log in." });
}
