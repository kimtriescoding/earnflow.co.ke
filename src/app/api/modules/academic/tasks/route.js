import { requireAuth } from "@/lib/auth/guards";
import connectDB from "@/lib/db";
import { getSetting } from "@/models/Settings";
import ModuleItem from "@/models/ModuleItem";
import { ok, fail } from "@/lib/api";
import {
  adminAcademicTaskBaseFilter,
  countDistinctAcademicSubmitters,
  filterItemsByTimeWindow,
  maxParticipantsCap,
  slotsRemainingForItem,
} from "@/lib/modules/academic";

export async function GET() {
  const auth = await requireAuth(["user", "admin"]);
  if (auth.error) return auth.error;
  await connectDB();

  const moduleStatus = await getSetting("module_status", {});
  if (moduleStatus?.academic === false) return fail("Academic module is currently disabled", 403);

  const rows = await ModuleItem.find(adminAcademicTaskBaseFilter()).sort({ createdAt: -1 }).limit(200).lean();

  const now = new Date();
  const open = filterItemsByTimeWindow(rows, now);

  const data = [];
  for (const item of open) {
    const filled = await countDistinctAcademicSubmitters(item._id);
    const slotsRemaining = slotsRemainingForItem(item, filled);
    const cap = maxParticipantsCap(item.metadata || {});
    if (cap > 0 && slotsRemaining === 0) continue;

    const m = item.metadata || {};
    data.push({
      _id: item._id.toString(),
      title: item.title,
      description: item.description || "",
      reward: Number(item.reward || 0),
      createdAt: item.createdAt,
      metadata: {
        startsAt: m.startsAt || null,
        deadline: m.deadline || null,
        minWords: Number(m.minWords ?? 0),
        format: m.format != null ? String(m.format) : "",
      },
    });
  }

  return ok({ data });
}
