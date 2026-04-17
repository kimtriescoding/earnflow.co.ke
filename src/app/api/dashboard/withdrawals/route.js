import connectDB from "@/lib/db";
import Withdrawal from "@/models/Withdrawal";
import { requireAuth } from "@/lib/auth/guards";
import { ok } from "@/lib/api";

export async function GET(request) {
  const auth = await requireAuth(["user", "admin"]);
  if (auth.error) return auth.error;
  await connectDB();

  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") || 1);
  const pageSize = Math.min(100, Number(searchParams.get("pageSize") || 20));
  const status = String(searchParams.get("status") || "").trim();

  const filter = {
    userId: auth.payload.sub,
    ...(status ? { status } : {}),
  };

  const [total, data] = await Promise.all([
    Withdrawal.countDocuments(filter),
    Withdrawal.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
  ]);

  return ok({ data, total, page, pageSize });
}
