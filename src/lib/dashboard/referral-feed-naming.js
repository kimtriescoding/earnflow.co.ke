/** Stable `source` / `kind` slug for upline referral signup payouts (L1–L3). */
export function referralUplineSourceSlug(level) {
  const n = Math.min(3, Math.max(1, Math.floor(Number(level)) || 1));
  return `referral_l${n}`;
}

/** One-line label for referral signup bonuses (matches ledger description when present). */
export function referralSignupBonusLabel(level, description) {
  const desc = String(description || "").trim();
  if (desc) return desc;
  const n = Math.min(3, Math.max(1, Math.floor(Number(level)) || 1));
  return `Referral bonus (level ${n})`;
}
