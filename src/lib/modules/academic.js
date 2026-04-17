import mongoose from "mongoose";
import ModuleItem from "@/models/ModuleItem";
import ModuleInteraction from "@/models/ModuleInteraction";

export const BLOCKING_SUBMISSION_STATUSES = ["pending", "approved"];

export function parseMetadataDate(value) {
  if (value == null || value === "") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isWithinWindow(now, startsAtIso, deadlineIso) {
  const start = parseMetadataDate(startsAtIso);
  const end = parseMetadataDate(deadlineIso);
  if (start && now < start) return { ok: false, reason: "not_started" };
  if (end && now > end) return { ok: false, reason: "deadline_passed" };
  return { ok: true };
}

export function adminAcademicTaskBaseFilter() {
  return {
    module: "academic",
    status: "active",
    sourceType: "admin",
    $or: [{ approvalStatus: "approved" }, { approvalStatus: { $exists: false } }],
  };
}

export async function findAdminAcademicItemById(id) {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
  return ModuleItem.findOne({ _id: id, ...adminAcademicTaskBaseFilter() }).lean();
}

export async function countDistinctAcademicSubmitters(itemId) {
  const ids = await ModuleInteraction.distinct("userId", {
    module: "academic",
    action: "submit",
    itemId,
    status: { $in: BLOCKING_SUBMISSION_STATUSES },
  });
  return ids.filter(Boolean).length;
}

export async function userHasBlockingAcademicSubmission(userId, itemId) {
  const row = await ModuleInteraction.findOne({
    module: "academic",
    action: "submit",
    itemId,
    userId,
    status: { $in: BLOCKING_SUBMISSION_STATUSES },
  })
    .select("_id")
    .lean();
  return Boolean(row);
}

export function filterItemsByTimeWindow(items, now = new Date()) {
  return items.filter((item) => {
    const m = item.metadata || {};
    return isWithinWindow(now, m.startsAt, m.deadline).ok;
  });
}

export function maxParticipantsCap(metadata) {
  const n = Number(metadata?.maxParticipants ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function slotsRemainingForItem(item, filledDistinctUsers) {
  const cap = maxParticipantsCap(item.metadata || {});
  if (!cap) return null;
  return Math.max(0, cap - filledDistinctUsers);
}
