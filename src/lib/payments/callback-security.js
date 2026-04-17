import crypto from "node:crypto";
import { getEnv } from "../env.js";

function toMoney(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Number(numeric.toFixed(2));
}

function timingSafeStringEqual(a, b) {
  const aa = Buffer.from(String(a), "utf8");
  const bb = Buffer.from(String(b), "utf8");
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

/**
 * ZetuPay sends `x-zetupay-secret`. When admin has saved a private API key, that header must match it (trimmed).
 * If there is no private key in settings, optional `WAVEPAY_CALLBACK_SECRET` in env is used instead.
 * Fail-closed when neither is configured (unless `WAVEPAY_ALLOW_INSECURE_CALLBACKS=true`).
 */
export function isTrustedCallback(request, credentials) {
  const env = getEnv();
  const secret = String(request.headers.get("x-zetupay-secret") ?? "").trim();
  const privateKey = String(credentials?.privateKey ?? "").trim();
  const callbackSecret = String(env.WAVEPAY_CALLBACK_SECRET ?? "").trim();

  if (privateKey) {
    if (!secret) return false;
    return timingSafeStringEqual(secret, privateKey);
  }
  if (callbackSecret) {
    if (!secret) return false;
    return timingSafeStringEqual(secret, callbackSecret);
  }
  if (env.WAVEPAY_ALLOW_INSECURE_CALLBACKS === "true") {
    return true;
  }
  return false;
}

export function validateActivationPayment(activation, payment, expectedAmount) {
  const paidAmount = toMoney(payment?.amount);
  const storedAmount = toMoney(activation?.amount);
  const targetAmount = toMoney(expectedAmount);
  const reference = String(payment?.reference || payment?.referenceNumber || "").trim();
  const storedRef = String(activation?.reference ?? "").trim();

  const amountMatches = paidAmount > 0 && paidAmount === storedAmount && paidAmount === targetAmount;
  // ZetuPay callback payloads do not reliably include paymentKey.
  // Validate with amount + stored reference, while auth is enforced by x-zetupay-secret.
  const paymentKeyMatches = true;
  const referenceMatches = Boolean(storedRef) && Boolean(reference) && reference === storedRef;
  return {
    ok: amountMatches && paymentKeyMatches && referenceMatches,
    paidAmount,
    amountMatches,
    paymentKeyMatches,
    referenceMatches,
  };
}

export function validateClientOrderPayment(clientOrder, payment) {
  const paidAmount = toMoney(payment?.amount);
  const expected = toMoney(clientOrder?.totalAmount);
  const reference = String(payment?.reference || payment?.referenceNumber || "").trim();
  const storedRef = String(clientOrder?.paymentReference ?? "").trim();

  const amountMatches = paidAmount > 0 && paidAmount === expected;
  const paymentKeyMatches = true;
  const referenceMatches = Boolean(storedRef) && Boolean(reference) && reference === storedRef;
  return {
    ok: amountMatches && paymentKeyMatches && referenceMatches,
    paidAmount,
    amountMatches,
    paymentKeyMatches,
    referenceMatches,
  };
}
