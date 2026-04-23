import { requireAuth } from "@/lib/auth/guards";
import connectDB from "@/lib/db";
import { getSetting } from "@/models/Settings";
import ModuleItem from "@/models/ModuleItem";
import { ok, fail } from "@/lib/api";
import {
  adminVideoItemBaseFilter,
  blockingVideoWatchItemIdsForUser,
  countDistinctVideoWatchEarners,
  filterItemsByTimeWindow,
  maxParticipantsCap,
  slotsRemainingForItem,
} from "@/lib/modules/video";

export async function GET() {
  const auth = await requireAuth(["user", "admin"]);
  if (auth.error) return auth.error;
  await connectDB();

  const moduleStatus = await getSetting("module_status", {});
  if (moduleStatus?.video === false) return fail("Video module is currently disabled", 403);

  const rows = await ModuleItem.find(adminVideoItemBaseFilter()).sort({ createdAt: -1 }).limit(200).lean();

  const now = new Date();
  const open = filterItemsByTimeWindow(rows, now);

  const isEndUser = auth.payload.role === "user";
  const blockingItemIds = isEndUser ? await blockingVideoWatchItemIdsForUser(auth.payload.sub, open.map((i) => i._id)) : new Set();

  const data = [];
  for (const item of open) {
    const filled = await countDistinctVideoWatchEarners(item._id);
    const slotsRemaining = slotsRemainingForItem(item, filled);
    const cap = maxParticipantsCap(item.metadata || {});
    if (cap > 0 && slotsRemaining === 0) continue;

    const m = item.metadata || {};
    const videoUrl = String(m.videoUrl || "").trim();
    const th = Math.max(0, Math.floor(Number(item.thresholdSeconds || 0)));
    const rew = Number(item.reward || 0);
    if (!videoUrl || th <= 0 || !Number.isFinite(rew) || rew <= 0) continue;

    const alreadySubmitted = isEndUser && blockingItemIds.has(String(item._id));

    data.push({
      _id: item._id.toString(),
      title: item.title,
      description: item.description || "",
      reward: Number(item.reward || 0),
      thresholdSeconds: th,
      createdAt: item.createdAt,
      alreadySubmitted,
      metadata: {
        videoUrl,
        startsAt: m.startsAt || null,
        deadline: m.deadline || null,
      },
    });
  }

  return ok({ data });
}
