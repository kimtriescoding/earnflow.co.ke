import connectDB from "@/lib/db";
import Wallet from "@/models/Wallet";
import { requireAuth } from "@/lib/auth/guards";
import { ok } from "@/lib/api";

const userStages = [
  {
    $lookup: {
      from: "users",
      localField: "userId",
      foreignField: "_id",
      as: "_user",
    },
  },
  { $unwind: { path: "$_user", preserveNullAndEmptyArrays: false } },
];

export async function GET() {
  const auth = await requireAuth(["admin", "support"]);
  if (auth.error) return auth.error;
  await connectDB();

  const [topLifetimeEarnersRaw, topWithdrawableRaw] = await Promise.all([
    Wallet.aggregate([
      { $match: { lifetimeEarnings: { $gt: 0 } } },
      { $sort: { lifetimeEarnings: -1 } },
      { $limit: 5 },
      ...userStages,
    ]),
    Wallet.aggregate([
      { $match: { availableBalance: { $gt: 0 } } },
      { $sort: { availableBalance: -1 } },
      { $limit: 5 },
      ...userStages,
    ]),
  ]);

  const topLifetimeEarners = topLifetimeEarnersRaw.map((row) => ({
    userId: String(row.userId),
    username: String(row._user?.username || ""),
    email: String(row._user?.email || ""),
    lifetimeEarnings: Number(Number(row.lifetimeEarnings || 0).toFixed(2)),
  }));

  const topWithdrawable = topWithdrawableRaw.map((row) => ({
    userId: String(row.userId),
    username: String(row._user?.username || ""),
    email: String(row._user?.email || ""),
    availableBalance: Number(Number(row.availableBalance || 0).toFixed(2)),
  }));

  return ok({
    data: { topLifetimeEarners, topWithdrawable },
  });
}
