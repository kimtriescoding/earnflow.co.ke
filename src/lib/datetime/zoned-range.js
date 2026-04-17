/**
 * Civil calendar helpers for a fixed IANA time zone (used with APP_TIME_ZONE / dashboards).
 * No DST edge-case guarantees beyond what Intl provides.
 */

export function labelInTimeZone(date, timeZone) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/**
 * First UTC instant whose calendar label in `timeZone` is `yyyyMmDd`
 * (start of that civil day in the zone).
 */
export function startOfNamedDayInZone(yyyyMmDd, timeZone) {
  const [Y, M, D] = yyyyMmDd.split("-").map(Number);
  if (!Number.isFinite(Y) || !Number.isFinite(M) || !Number.isFinite(D)) {
    throw new Error("invalid date parts");
  }
  let lo = Date.UTC(Y, M - 1, D - 1, 0, 0, 0);
  let hi = Date.UTC(Y, M - 1, D + 2, 0, 0, 0);
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const label = labelInTimeZone(new Date(mid), timeZone);
    if (label < yyyyMmDd) lo = mid + 1;
    else hi = mid;
  }
  return new Date(lo);
}

export function addCalendarDaysGregorian(yyyyMmDd, deltaDays) {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + deltaDays)).toISOString().slice(0, 10);
}

export function enumerateInclusiveDays(fromYmd, toYmd) {
  const out = [];
  let k = fromYmd;
  for (;;) {
    out.push(k);
    if (k === toYmd) break;
    k = addCalendarDaysGregorian(k, 1);
  }
  return out;
}

/** Inclusive day count from `fromYmd` through `toYmd` (ISO strings). */
export function inclusiveDayCount(fromYmd, toYmd) {
  return enumerateInclusiveDays(fromYmd, toYmd).length;
}

/**
 * UTC bounds covering every timestamp that falls on [fromYmd, toYmd] in `timeZone`.
 * Match with: `field: { $gte: start, $lt: endExclusive }`.
 */
export function rangeBoundsUtc(fromYmd, toYmd, timeZone) {
  const start = startOfNamedDayInZone(fromYmd, timeZone);
  const endExclusive = startOfNamedDayInZone(addCalendarDaysGregorian(toYmd, 1), timeZone);
  return { start, endExclusive };
}

export function todayYmdInZone(timeZone) {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}

export function defaultRollingRangeYmd({ days, timeZone }) {
  const toYmd = todayYmdInZone(timeZone);
  const fromYmd = addCalendarDaysGregorian(toYmd, -(days - 1));
  return { fromYmd, toYmd };
}

export function isValidIsoCalendarDay(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}
