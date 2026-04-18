import webpush from "web-push";

const EXPECTED_PUBLIC_KEY_BYTES = 65;

/**
 * Decodes a VAPID public key (URL-safe base64, as printed by `web-push generate-vapid-keys`).
 */
export function decodeVapidPublicKeyBuffer(publicKeyNormalized) {
  if (!publicKeyNormalized || typeof publicKeyNormalized !== "string") {
    return { ok: false, error: "VAPID_PUBLIC_KEY is empty", buf: null, byteLength: 0 };
  }
  let buf;
  try {
    buf = Buffer.from(publicKeyNormalized, "base64url");
  } catch {
    buf = null;
  }
  if (!buf || buf.length === 0) {
    try {
      buf = Buffer.from(publicKeyNormalized.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    } catch {
      return { ok: false, error: "VAPID_PUBLIC_KEY is not valid base64", buf: null, byteLength: 0 };
    }
  }
  if (buf.length !== EXPECTED_PUBLIC_KEY_BYTES) {
    return {
      ok: false,
      error: `VAPID_PUBLIC_KEY decodes to ${buf.length} bytes (expected ${EXPECTED_PUBLIC_KEY_BYTES}). Use the public key from the same \`web-push generate-vapid-keys\` pair as the private key.`,
      buf,
      byteLength: buf.length,
    };
  }
  return { ok: true, error: null, buf, byteLength: buf.length };
}

/**
 * Ensures `web-push` accepts the key pair (catches swapped keys, truncated values, etc.).
 */
export function validateVapidKeyPairForWebPush({ publicKey, privateKey, subject }) {
  const dec = decodeVapidPublicKeyBuffer(publicKey);
  if (!dec.ok) return { ok: false, error: dec.error };
  if (!privateKey || typeof privateKey !== "string" || !privateKey.trim()) {
    return { ok: false, error: "VAPID_PRIVATE_KEY is empty" };
  }
  const subj = subject && String(subject).trim() ? String(subject).trim() : "mailto:notifications@earnflow";
  try {
    webpush.setVapidDetails(subj, publicKey, privateKey);
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e?.message || "web-push rejected this VAPID key pair" };
  }
}
