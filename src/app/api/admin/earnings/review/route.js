import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth/guards";
import { applyEarningReview } from "@/lib/ledger/apply-earning-review";
import { ok, fail } from "@/lib/api";

export async function POST(request) {
  const auth = await requireAuth(["admin", "support"]);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const eventId = String(body.eventId || "").trim();
  const action = String(body.action || "").trim().toLowerCase();

  if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) return fail("eventId required", 400);
  if (!["approve", "reject"].includes(action)) return fail("action must be approve or reject", 400);

  const result = await applyEarningReview({ eventId, action, actorId: auth.payload.sub });
  if (!result.ok) return fail(result.message || "Review failed", 400);

  return ok({ message: `Reward ${result.status}` });
}
