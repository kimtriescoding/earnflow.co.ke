import { getSetting } from "@/models/Settings";

const DEFAULT_FEE = 100;
const DEFAULT_REFERRER_BONUS = 40;

function toAmount(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return Number(numeric.toFixed(2));
}

export async function resolveChatUnlockConfig() {
  const config = await getSetting("chat_unlock", {});
  const fee = config?.fee === undefined ? DEFAULT_FEE : toAmount(config.fee, DEFAULT_FEE);
  const referrerBonus =
    config?.referrerBonus === undefined ? DEFAULT_REFERRER_BONUS : toAmount(config.referrerBonus, DEFAULT_REFERRER_BONUS);
  return { fee, referrerBonus };
}

export const CHAT_UNLOCK_DEFAULTS = { fee: DEFAULT_FEE, referrerBonus: DEFAULT_REFERRER_BONUS };
