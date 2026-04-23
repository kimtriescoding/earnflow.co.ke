import connectDB from "@/lib/db";
import EarningEvent from "@/models/EarningEvent";
import ModuleInteraction from "@/models/ModuleInteraction";
import { approveEarningEvent, rejectEarningEvent } from "@/lib/ledger/earnings";
import { logModuleInteraction } from "@/lib/modules/interactions";

/**
 * Approve or reject a pending EarningEvent (manual review queue).
 * Logs a review_* interaction on the same module as the original submission.
 */
export async function applyEarningReview({ eventId, action, actorId }) {
  await connectDB();
  const event = await EarningEvent.findById(eventId);
  if (!event) return { ok: false, message: "Event not found" };
  if (event.status !== "pending") return { ok: false, message: "This reward is not pending review" };

  const prior = await ModuleInteraction.findOne({ earningEventId: event._id }).sort({ createdAt: 1 }).lean();
  const moduleKey = prior?.module || event.source;

  if (action === "approve") {
    const r = await approveEarningEvent({ eventId, actorId });
    if (!r.success) {
      return {
        ok: false,
        message:
          r.reason === "not_found_or_done"
            ? "This reward is no longer pending (it may have been approved already)."
            : r.reason === "user_not_found"
              ? "User for this reward no longer exists."
              : "Could not approve this reward",
        reason: r.reason,
      };
    }
  } else if (action === "reject") {
    const r = await rejectEarningEvent({ eventId, actorId });
    if (!r.success) {
      return {
        ok: false,
        message: r.reason === "not_pending" ? "This reward is no longer pending review." : "Could not reject this reward",
        reason: r.reason,
      };
    }
  } else {
    return { ok: false, message: "action must be approve or reject" };
  }

  const updated = await EarningEvent.findById(eventId).lean();
  const status = action === "approve" ? "approved" : "rejected";
  await logModuleInteraction({
    module: moduleKey,
    action: action === "approve" ? "review_approve" : "review_reject",
    status,
    amount: Number(updated?.amount || event.amount || 0),
    userId: event.userId,
    earningEventId: event._id,
    metadata: { reviewedBy: actorId },
  });

  return { ok: true, status };
}
