/**
 * Revenue / tally semantics: only explicit boolean `false` is non-real.
 * Legacy documents omit `real` or may carry non-boolean noise — those count as real.
 */

/** @param {unknown} value */
export function isExplicitBooleanFalse(value) {
  return value === false;
}

/**
 * @param {{ real?: unknown } | null | undefined} doc
 * @returns {boolean}
 */
export function isTransactionRealForRevenue(doc) {
  if (!doc || typeof doc !== "object") return true;
  return !isExplicitBooleanFalse(doc.real);
}

/**
 * @param {unknown} metadata
 * @returns {boolean}
 */
export function isMetadataRealFlagForRevenue(metadata) {
  if (!metadata || typeof metadata !== "object") return true;
  return !isExplicitBooleanFalse(metadata.real);
}

/** MongoDB: match rows that count toward real revenue (legacy-safe). */
export const MATCH_TRANSACTION_REAL_FOR_REVENUE = { $nor: [{ real: false }] };

/** ActivationPayment / topup drafts: `metadata.real` only when boolean false is non-real. */
export const MATCH_METADATA_REAL_FOR_REVENUE = { $nor: [{ "metadata.real": false }] };
