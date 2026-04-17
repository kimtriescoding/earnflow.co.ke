import crypto from "node:crypto";

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

export function createMfaBootstrapOtp() {
  const value = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  return {
    value,
    hash: hashMfaBootstrapOtp(value),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  };
}

export function hashMfaBootstrapOtp(value) {
  return crypto.createHash("sha256").update(String(value).trim()).digest("hex");
}

export function getMfaBootstrapOtpMaxAttempts() {
  return OTP_MAX_ATTEMPTS;
}
