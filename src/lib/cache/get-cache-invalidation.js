import { createTtlCache } from "@/lib/cache/ttl-cache";
import { invalidateAviatorUserReadCache } from "@/lib/aviator/read-cache";

export const DASHBOARD_SUMMARY_CACHE = createTtlCache("dashboard-summary", 60_000);
export const DASHBOARD_ACTIVITY_CACHE = createTtlCache("dashboard-activity", 20_000);
export const DASHBOARD_TRANSACTIONS_CACHE = createTtlCache("dashboard-transactions", 15_000);
export const DASHBOARD_EARNINGS_SERIES_CACHE = createTtlCache("dashboard-earnings-series", 30_000);
export const DASHBOARD_AFFILIATE_CACHE = createTtlCache("dashboard-affiliate-network", 30_000);
export const ADMIN_ANALYTICS_RANGE_CACHE = createTtlCache("admin-analytics-range", 120_000);
export const ADMIN_ANALYTICS_ALLTIME_CACHE = createTtlCache("admin-analytics-alltime", 600_000);
export const ADMIN_SUMMARY_CACHE = createTtlCache("admin-summary", 90_000);
export const ADMIN_WITHDRAWALS_CACHE = createTtlCache("admin-withdrawals", 30_000);
export const ADMIN_SWITCHER_CACHE = createTtlCache("admin-switcher", 8_000);
export const NOTIFICATIONS_CACHE = createTtlCache("user-notifications", 12_000);
export const SPIN_CONFIG_CACHE = createTtlCache("spin-config", 2_000);

export function invalidateDashboardUserCaches(userId) {
  const id = String(userId || "");
  if (!id) return;
  DASHBOARD_SUMMARY_CACHE.delete(id);
  DASHBOARD_ACTIVITY_CACHE.deleteByPrefix(`${id}|`);
  DASHBOARD_TRANSACTIONS_CACHE.deleteByPrefix(`${id}|`);
  DASHBOARD_EARNINGS_SERIES_CACHE.delete(id);
  DASHBOARD_AFFILIATE_CACHE.delete(id);
}

export function invalidateAdminCaches() {
  ADMIN_SUMMARY_CACHE.delete("global");
  ADMIN_ANALYTICS_ALLTIME_CACHE.delete("global");
  ADMIN_ANALYTICS_RANGE_CACHE.clear();
  ADMIN_WITHDRAWALS_CACHE.clear();
}

export function invalidateAdminWithdrawalsListCaches() {
  ADMIN_WITHDRAWALS_CACHE.clear();
}

export function invalidateAdminAnalyticsRange(cacheKey) {
  if (cacheKey) ADMIN_ANALYTICS_RANGE_CACHE.delete(cacheKey);
}

export function invalidateAviatorUser(userId) {
  invalidateAviatorUserReadCache(userId);
}

export function invalidateNotifications(userId) {
  NOTIFICATIONS_CACHE.delete(String(userId || ""));
}
