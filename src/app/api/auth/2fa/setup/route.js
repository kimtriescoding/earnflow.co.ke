import connectDB from "@/lib/db";
import User from "@/models/User";
import { requireAuth } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/api";
import { buildOtpAuthUrl, generateMfaEnrollment, normalizeTotpSecret } from "@/lib/auth/totp";

export async function POST() {
  const auth = await requireAuth(["admin", "support"], { requireMfa: false });
  if (auth.error) return auth.error;
  await connectDB();
  const user = await User.findById(auth.payload.sub);
  if (!user) return fail("User not found", 404);
  if (!user.mfaEnabled && !auth.payload.mfa_setup_verified) {
    return fail("Email verification required before MFA setup", 403);
  }
  const accountName = user.email || user.username;
  let tempSecret = normalizeTotpSecret(user.mfaTempSecret);
  let otpAuthUrl;
  if (!tempSecret) {
    const enrollment = generateMfaEnrollment({ accountName });
    tempSecret = enrollment.base32;
    otpAuthUrl = enrollment.otpauth_url;
    user.mfaTempSecret = tempSecret;
    await user.save();
  } else {
    if (user.mfaTempSecret !== tempSecret) {
      user.mfaTempSecret = tempSecret;
      await user.save();
    }
    otpAuthUrl = buildOtpAuthUrl({ accountName, secret: tempSecret });
  }
  return ok({
    data: {
      secret: tempSecret,
      otpAuthUrl,
    },
  });
}
