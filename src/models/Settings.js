import mongoose from "mongoose";
import { getModel } from "./_model";
import { getCache, setCache } from "@/lib/cache/config-cache";

const schema = new mongoose.Schema(
  {
    key: { type: String, unique: true, required: true, index: true },
    value: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

const Settings = getModel("Settings", schema);
export default Settings;

export async function getSetting(key, fallback = null) {
  const cacheKey = `settings:${key}`;
  const hit = getCache(cacheKey);
  if (hit) return hit;
  const doc = await Settings.findOne({ key }).lean();
  const value = doc?.value ?? fallback;
  setCache(cacheKey, value, 20_000);
  return value;
}

export async function getZetupayCredentials(hasReferrer = false) {
  const primaryKey = hasReferrer ? "zetupay_referral" : "zetupay_primary";
  const legacyKey = hasReferrer ? "wavepay_referral" : "wavepay_primary";
  const raw = (await getSetting(primaryKey, null)) || (await getSetting(legacyKey, null));
  if (!raw || typeof raw !== "object") return { error: "Zetupay credentials missing" };
  const publicKey = String(raw.publicKey ?? "").trim();
  const privateKey = String(raw.privateKey ?? "").trim();
  const walletId = String(raw.walletId ?? "").trim();
  if (!publicKey || !privateKey || !walletId) {
    return { error: "Zetupay credentials missing" };
  }
  return { publicKey, privateKey, walletId };
}

// Backward-compatible export name to avoid breaking older imports.
export const getWavePayCredentials = getZetupayCredentials;
