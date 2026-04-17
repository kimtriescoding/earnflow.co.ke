import connectDB from "@/lib/db";
import { requireAuth } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/api";
import ModuleInteraction from "@/models/ModuleInteraction";
import { isSupportedModule, normalizeModuleKey, toModuleType } from "@/lib/modules/constants";

export async function GET(request, { params }) {
  const auth = await requireAuth(["admin", "support"]);
  if (auth.error) return auth.error;
  const slug = normalizeModuleKey((await params).module);
  if (!isSupportedModule(slug)) return fail("Unsupported module", 404);

  await connectDB();
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || 20)));
  const filter = { module: toModuleType(slug) };

  const [total, rows, totals] = await Promise.all([
    ModuleInteraction.countDocuments(filter),
    ModuleInteraction.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate({ path: "itemId", select: "title module" })
      .populate({ path: "userId", select: "username email" })
      .lean(),
    ModuleInteraction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          interactions: { $sum: 1 },
          approvedCount: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
          pendingCount: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
          totalEarnings: { $sum: "$amount" },
        },
      },
    ]),
  ]);

  return ok({
    data: rows,
    total,
    page,
    pageSize,
    summary: {
      interactions: Number(totals[0]?.interactions || 0),
      approvedCount: Number(totals[0]?.approvedCount || 0),
      pendingCount: Number(totals[0]?.pendingCount || 0),
      totalEarnings: Number(totals[0]?.totalEarnings || 0),
    },
  });
}
