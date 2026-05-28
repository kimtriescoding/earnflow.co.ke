import connectDB from "@/lib/db";
import User from "@/models/User";
import ReferralCommission from "@/models/ReferralCommission";
import { requireAuth } from "@/lib/auth/guards";
import { ok } from "@/lib/api";
import { ADMIN_REFERRALS_CACHE } from "@/lib/cache/get-cache-invalidation";

/**
 * Sum of all referral commissions for the users matched by `userFilter`.
 * Avoids the full user x commission $lookup by grouping commissions directly:
 * - no search -> group every commission once,
 * - search -> resolve matching user ids, then match beneficiaryUserId via the indexed field.
 */
async function aggregateTotalCommissionsForUserFilter(userFilter) {
  const hasFilter = userFilter && Object.keys(userFilter).length > 0;
  if (hasFilter) {
    const matchedUserIds = (await User.find(userFilter).select("_id").lean()).map((u) => u._id);
    if (!matchedUserIds.length) return 0;
    const [row] = await ReferralCommission.aggregate([
      { $match: { beneficiaryUserId: { $in: matchedUserIds } } },
      { $group: { _id: null, total: { $sum: { $ifNull: ["$amount", 0] } } } },
    ]);
    return Number(row?.total || 0);
  }
  const [row] = await ReferralCommission.aggregate([
    { $group: { _id: null, total: { $sum: { $ifNull: ["$amount", 0] } } } },
  ]);
  return Number(row?.total || 0);
}

export async function GET(request) {
  const auth = await requireAuth(["admin", "support"]);
  if (auth.error) return auth.error;
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") || 1);
  const pageSize = Math.min(100, Number(searchParams.get("pageSize") || 20));
  const search = String(searchParams.get("search") || "").trim();

  const cacheKey = `${page}|${pageSize}|${search}`;
  const cached = ADMIN_REFERRALS_CACHE.get(cacheKey);
  if (cached) return ok(cached);

  await connectDB();

  const userFilter = search
    ? { $or: [{ username: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }] }
    : {};

  const [users, totalUsers, linkedL1, linkedL2, linkedL3, totalCommissions] = await Promise.all([
    User.find(userFilter)
      .select("username email referredByUserId uplineL1UserId uplineL2UserId uplineL3UserId")
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    User.countDocuments(userFilter),
    User.countDocuments({ ...userFilter, referredByUserId: { $exists: true, $ne: null } }),
    User.countDocuments({ ...userFilter, uplineL2UserId: { $exists: true, $ne: null } }),
    User.countDocuments({ ...userFilter, uplineL3UserId: { $exists: true, $ne: null } }),
    aggregateTotalCommissionsForUserFilter(userFilter),
  ]);

  const pageCommissionRows = await ReferralCommission.aggregate([
    { $match: { beneficiaryUserId: { $in: users.map((u) => u._id) } } },
    { $group: { _id: "$beneficiaryUserId", total: { $sum: "$amount" } } },
  ]);
  const commissionMap = new Map(pageCommissionRows.map((row) => [String(row._id), Number(row.total || 0)]));

  const refIdSet = new Set();
  for (const u of users) {
    for (const key of ["referredByUserId", "uplineL1UserId", "uplineL2UserId", "uplineL3UserId"]) {
      const v = u[key];
      if (v) refIdSet.add(String(v));
    }
  }
  const refIds = [...refIdSet];
  const refUsers = refIds.length ? await User.find({ _id: { $in: refIds } }).select("username").lean() : [];
  const usernameById = new Map(refUsers.map((r) => [String(r._id), String(r.username || "").trim()]));

  const uplineLabel = (id) => {
    if (!id) return null;
    const name = usernameById.get(String(id));
    return name || "—";
  };

  const data = users.map((u) => ({
    ...u,
    referredByUsername: uplineLabel(u.referredByUserId),
    uplineL1Username: uplineLabel(u.uplineL1UserId),
    uplineL2Username: uplineLabel(u.uplineL2UserId),
    uplineL3Username: uplineLabel(u.uplineL3UserId),
    totalReferralCommissions: Number((commissionMap.get(String(u._id)) || 0).toFixed(2)),
  }));

  const result = {
    data,
    total: totalUsers,
    page,
    pageSize,
    summary: {
      totalUsers,
      linkedL1,
      linkedL2,
      linkedL3,
      totalCommissions: Number(totalCommissions.toFixed(2)),
    },
  };
  ADMIN_REFERRALS_CACHE.set(cacheKey, result);
  return ok(result);
}
