import { DASHBOARD_EARNINGS_TIMEZONE } from "@/lib/config/dashboard-timezone";

/**
 * Mongo aggregation stage: keep documents whose `fieldPath` falls on the same civil calendar day
 * as `$$NOW` in `timeZone` (matches admin summary / analytics “today”).
 * @param {string} fieldPath e.g. `"$createdAt"`
 * @param {string} [timeZone]
 */
export function mongoMatchSameCalendarDayToday(fieldPath, timeZone = DASHBOARD_EARNINGS_TIMEZONE) {
  return {
    $match: {
      $expr: {
        $eq: [
          { $dateTrunc: { date: fieldPath, unit: "day", timezone: timeZone } },
          { $dateTrunc: { date: "$$NOW", unit: "day", timezone: timeZone } },
        ],
      },
    },
  };
}
