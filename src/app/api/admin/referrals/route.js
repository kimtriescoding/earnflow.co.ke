import connectDB from "@/lib/db";
import User from "@/models/User";
import ReferralCommission from "@/models/ReferralCommission";
import { requireAuth } from "@/lib/auth/guards";
import { ok } from "@/lib/api";

export async function GET(request) {
  const auth = await requireAuth(["admin", "support"]);
  if (auth.error) return auth.error;
  await connectDB();
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") || 1);
  const pageSize = Math.min(100, Number(searchParams.get("pageSize") || 20));
  const search = String(searchParams.get("search") || "").trim();

  const userFilter = search
    ? { $or: [{ username: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }] }
    : {};

  const [users, totalUsers, linkedL1, linkedL2, linkedL3, matchingUserIds] = await Promise.all([
    User.find(userFilter).select("username email referredByUserId uplineL1UserId uplineL2UserId uplineL3UserId").sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    User.countDocuments(userFilter),
    User.countDocuments({ ...userFilter, referredByUserId: { $exists: true, $ne: null } }),
    User.countDocuments({ ...userFilter, uplineL2UserId: { $exists: true, $ne: null } }),
    User.countDocuments({ ...userFilter, uplineL3UserId: { $exists: true, $ne: null } }),
    User.find(userFilter).select("_id").lean(),
  ]);

  const ids = matchingUserIds.map((u) => u._id);
  const [pageCommissionRows, commissionTotals] = await Promise.all([
    ReferralCommission.aggregate([
      { $match: { beneficiaryUserId: { $in: users.map((u) => u._id) } } },
      { $group: { _id: "$beneficiaryUserId", total: { $sum: "$amount" } } },
    ]),
    ids.length
      ? ReferralCommission.aggregate([
          { $match: { beneficiaryUserId: { $in: ids } } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ])
      : [],
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

  return ok({
    data,
    total: totalUsers,
    page,
    pageSize,
    summary: {
      totalUsers,
      linkedL1,
      linkedL2,
      linkedL3,
      totalCommissions: Number(commissionTotals[0]?.total || 0),
    },
  });
}
