import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth/guards";
import connectDB from "@/lib/db";
import ModuleItem from "@/models/ModuleItem";
import { getSetting } from "@/models/Settings";
import { submitEarningEvent } from "@/lib/ledger/earnings";
import { logModuleInteraction } from "@/lib/modules/interactions";
import { ok, fail } from "@/lib/api";
import { isWithinWindow, maxParticipantsCap } from "@/lib/modules/academic";
import {
  countDistinctVideoWatchEarners,
  findAdminVideoItemById,
  userHasBlockingVideoWatch,
} from "@/lib/modules/video";

export async function POST(request) {
  const auth = await requireAuth(["user", "admin"]);
  if (auth.error) return auth.error;
  await connectDB();
  const body = await request.json().catch(() => ({}));
  const watchedSeconds = Math.max(0, Math.floor(Number(body.watchedSeconds || 0)));
  const videoId = String(body.videoId || "").trim();
  if (!videoId) return fail("videoId required", 400);

  const moduleStatus = await getSetting("module_status", {});
  if (moduleStatus?.video === false) return fail("Video module is currently disabled", 403);

  let item = null;
  if (mongoose.Types.ObjectId.isValid(videoId)) {
    item = await findAdminVideoItemById(videoId);
  }
  if (!item) {
    item = await ModuleItem.findOne({
      "metadata.videoId": videoId,
      module: "video",
      status: "active",
      sourceType: "admin",
      $or: [{ approvalStatus: "approved" }, { approvalStatus: { $exists: false } }],
    }).lean();
  }

  if (!item) return fail("Video unavailable", 404);

  const now = new Date();
  const m = item.metadata || {};
  const windowCheck = isWithinWindow(now, m.startsAt, m.deadline);
  if (!windowCheck.ok) {
    if (windowCheck.reason === "not_started") return fail("This video is not available yet", 400);
    return fail("This video is no longer available", 400);
  }

  const threshold = Math.max(0, Math.floor(Number(item.thresholdSeconds || 0)));
  if (threshold <= 0) return fail("Video is missing a watch threshold", 400);
  if (watchedSeconds < threshold) return fail("Watch threshold not met", 400);

  if (await userHasBlockingVideoWatch(auth.payload.sub, item._id)) {
    return fail("You already have a pending or approved reward for this video", 400);
  }

  const cap = maxParticipantsCap(m);
  if (cap > 0) {
    const filled = await countDistinctVideoWatchEarners(item._id);
    if (filled >= cap) return fail("This video has reached its viewer limit", 400);
  }

  const reward = Number(item.reward || 0);
  if (!Number.isFinite(reward) || reward <= 0) return fail("Invalid video reward", 400);

  const canonicalVideoId = item._id.toString();

  const event = await submitEarningEvent({
    userId: auth.payload.sub,
    amount: reward,
    source: "video",
    metadata: {
      title: item.title,
      videoId: canonicalVideoId,
      watchedSeconds,
      threshold,
      itemId: canonicalVideoId,
    },
    status: "pending",
  });
  await logModuleInteraction({
    module: "video",
    action: "watch",
    status: "pending",
    amount: reward,
    itemId: item._id,
    userId: auth.payload.sub,
    earningEventId: event._id,
    metadata: { watchedSeconds, threshold, videoId: canonicalVideoId },
  });
  return ok({ data: event }, 201);
}
