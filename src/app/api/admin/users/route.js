import connectDB from "@/lib/db";
import User from "@/models/User";
import Wallet from "@/models/Wallet";
import { getSetting } from "@/models/Settings";
import { requireAuth } from "@/lib/auth/guards";
import { ok, fail } from "@/lib/api";
import { Types } from "mongoose";
import { ADMIN_MANAGEABLE_ROLES, INTERNAL_ONLY_ROLES, isSuperadminRole } from "@/lib/auth/roles";

function buildSearchFilter(rawSearch) {
  const search = String(rawSearch || "").trim();
  if (!search) return {};

  const terms = search
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)
    .slice(0, 6);
  if (!terms.length) return {};

  return {
    $and: terms.map((term) => {
      const regex = { $regex: term, $options: "i" };
      const or = [{ username: regex }, { email: regex }, { phoneNumber: regex }, { referralCode: regex }, { role: regex }];
      if (Types.ObjectId.isValid(term)) or.push({ _id: new Types.ObjectId(term) });
      return { $or: or };
    }),
  };
}

function parseActivationFilter(searchParams) {
  const raw = String(searchParams.get("activation") || "all").toLowerCase();
  if (raw === "active") return { isActivated: true };
  if (raw === "inactive") return { isActivated: false };
  return {};
}

function parseWithdrawableOnly(searchParams) {
  const w = String(searchParams.get("withdrawableOnly") || "").toLowerCase();
  return w === "1" || w === "true";
}

const walletLookupStages = [
  {
    $lookup: {
      from: "wallets",
      localField: "_id",
      foreignField: "userId",
      as: "_wallets",
    },
  },
  {
    $addFields: {
      withdrawableBalance: {
        $ifNull: [{ $toDouble: { $arrayElemAt: ["$_wallets.availableBalance", 0] } }, 0],
      },
    },
  },
];

async function aggregateTotalWithdrawableKes(userFilter) {
  const [row] = await User.aggregate([
    { $match: userFilter },
    ...walletLookupStages,
    { $group: { _id: null, totalWithdrawableKes: { $sum: "$withdrawableBalance" } } },
  ]);
  return Number(row?.totalWithdrawableKes ?? 0);
}

export async function GET(request) {
  const auth = await requireAuth(["admin", "support"]);
  if (auth.error) return auth.error;
  await connectDB();
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Number(searchParams.get("pageSize") || 20);
  const search = String(searchParams.get("search") || searchParams.get("q") || "").trim();
  const sortBy = String(searchParams.get("sortBy") || "createdAt");
  const sortDir = searchParams.get("sortDir") === "asc" ? 1 : -1;
  const allowedSortFields = new Set(["createdAt", "username", "email", "withdrawableBalance", "role", "isActivated"]);
  const safeSortBy = allowedSortFields.has(sortBy) ? sortBy : "createdAt";
  const searchFilter = buildSearchFilter(search);
  const activationPart = parseActivationFilter(searchParams);
  const hiddenRoleFilter = isSuperadminRole(auth.payload.role) ? {} : { role: { $nin: INTERNAL_ONLY_ROLES } };
  const userFilter = { ...hiddenRoleFilter, ...searchFilter, ...activationPart };
  const withdrawableOnly = parseWithdrawableOnly(searchParams);
  const useAggPath = withdrawableOnly || safeSortBy === "withdrawableBalance";
  const minWithdrawalAmount = Number((await getSetting("min_withdrawal_amount", 0)) ?? 0) || 0;
  const withdrawableMatch = { withdrawableBalance: { $gte: minWithdrawalAmount } };

  const [total, activated, blocked, elevatedRoleCount] = await Promise.all([
    useAggPath
      ? User.aggregate([
          { $match: userFilter },
          ...walletLookupStages,
          ...(withdrawableOnly ? [{ $match: withdrawableMatch }] : []),
          { $count: "n" },
        ]).then((r) => (r[0]?.n ? Number(r[0].n) : 0))
      : User.countDocuments(userFilter),
    User.countDocuments({ ...userFilter, isActivated: true }),
    User.countDocuments({ ...userFilter, isBlocked: true }),
    User.countDocuments({ ...userFilter, role: { $in: ["admin", "support"] } }),
  ]);

  let data;
  let totalWithdrawableKes;

  if (useAggPath) {
    const sortStage =
      safeSortBy === "withdrawableBalance"
        ? { withdrawableBalance: sortDir, _id: -1 }
        : { [safeSortBy]: sortDir, _id: -1 };

    const skip = (page - 1) * pageSize;

    const [facetResult] = await User.aggregate([
      { $match: userFilter },
      ...walletLookupStages,
          ...(withdrawableOnly ? [{ $match: withdrawableMatch }] : []),
      {
        $facet: {
          meta: [{ $group: { _id: null, totalWithdrawableKes: { $sum: "$withdrawableBalance" } } }],
          rows: [
            { $sort: sortStage },
            { $skip: skip },
            { $limit: pageSize },
            { $project: { _wallets: 0, passwordHash: 0 } },
          ],
        },
      },
    ]);

    const meta = facetResult?.meta?.[0];
    totalWithdrawableKes = Number(meta?.totalWithdrawableKes ?? 0);
    data = (facetResult?.rows || []).map((doc) => ({
      ...doc,
      withdrawableBalance: Number(doc.withdrawableBalance || 0),
    }));
  } else {
    const [users, sumKes] = await Promise.all([
      User.find(userFilter)
        .select("-passwordHash")
        .sort({ [safeSortBy]: sortDir, _id: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      aggregateTotalWithdrawableKes(userFilter),
    ]);
    totalWithdrawableKes = sumKes;
    const walletMap = new Map(
      (
        await Wallet.find({
          userId: { $in: users.map((user) => user._id) },
        })
          .select("userId availableBalance")
          .lean()
      ).map((wallet) => [String(wallet.userId), Number(wallet.availableBalance || 0)])
    );
    data = users.map((user) => ({
      ...user,
      withdrawableBalance: walletMap.get(String(user._id)) || 0,
    }));
  }

  return ok({
    data,
    total,
    page,
    pageSize,
    summary: {
      activated,
      blocked,
      elevatedRoleCount,
      totalWithdrawableKes,
      minWithdrawalAmount,
    },
  });
}

export async function POST(request) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;
  await connectDB();
  const body = await request.json().catch(() => null);
  if (!body?.userId) return fail("userId required");
  const updates = {};
  if (body.role) {
    const nextRole = String(body.role || "");
    if (!ADMIN_MANAGEABLE_ROLES.includes(nextRole)) return fail("Invalid role", 400);
    updates.role = nextRole;
  }
  if (typeof body.isBlocked === "boolean") updates.isBlocked = body.isBlocked;
  if (typeof body.isActivated === "boolean") updates.isActivated = body.isActivated;
  await User.findByIdAndUpdate(body.userId, updates);
  return ok({ message: "User updated" });
}
