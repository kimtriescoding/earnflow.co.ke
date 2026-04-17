const DEFAULT_API_BASE_URL = process.env.WAVEPAY_API_BASE_URL;
const DEFAULT_PAYOUT_API_BASE_URL = process.env.WAVEPAY_PAYOUT_API_BASE_URL;
import { logInfo, logError } from "@/lib/observability/logger";

export const createAuthorizationKey = ({ publicKey, privateKey, amount, walletId, timestamp, identifier }) => {
  if (!publicKey || !privateKey || !walletId) {
    throw new Error("publicKey, privateKey and walletId are required");
  }
  if (typeof amount !== "number") throw new Error("amount must be a number");
  // ZetuPay/WavePay validates this as a JS-style UNIX time (milliseconds). Seconds read as ~1970 → "expired".
  const tsMs = typeof timestamp === "number" && timestamp > 0 ? timestamp : Date.now();
  const payload = {
    publicKey,
    privateKey,
    amount,
    walletId,
    timestamp: tsMs,
    identifier,
  };
  const json = JSON.stringify(payload);
  if (typeof Buffer !== "undefined") return Buffer.from(json, "utf8").toString("base64");
  return btoa(unescape(encodeURIComponent(json)));
};

export const createPayoutAuthorizationKey = ({
  publicKey,
  privateKey,
  amount,
  walletId,
  timestamp,
  identifier,
  phoneNumber,
}) => {
  if (!publicKey || !privateKey || !walletId) {
    throw new Error("publicKey, privateKey and walletId are required");
  }
  if (typeof amount !== "number") throw new Error("amount must be a number");
  const payload = {
    publicKey,
    privateKey,
    amount,
    walletId,
    timestamp: timestamp || Date.now(),
    identifier,
    phoneNumber,
  };
  const json = JSON.stringify(payload);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(json, "utf8").toString("base64");
  }
  return btoa(unescape(encodeURIComponent(json)));
};

export const initiateCheckout = async ({
  publicKey,
  privateKey,
  walletId,
  amount,
  reference,
  redirectUrl,
  currency = "KES",
  phoneNumber,
  fetchImpl,
  identifier,
}) => {
  const fetcher = fetchImpl || (typeof fetch !== "undefined" ? fetch : null);
  if (!fetcher) throw new Error("No fetch implementation available");
  const tsMs = Date.now();
  const authorizationKey = createAuthorizationKey({ publicKey, privateKey, amount, walletId, identifier, timestamp: tsMs });
  logInfo("wavepay.initiate.request", {
    amount,
    identifier,
    reference,
    url: DEFAULT_API_BASE_URL,
    timestamp: tsMs,
  });
  const initiateRes = await fetcher(DEFAULT_API_BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ authorizationKey, amount, identifier, reference, redirectUrl, currency, phoneNumber }),
  });
  const initiateData = await initiateRes.json().catch(() => ({}));
  if (!initiateRes.ok || !initiateData?.success) {
    logError("wavepay.initiate.error", {
      status: initiateRes.status,
      statusText: initiateRes.statusText,
      amount,
      identifier,
      reference,
      timestamp: tsMs,
      response: initiateData,
    });
    return {
      success: false,
      checkoutUrl: undefined,
      paymentKey: undefined,
      error: initiateData?.message || initiateData?.error || "Failed to initiate checkout",
    };
  }
  const { paymentKey, checkoutUrl } = initiateData.data || {};
  if (!paymentKey) {
    return {
      success: false,
      checkoutUrl: undefined,
      paymentKey: undefined,
      error: "Checkout response missing payment key",
    };
  }
  return { success: true, checkoutUrl, paymentKey };
};

export const initiatePayout = async ({
  publicKey,
  privateKey,
  walletId,
  amount,
  currency = "KES",
  fetchImpl,
  identifier,
  phoneNumber,
}) => {
  const fetcher = fetchImpl || (typeof fetch !== "undefined" ? fetch : null);
  if (!fetcher) throw new Error("No fetch implementation available");
  const authorizationKey = createPayoutAuthorizationKey({
    publicKey,
    privateKey,
    amount,
    walletId,
    identifier,
    phoneNumber,
  });
  const payoutRes = await fetcher(DEFAULT_PAYOUT_API_BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ authorizationKey, amount, identifier, currency, phoneNumber }),
  });
  const payoutData = await payoutRes.json().catch(() => ({}));
  if (!payoutRes.ok || !payoutData?.success) {
    return { success: false, error: payoutData.error || "Failed to initiate payout" };
  }
  return { success: true, error: null };
};
