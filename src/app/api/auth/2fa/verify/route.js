import connectDB from "@/lib/db";
import User from "@/models/User";
import { requireAuth } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/api";
import { generateBackupCodes, hashBackupCode, normalizeTotpSecret, verifyTotp } from "@/lib/auth/totp";
import { issueAuthSession } from "@/lib/auth/session";

export async function POST(request) {
  const auth = await requireAuth(["admin", "support"], { requireMfa: false });
  if (auth.error) return auth.error;
  await connectDB();
  const body = await request.json().catch(() => ({}));
  const token = String(body.token || "").trim();
  const user = await User.findById(auth.payload.sub);
  if (!user) return fail("User not found", 404);
  if (user.mfaEnabled) return fail("MFA is already enabled. Sign in with your authenticator code.", 400);
  if (!auth.payload.mfa_setup_verified) {
    return fail("Email verification required before MFA setup", 403);
  }
  const setupSecret = normalizeTotpSecret(user.mfaTempSecret);
  if (!setupSecret) {
    return fail("MFA setup required. Open the QR step again to refresh your setup.", 400);
  }
  if (!verifyTotp({ secret: setupSecret, token })) return fail("Invalid MFA code", 401);
  const backupCodes = generateBackupCodes(8);
  user.mfaSecret = setupSecret;
  user.mfaTempSecret = "";
  user.mfaEnabled = true;
  user.mfaLastVerifiedAt = new Date();
  user.mfaBackupCodeHashes = backupCodes.map(hashBackupCode);
  await user.save();
  await issueAuthSession({
    sub: user._id.toString(),
    role: user.role,
    username: user.username,
    isActivated: Boolean(user.isActivated),
    mfa_verified: true,
    mfa_setup_verified: false,
  });
  return ok({ message: "MFA enabled", data: { backupCodes } });
}
