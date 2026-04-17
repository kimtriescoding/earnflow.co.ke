import connectDB from "@/lib/db";
import User from "@/models/User";
import Wallet from "@/models/Wallet";
import { requireAuth } from "@/lib/auth/guards";
import { ok, fail } from "@/lib/api";
import { Types } from "mongoose";

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

export async function GET(request) {
  const auth = await requireAuth(["admin", "support"]);
  if (auth.error) return auth.error;
  await connectDB();
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") || 1);
  const pageSize = Number(searchParams.get("pageSize") || 20);
  const search = String(searchParams.get("search") || searchParams.get("q") || "").trim();
  const sortBy = String(searchParams.get("sortBy") || "createdAt");
  const sortDir = searchParams.get("sortDir") === "asc" ? 1 : -1;
  const allowedSortFields = new Set(["createdAt", "username", "email", "withdrawableBalance", "role", "isActivated"]);
  const safeSortBy = allowedSortFields.has(sortBy) ? sortBy : "createdAt";
  const filter = buildSearchFilter(search);

  const [total, activated, blocked, elevatedRoleCount, users] = await Promise.all([
    User.countDocuments(filter),
    User.countDocuments({ ...filter, isActivated: true }),
    User.countDocuments({ ...filter, isBlocked: true }),
    User.countDocuments({ ...filter, role: { $in: ["admin", "support"] } }),
    User.find(filter)
      .select("-passwordHash")
      .sort({ [safeSortBy]: sortDir, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
  ]);
  const walletMap = new Map(
    (
      await Wallet.find({
        userId: { $in: users.map((user) => user._id) },
      })
        .select("userId availableBalance")
        .lean()
    ).map((wallet) => [String(wallet.userId), Number(wallet.availableBalance || 0)])
  );
  const data = users.map((user) => ({
    ...user,
    withdrawableBalance: walletMap.get(String(user._id)) || 0,
  }));
  return ok({
    data,
    total,
    page,
    pageSize,
    summary: {
      activated,
      blocked,
      elevatedRoleCount,
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
  if (body.role) updates.role = body.role;
  if (typeof body.isBlocked === "boolean") updates.isBlocked = body.isBlocked;
  if (typeof body.isActivated === "boolean") updates.isActivated = body.isActivated;
  await User.findByIdAndUpdate(body.userId, updates);
  return ok({ message: "User updated" });
}
