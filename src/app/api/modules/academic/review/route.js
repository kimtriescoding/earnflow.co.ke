import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth/guards";
import { applyEarningReview } from "@/lib/ledger/apply-earning-review";
import { ok, fail } from "@/lib/api";

/** @deprecated Prefer POST /api/admin/earnings/review */
export async function POST(request) {
  const auth = await requireAuth(["admin", "support"]);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const eventId = String(body.eventId || "").trim();
  const action = body.action === "approve" ? "approve" : "reject";

  if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) return fail("eventId required", 400);

  const result = await applyEarningReview({ eventId, action, actorId: auth.payload.sub });
  if (!result.ok) return fail(result.message || "Review failed", 400);

  return ok({ message: `Academic submission ${result.status}` });
}
