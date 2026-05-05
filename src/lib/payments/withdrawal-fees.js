export const DEFAULT_WITHDRAWAL_FEE_TIERS = [
  { minAmount: 220, maxAmount: 500, fee: 20 },
  { minAmount: 500, maxAmount: 10000, fee: 50 },
  { minAmount: 10000, maxAmount: 20000, fee: 100 },
  { minAmount: 20000, maxAmount: null, fee: 120 },
];

export function normalizeWithdrawalFeeMode(mode) {
  const normalized = String(mode || "").toLowerCase();
  if (normalized === "percentage") return "percentage";
  if (normalized === "tiers") return "tiers";
  return "fixed";
}

export function sanitizeWithdrawalFeeTiers(rawTiers) {
  const source = Array.isArray(rawTiers) && rawTiers.length ? rawTiers : DEFAULT_WITHDRAWAL_FEE_TIERS;
  const normalized = source
    .map((tier) => {
      const minAmount = Number(tier?.minAmount ?? tier?.min_amount ?? tier?.min ?? 0);
      const maxSource = tier?.maxAmount ?? tier?.max_amount ?? tier?.max;
      const maxNum = Number(maxSource);
      // Blank / missing → no cap. 0 or negative max must not mean "only amount zero matches"
      // (common bad payload: Number("") === 0 or legacy saves).
      const maxUnset =
        maxSource === null ||
        maxSource === undefined ||
        (typeof maxSource === "string" && maxSource.trim() === "") ||
        !Number.isFinite(maxNum) ||
        maxNum <= 0;
      const hasMax = !maxUnset;
      const maxAmount = hasMax ? maxNum : null;
      const fee = Number(tier?.fee ?? tier?.tier_fee ?? tier?.withdrawalFee ?? 0);
      return {
        minAmount: Number.isFinite(minAmount) ? Math.max(0, Number(minAmount.toFixed(2))) : 0,
        maxAmount: hasMax && Number.isFinite(maxAmount) ? Math.max(0, Number(maxAmount.toFixed(2))) : null,
        fee: Number.isFinite(fee) ? Math.max(0, Number(fee.toFixed(2))) : 0,
      };
    })
    .sort((a, b) => a.minAmount - b.minAmount);
  return normalized.length ? normalized : DEFAULT_WITHDRAWAL_FEE_TIERS;
}

function feeFromTiers(amount, tiers) {
  const a = Math.max(0, Number(amount) || 0);
  const normalizedTiers = sanitizeWithdrawalFeeTiers(tiers);
  const exact = normalizedTiers.find((tier) => {
    const minPass = a >= tier.minAmount;
    const maxPass = tier.maxAmount == null ? true : a <= tier.maxAmount;
    return minPass && maxPass;
  });
  if (exact) {
    return Number(Math.max(0, Number(exact.fee || 0)).toFixed(2));
  }
  // Gaps or amounts above an explicit top max: use the tier with the highest min still ≤ amount.
  const eligible = normalizedTiers.filter((t) => a >= t.minAmount);
  if (!eligible.length) return 0;
  const picked = eligible.reduce((best, t) => (t.minAmount > best.minAmount ? t : best));
  return Number(Math.max(0, Number(picked.fee || 0)).toFixed(2));
}

export function computeWithdrawalFee(amount, mode, feeValue, tiers = DEFAULT_WITHDRAWAL_FEE_TIERS) {
  const a = Math.max(0, Number(amount) || 0);
  const normalizedMode = normalizeWithdrawalFeeMode(mode);
  if (normalizedMode === "percentage") {
    return Number(((a * Math.max(0, Number(feeValue || 0))) / 100).toFixed(2));
  }
  if (normalizedMode === "tiers") {
    return feeFromTiers(a, tiers);
  }
  return Number(Math.max(0, Number(feeValue || 0)).toFixed(2));
}

export function maxPayoutForBalance(balance, mode, feeValue, tiers = DEFAULT_WITHDRAWAL_FEE_TIERS) {
  const available = Math.max(0, Number(balance) || 0);
  const normalizedMode = normalizeWithdrawalFeeMode(mode);
  if (available <= 0) return 0;
  if (normalizedMode === "percentage") {
    let lo = 0;
    let hi = available;
    for (let i = 0; i < 45; i++) {
      const mid = Number(((lo + hi) / 2).toFixed(2));
      const total = Number((mid + computeWithdrawalFee(mid, "percentage", feeValue, tiers)).toFixed(2));
      if (total <= available + 0.0001) lo = mid;
      else hi = mid;
    }
    let p = Math.floor(lo);
    while (p > 0) {
      const total = Number((p + computeWithdrawalFee(p, "percentage", feeValue, tiers)).toFixed(2));
      if (total <= available + 0.0001) break;
      p -= 1;
    }
    return Math.max(0, p);
  }
  if (normalizedMode === "tiers") {
    const normalizedTiers = sanitizeWithdrawalFeeTiers(tiers);
    let best = 0;
    for (const tier of normalizedTiers) {
      const capByBalance = Math.floor(Math.max(0, available - tier.fee));
      const capByTier = tier.maxAmount == null ? capByBalance : Math.min(capByBalance, Math.floor(tier.maxAmount));
      if (capByTier >= Math.ceil(tier.minAmount)) {
        best = Math.max(best, capByTier);
      }
    }
    return Math.max(0, best);
  }
  const fee = computeWithdrawalFee(0, "fixed", feeValue, tiers);
  return Math.max(0, Math.floor(available - fee));
}
