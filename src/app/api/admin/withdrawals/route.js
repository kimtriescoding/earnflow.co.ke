import connectDB from "@/lib/db";
import Withdrawal from "@/models/Withdrawal";
import User from "@/models/User";
import { requireAuth } from "@/lib/auth/guards";
import { ok, fail } from "@/lib/api";

export async function GET(request) {
  const auth = await requireAuth(["admin", "support"]);
  if (auth.error) return auth.error;
  await connectDB();
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") || 1);
  const pageSize = Math.min(100, Number(searchParams.get("pageSize") || 20));
  const status = String(searchParams.get("status") || "").trim();
  const sortDir = searchParams.get("sortDir") === "asc" ? 1 : -1;

  const filter = status ? { status } : {};
  const [total, withdrawals] = await Promise.all([
    Withdrawal.countDocuments(filter),
    Withdrawal.find(filter).sort({ createdAt: sortDir }).skip((page - 1) * pageSize).limit(pageSize).lean(),
  ]);

  const users = await User.find({ _id: { $in: withdrawals.map((item) => item.userId) } }).select("username email").lean();
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  const data = withdrawals.map((w) => ({
    ...w,
    user: userMap.get(String(w.userId)) || null,
  }));
  return ok({ data, total, page, pageSize });
}

export async function PATCH(request) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;
  await connectDB();
  const body = await request.json().catch(() => null);
  if (!body?.withdrawalId || !body?.status) return fail("withdrawalId and status required");
  await Withdrawal.findByIdAndUpdate(body.withdrawalId, { status: body.status, notes: body.notes || "" });
  return ok({ message: "Withdrawal updated" });
}
