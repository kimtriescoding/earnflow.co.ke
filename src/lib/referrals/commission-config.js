import connectDB from "@/lib/db";
import { getSetting } from "@/models/Settings";
import ModuleConfig from "@/models/ModuleConfig";

const FALLBACK_RULES = {
  level1: { enabled: true, amount: 0 },
  level2: { enabled: true, amount: 0 },
  level3: { enabled: true, amount: 0 },
};

function normalizeRules(raw) {
  if (!raw || typeof raw !== "object") return null;
  const out = {};
  for (let level = 1; level <= 3; level += 1) {
    const k = `level${level}`;
    const row = raw[k];
    if (!row || typeof row !== "object") continue;
    out[k] = {
      enabled: Boolean(row.enabled),
      amount: Number(Number(row.amount ?? 0).toFixed(2)) || 0,
    };
  }
  if (!out.level1 && !out.level2 && !out.level3) return null;
  for (let level = 1; level <= 3; level += 1) {
    const k = `level${level}`;
    if (!out[k]) out[k] = { enabled: true, amount: 0 };
  }
  return out;
}

/**
 * Admin economy saves `referral_commissions` on Settings; legacy code used ModuleConfig.
 * Order: Settings → ModuleConfig → safe zero defaults (no accidental payouts).
 */
export async function loadReferralCommissionRules() {
  await connectDB();
  const fromSettings = normalizeRules(await getSetting("referral_commissions", null));
  if (fromSettings) return fromSettings;
  const mod = await ModuleConfig.findOne({ key: "referral_commissions" }).lean();
  const fromModule = normalizeRules(mod?.value);
  if (fromModule) return fromModule;
  return { ...FALLBACK_RULES };
}
