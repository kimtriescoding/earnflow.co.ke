import crypto from "node:crypto";
import speakeasy from "speakeasy";
import { getEnv } from "../env.js";

/**
 * Base32 TOTP secrets (Google Authenticator): trim, strip spaces, uppercase.
 * Stored value must match what otpauth URLs use.
 */
export function normalizeTotpSecret(secret) {
  return String(secret ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

/**
 * Random Base32 secret only (no URL). Prefer {@link generateMfaEnrollment} for new enrollments.
 * @see https://github.com/speakeasyjs/speakeasy#generating-a-key
 */
export function generateTotpSecret() {
  const key = speakeasy.generateSecret({
    length: 20,
    symbols: false,
    otpauth_url: false,
  });
  return normalizeTotpSecret(key.base32);
}

/**
 * Speakeasy-recommended enrollment: one `generateSecret()` → store `base32`, show `otpauth_url` in QR.
 * Keeps the scanned secret identical to what we verify.
 */
export function generateMfaEnrollment({ accountName }) {
  const issuer = getEnv().ADMIN_TOTP_ISSUER;
  const label = `${issuer}:${accountName}`;
  const key = speakeasy.generateSecret({
    length: 20,
    symbols: false,
    name: label,
    otpauth_url: true,
  });
  return {
    base32: normalizeTotpSecret(key.base32),
    otpauth_url: key.otpauth_url,
  };
}

/**
 * Build otpauth:// when we only have a persisted Base32 secret (e.g. reused pending secret).
 * New enrollments should use {@link generateMfaEnrollment} instead.
 */
export function buildOtpAuthUrl({ accountName, secret }) {
  const issuer = getEnv().ADMIN_TOTP_ISSUER;
  const normalized = normalizeTotpSecret(secret);
  return speakeasy.otpauthURL({
    secret: normalized,
    label: `${issuer}:${accountName}`,
    issuer,
    encoding: "base32",
    type: "totp",
    algorithm: "sha1",
    digits: 6,
    period: 30,
  });
}

function parseOtpDigits(token) {
  const raw =
    typeof token === "string" ? token.trim().replace(/\s/g, "") : String(token || "").trim().replace(/\s/g, "");
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  return { rawLen: raw.length, digits, validSix: /^\d{6}$/.test(digits) };
}

function totpWindow(explicit) {
  if (explicit != null && Number.isFinite(explicit) && explicit > 0) return explicit;
  try {
    return getEnv().TOTP_VERIFY_WINDOW;
  } catch {
    return 24;
  }
}

/**
 * Verify a 6-digit TOTP. **Must** use `encoding: 'base32'` — default `'ascii'` breaks
 * verification for standard authenticator secrets.
 *
 * @param {{ secret: string; token: string; window?: number }} opts
 * `window` = Speakeasy steps each side of current interval (default from `TOTP_VERIFY_WINDOW` env, 24 ≈ ±12 min).
 */
export function verifyTotp({ secret, token, window: windowOpt }) {
  const normalizedSecret = normalizeTotpSecret(secret);
  if (!normalizedSecret) return false;

  const { digits, validSix } = parseOtpDigits(token);
  if (!validSix) return false;

  const window = totpWindow(windowOpt);

  return speakeasy.totp.verify({
    secret: normalizedSecret,
    encoding: "base32",
    token: digits,
    window,
    algorithm: "sha1",
    digits: 6,
    step: 30,
  });
}

export function generateBackupCodes(count = 8) {
  return Array.from({ length: count }, () => crypto.randomBytes(4).toString("hex"));
}

export function hashBackupCode(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}
