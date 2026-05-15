import connectDB from "@/lib/db";
import EarningEvent from "@/models/EarningEvent";
import ReferralCommission from "@/models/ReferralCommission";
import Transaction from "@/models/Transaction";
import { requireAuth } from "@/lib/auth/guards";
import { ok } from "@/lib/api";
import { referralUplineSourceSlug } from "@/lib/dashboard/referral-feed-naming";
import { getSetting } from "@/models/Settings";
import { isEarningSourceEnabled, normalizeModuleAccess } from "@/lib/modules/module-access";
import { DASHBOARD_ACTIVITY_CACHE } from "@/lib/cache/get-cache-invalidation";
import { createGetTimer, withPrivateCacheControl } from "@/lib/observability/get-timing";

function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") return {};
  const safe = { ...metadata };
  delete safe.real;
  return safe;
}

function buildActivityCacheKey(userId, { page, pageSize, source, status }) {
  return `${userId}|${page}|${pageSize}|${source}|${status}`;
}

export async function GET(request) {
  const timer = createGetTimer("api_dashboard_activity");
  const auth = await requireAuth(["user", "admin"]);
  if (auth.error) return auth.error;
  await connectDB();
  const moduleAccess = normalizeModuleAccess(await getSetting("module_status", {}));
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") || 1);
  const pageSize = Math.min(100, Number(searchParams.get("pageSize") || 20));
  const source = String(searchParams.get("source") || "").trim();
  const status = String(searchParams.get("status") || "").trim();

  const boundedPage = Math.max(1, page);
  const cacheKey = buildActivityCacheKey(auth.payload.sub, {
    page: boundedPage,
    pageSize,
    source,
    status,
  });
  const cached = DASHBOARD_ACTIVITY_CACHE.get(cacheKey);
  if (cached) {
    timer.markCacheHit();
    return timer.finish(withPrivateCacheControl(ok(cached), 15));
  }

  const feedWindow = Math.min(220, Math.max(pageSize * boundedPage * 2, 80));
  const shouldIncludeNonEarnings = !source;
  const [events, commissions, transactions] = await Promise.all([
    EarningEvent.find({
      userId: auth.payload.sub,
      ...(source ? { source } : {}),
      ...(status ? { status } : {}),
    })
      .sort({ createdAt: -1 })
      .limit(feedWindow)
      .lean(),
    shouldIncludeNonEarnings
      ? ReferralCommission.find({ beneficiaryUserId: auth.payload.sub }).sort({ createdAt: -1 }).limit(feedWindow).lean()
      : Promise.resolve([]),
    shouldIncludeNonEarnings
      ? Transaction.find({ userId: auth.payload.sub }).sort({ createdAt: -1 }).limit(feedWindow).lean()
      : Promise.resolve([]),
  ]);

  const commissionsForFeed = shouldIncludeNonEarnings ? commissions.filter((c) => !c.ledgerTransactionId) : [];

  const mergedFull = [
    ...events
      .filter((item) => isEarningSourceEnabled(moduleAccess, item.source, item.metadata))
      .map((item) => ({
        id: item._id.toString(),
        type: "earning",
        source: item.source,
        amount: Number(item.amount || 0),
        status: item.status,
        metadata: item.metadata || {},
        createdAt: item.createdAt,
      })),
    ...commissionsForFeed.map((item) => ({
      id: item._id.toString(),
      type: "referral",
      source: referralUplineSourceSlug(item.level),
      amount: Number(item.amount || 0),
      status: "completed",
      metadata: { level: item.level },
      createdAt: item.createdAt,
    })),
    ...transactions.map((item) => {
      if (item.type === "referral_signup_bonus") {
        const level = Number(item.metadata?.level ?? 1) || 1;
        return {
          id: item._id.toString(),
          type: "referral",
          source: referralUplineSourceSlug(level),
          amount: Number(item.amount || 0),
          status: String(item.status || "completed"),
          metadata: sanitizeMetadata(item.metadata),
          createdAt: item.createdAt,
        };
      }
      return {
        id: item._id.toString(),
        type: "transaction",
        source: item.type,
        amount: Number(item.amount || 0),
        status: item.status,
        metadata: sanitizeMetadata(item.metadata),
        createdAt: item.createdAt,
      };
    }),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const merged = mergedFull.slice((boundedPage - 1) * pageSize, boundedPage * pageSize);

  const payload = { data: merged, total: mergedFull.length, page: boundedPage, pageSize };
  DASHBOARD_ACTIVITY_CACHE.set(cacheKey, payload);
  return timer.finish(withPrivateCacheControl(ok(payload), 15));
}
