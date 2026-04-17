import connectDB from "@/lib/db";
import { requireAuth } from "@/lib/auth/guards";
import { ok } from "@/lib/api";
import { getUserTransactionFeed } from "@/lib/dashboard/user-transactions";

export async function GET() {
  const auth = await requireAuth(["user", "admin"]);
  if (auth.error) return auth.error;
  await connectDB();
  const payload = await getUserTransactionFeed(auth.payload.sub);
  return ok({
    data: {
      rows: payload.rows.map((r) => ({
        ...r,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
      })),
      summary: payload.summary,
      balances: payload.balances,
    },
  });
}
