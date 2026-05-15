import connectDB from "@/lib/db";
import { requireAuth } from "@/lib/auth/guards";
import { ok } from "@/lib/api";
import { getUserTransactionFeed } from "@/lib/dashboard/user-transactions";
import { getSetting } from "@/models/Settings";
import { DASHBOARD_TRANSACTIONS_CACHE } from "@/lib/cache/get-cache-invalidation";
import { createGetTimer, withPrivateCacheControl } from "@/lib/observability/get-timing";

export function buildTransactionsCacheKey(userId, page, pageSize) {
  return `${userId}|${page}|${pageSize}`;
}

export async function GET(request) {
  const timer = createGetTimer("api_dashboard_transactions");
  const auth = await requireAuth(["user", "admin"]);
  if (auth.error) return auth.error;
  await connectDB();
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || 50)));
  const cacheKey = buildTransactionsCacheKey(auth.payload.sub, page, pageSize);
  const cached = DASHBOARD_TRANSACTIONS_CACHE.get(cacheKey);
  if (cached) {
    timer.markCacheHit();
    return timer.finish(withPrivateCacheControl(ok({ data: cached }), 15));
  }

  const moduleStatus = await getSetting("module_status", {});
  const payload = await getUserTransactionFeed(auth.payload.sub, { moduleStatus, page, pageSize });
  const data = {
    rows: payload.rows.map((r) => ({
      ...r,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    })),
    summary: payload.summary,
    balances: payload.balances,
    total: payload.total,
    page: payload.page,
    pageSize: payload.pageSize,
  };
  DASHBOARD_TRANSACTIONS_CACHE.set(cacheKey, data);
  return timer.finish(withPrivateCacheControl(ok({ data }), 15));
}
