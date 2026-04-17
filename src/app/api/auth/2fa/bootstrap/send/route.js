import connectDB from "@/lib/db";
import User from "@/models/User";
import { requireAuth } from "@/lib/auth/guards";
import { fail, ok, guardRateLimit } from "@/lib/api";
import { createMfaBootstrapOtp } from "@/lib/auth/mfa-bootstrap";
import { sendMfaSetupOtpEmail } from "@/lib/email-utils";

export async function POST(request) {
  const limited = guardRateLimit(request, "auth.2fa.bootstrap.send", 4, 60_000);
  if (limited) return limited;
  const auth = await requireAuth(["admin", "support"], { requireMfa: false });
  if (auth.error) return auth.error;
  await connectDB();
  const user = await User.findById(auth.payload.sub);
  if (!user) return fail("User not found", 404);
  if (user.mfaEnabled) return ok({ message: "MFA already enabled" });

  const bootstrapOtp = createMfaBootstrapOtp();
  user.mfaSetupOtpHash = bootstrapOtp.hash;
  user.mfaSetupOtpExpiresAt = bootstrapOtp.expiresAt;
  user.mfaSetupOtpAttempts = 0;
  user.mfaSetupVerifiedAt = null;
  await user.save();

  await sendMfaSetupOtpEmail({
    to: user.email,
    username: user.username,
    otp: bootstrapOtp.value,
  });

  return ok({ message: "Verification code sent to your email." });
}
