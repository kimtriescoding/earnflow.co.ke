import mongoose from "mongoose";
import ModuleItem from "@/models/ModuleItem";
import ModuleInteraction from "@/models/ModuleInteraction";
import {
  BLOCKING_SUBMISSION_STATUSES,
  filterItemsByTimeWindow,
  maxParticipantsCap,
  slotsRemainingForItem,
} from "@/lib/modules/academic";

export function adminVideoItemBaseFilter() {
  return {
    module: "video",
    status: "active",
    sourceType: "admin",
    $or: [{ approvalStatus: "approved" }, { approvalStatus: { $exists: false } }],
  };
}

export async function findAdminVideoItemById(id) {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
  return ModuleItem.findOne({ _id: id, ...adminVideoItemBaseFilter() }).lean();
}

export async function countDistinctVideoWatchEarners(itemId) {
  const ids = await ModuleInteraction.distinct("userId", {
    module: "video",
    action: "watch",
    itemId,
    status: { $in: BLOCKING_SUBMISSION_STATUSES },
  });
  return ids.filter(Boolean).length;
}

export async function userHasBlockingVideoWatch(userId, itemId) {
  const row = await ModuleInteraction.findOne({
    module: "video",
    action: "watch",
    itemId,
    userId,
    status: { $in: BLOCKING_SUBMISSION_STATUSES },
  })
    .select("_id")
    .lean();
  return Boolean(row);
}

export { filterItemsByTimeWindow, maxParticipantsCap, slotsRemainingForItem };
