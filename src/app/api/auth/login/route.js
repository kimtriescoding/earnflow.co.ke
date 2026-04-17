import connectDB from "@/lib/db";
import User from "@/models/User";
import { verifyPassword } from "@/lib/auth/password";
import { issueAuthSession } from "@/lib/auth/session";
import { ok, fail, guardRateLimit, guardBlockedIp } from "@/lib/api";
import { hashBackupCode, verifyTotp } from "@/lib/auth/totp";
import { createMfaBootstrapOtp } from "@/lib/auth/mfa-bootstrap";
import { sendMfaSetupOtpEmail } from "@/lib/email-utils";
import { logError } from "@/lib/observability/logger";

export async function POST(request) {
  try {
    const blocked = await guardBlockedIp(request);
    if (blocked) return blocked;
    const limited = guardRateLimit(request, "auth.login", 15, 60_000);
    if (limited) return limited;
    await connectDB();
    const body = await request.json().catch(() => null);
    if (!body) return fail("Invalid payload");
    const identifier = String(body.identifier || body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!identifier) return fail("Email or username is required", 400);
    const isEmailLike = identifier.includes("@");
    const user = await User.findOne(isEmailLike ? { email: identifier } : { username: identifier });
    if (!user) return fail("Invalid credentials", 401);
    if (user.isBlocked) return fail("Account blocked", 403);
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return fail("Invalid credentials", 401);
    const isPrivileged = ["admin", "support"].includes(user.role);
    let mfaVerified = true;
    let otpEmailSent = false;
    if (isPrivileged) {
      if (user.mfaEnabled) {
        const otp = String(body.otp || "").trim();
        let verified = verifyTotp({ secret: user.mfaSecret, token: otp });
        if (!verified && otp) {
          const hash = hashBackupCode(otp);
          if (user.mfaBackupCodeHashes.includes(hash)) {
            user.mfaBackupCodeHashes = user.mfaBackupCodeHashes.filter((codeHash) => codeHash !== hash);
            verified = true;
          }
        }
        if (!verified) return fail("MFA code required", 401, { mfaRequired: true, mfaSetupRequired: false });
        user.mfaLastVerifiedAt = new Date();
        await user.save();
        mfaVerified = true;
      } else {
        mfaVerified = false;
        user.mfaTempSecret = "";
        const bootstrapOtp = createMfaBootstrapOtp();
        user.mfaSetupOtpHash = bootstrapOtp.hash;
        user.mfaSetupOtpExpiresAt = bootstrapOtp.expiresAt;
        user.mfaSetupOtpAttempts = 0;
        user.mfaSetupVerifiedAt = null;
        await user.save();
        const sendResult = await sendMfaSetupOtpEmail({
          to: user.email,
          username: user.username,
          otp: bootstrapOtp.value,
        });
        otpEmailSent = Boolean(sendResult?.sent);
      }
    }
    await issueAuthSession(
      {
        sub: user._id.toString(),
        role: user.role,
        username: user.username,
        isActivated: Boolean(user.isActivated),
        mfa_verified: mfaVerified,
        mfa_setup_verified: false,
      },
      { source: "login", ip: request.headers.get("x-forwarded-for") || "unknown" }
    );
    return ok({
      message: "Logged in",
      role: user.role,
      isActivated: Boolean(user.isActivated),
      mfaRequired: isPrivileged,
      mfaSetupRequired: isPrivileged && !user.mfaEnabled,
      mfaBootstrapRequired: isPrivileged && !user.mfaEnabled,
      mfaVerified,
      otpEmailSent,
    });
  } catch (err) {
    logError("auth.login.failed", { error: err?.message || "unknown" });
    return fail("Login failed. Please try again.", 500);
  }
}
