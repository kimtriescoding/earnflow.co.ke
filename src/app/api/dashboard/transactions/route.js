import connectDB from "@/lib/db";
import { requireAuth } from "@/lib/auth/guards";
import { ok } from "@/lib/api";
import { getUserTransactionFeed } from "@/lib/dashboard/user-transactions";
import { getSetting } from "@/models/Settings";

export async function GET(request) {
  const auth = await requireAuth(["user", "admin"]);
  if (auth.error) return auth.error;
  await connectDB();
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || 50)));
  const moduleStatus = await getSetting("module_status", {});
  const payload = await getUserTransactionFeed(auth.payload.sub, { moduleStatus, page, pageSize });
  return ok({
    data: {
      rows: payload.rows.map((r) => ({
        ...r,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
      })),
      summary: payload.summary,
      balances: payload.balances,
      total: payload.total,
      page: payload.page,
      pageSize: payload.pageSize,
    },
  });
}
