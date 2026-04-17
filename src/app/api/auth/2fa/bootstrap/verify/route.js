import connectDB from "@/lib/db";
import User from "@/models/User";
import { requireAuth } from "@/lib/auth/guards";
import { fail, ok, guardRateLimit } from "@/lib/api";
import { getMfaBootstrapOtpMaxAttempts, hashMfaBootstrapOtp } from "@/lib/auth/mfa-bootstrap";
import { issueAuthSession } from "@/lib/auth/session";

export async function POST(request) {
  const limited = guardRateLimit(request, "auth.2fa.bootstrap.verify", 10, 60_000);
  if (limited) return limited;
  const auth = await requireAuth(["admin", "support"], { requireMfa: false });
  if (auth.error) return auth.error;
  await connectDB();
  const body = await request.json().catch(() => ({}));
  const token = String(body.token || "").trim();
  if (!token) return fail("Email verification code is required", 400);

  const user = await User.findById(auth.payload.sub);
  if (!user) return fail("User not found", 404);
  if (user.mfaEnabled) return ok({ message: "MFA already enabled" });
  if (!user.mfaSetupOtpHash || !user.mfaSetupOtpExpiresAt) return fail("Verification code not requested", 400);
  if (new Date(user.mfaSetupOtpExpiresAt).getTime() < Date.now()) return fail("Verification code expired", 401);

  const attempts = Number(user.mfaSetupOtpAttempts || 0);
  if (attempts >= getMfaBootstrapOtpMaxAttempts()) return fail("Too many invalid attempts. Request a new code.", 429);

  const hash = hashMfaBootstrapOtp(token);
  if (hash !== user.mfaSetupOtpHash) {
    user.mfaSetupOtpAttempts = attempts + 1;
    await user.save();
    return fail("Invalid verification code", 401);
  }

  user.mfaSetupOtpHash = "";
  user.mfaSetupOtpExpiresAt = null;
  user.mfaSetupOtpAttempts = 0;
  user.mfaSetupVerifiedAt = new Date();
  await user.save();

  await issueAuthSession({
    sub: user._id.toString(),
    role: user.role,
    username: user.username,
    isActivated: Boolean(user.isActivated),
    mfa_verified: false,
    mfa_setup_verified: true,
  });

  return ok({ message: "Email verified. Continue MFA setup." });
}
