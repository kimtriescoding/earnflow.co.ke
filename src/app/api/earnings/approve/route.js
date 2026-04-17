import { requireAuth } from "@/lib/auth/guards";
import { approveEarningEvent } from "@/lib/ledger/earnings";
import { ok, fail } from "@/lib/api";

export async function POST(request) {
  const auth = await requireAuth(["admin", "support"]);
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => null);
  if (!body?.eventId) return fail("eventId required");
  const result = await approveEarningEvent({ eventId: body.eventId, actorId: auth.payload.sub });
  if (!result.success) return fail("Cannot approve event", 400, result);
  return ok({ message: "Earning approved" });
}
