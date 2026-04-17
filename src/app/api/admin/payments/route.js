import connectDB from "@/lib/db";
import ActivationPayment from "@/models/ActivationPayment";
import Withdrawal from "@/models/Withdrawal";
import { requireAuth } from "@/lib/auth/guards";
import { ok } from "@/lib/api";

export async function GET(request) {
  const auth = await requireAuth(["admin", "support"]);
  if (auth.error) return auth.error;
  await connectDB();
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") || 1);
  const pageSize = Math.min(100, Number(searchParams.get("pageSize") || 20));

  const [checkouts, payouts] = await Promise.all([
    ActivationPayment.find({})
      .sort({ createdAt: -1 })
      .limit(200)
      .populate({ path: "userId", select: "username" })
      .lean(),
    Withdrawal.find({})
      .sort({ createdAt: -1 })
      .limit(200)
      .populate({ path: "userId", select: "username" })
      .lean(),
  ]);

  const usernameFrom = (ref) =>
    ref && typeof ref === "object" && ref.username ? String(ref.username) : "—";

  const checkoutRows = checkouts.map((c) => ({
    id: c._id.toString(),
    kind: "activation_checkout",
    status: c.status,
    amount: Number(c.amount || 0),
    reference: c.reference || c.paymentKey || "-",
    username: usernameFrom(c.userId),
    createdAt: c.createdAt,
  }));
  const payoutRows = payouts.map((p) => ({
    id: p._id.toString(),
    kind: "payout",
    status: p.status,
    amount: Number(p.amount || 0),
    reference: p.transactionId || "-",
    username: usernameFrom(p.userId),
    createdAt: p.createdAt,
  }));

  const merged = [...checkoutRows, ...payoutRows]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice((page - 1) * pageSize, page * pageSize);

  return ok({ data: merged, total: checkoutRows.length + payoutRows.length, page, pageSize });
}
