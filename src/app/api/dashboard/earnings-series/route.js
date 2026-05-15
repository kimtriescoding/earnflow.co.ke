import connectDB from "@/lib/db";
import EarningEvent from "@/models/EarningEvent";
import { requireAuth } from "@/lib/auth/guards";
import { ok } from "@/lib/api";
import { getSetting } from "@/models/Settings";
import { isEarningSourceEnabled, normalizeModuleAccess } from "@/lib/modules/module-access";
import { DASHBOARD_EARNINGS_SERIES_CACHE } from "@/lib/cache/get-cache-invalidation";
import { createGetTimer, withPrivateCacheControl } from "@/lib/observability/get-timing";
import mongoose from "mongoose";

export async function GET() {
  const timer = createGetTimer("api_dashboard_earnings_series");
  const auth = await requireAuth(["user", "admin"]);
  if (auth.error) return auth.error;
  const userId = String(auth.payload.sub);
  const cached = DASHBOARD_EARNINGS_SERIES_CACHE.get(userId);
  if (cached) {
    timer.markCacheHit();
    return timer.finish(withPrivateCacheControl(ok({ data: cached }), 30));
  }

  await connectDB();
  const moduleAccess = normalizeModuleAccess(await getSetting("module_status", {}));
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const from = new Date(Date.now() - 1000 * 60 * 60 * 24 * 13);
  from.setHours(0, 0, 0, 0);

  const aggRows = await EarningEvent.aggregate([
    {
      $match: {
        userId: userObjectId,
        status: "approved",
        amount: { $gt: 0 },
        createdAt: { $gte: from },
      },
    },
    {
      $project: {
        amount: 1,
        source: 1,
        day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
      },
    },
    {
      $group: {
        _id: { day: "$day", source: "$source" },
        total: { $sum: "$amount" },
      },
    },
  ]);

  const dayMap = new Map();
  for (let i = 0; i < 14; i++) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    dayMap.set(d.toISOString().slice(0, 10), 0);
  }
  const sourceMap = new Map();

  for (const row of aggRows) {
    const source = String(row._id?.source || "");
    const metadata = {};
    if (!isEarningSourceEnabled(moduleAccess, source, metadata)) continue;
    const key = String(row._id?.day || "");
    const amount = Number(row.total || 0);
    dayMap.set(key, (dayMap.get(key) || 0) + amount);
    sourceMap.set(source, (sourceMap.get(source) || 0) + amount);
  }

  const series = Array.from(dayMap.entries()).map(([label, value]) => ({ label, value: Number(value.toFixed(2)) }));
  const breakdown = Array.from(sourceMap.entries()).map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }));
  const data = { series, breakdown };
  DASHBOARD_EARNINGS_SERIES_CACHE.set(userId, data);
  return timer.finish(withPrivateCacheControl(ok({ data }), 30));
}
