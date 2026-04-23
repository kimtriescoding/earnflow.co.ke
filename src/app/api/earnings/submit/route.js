import { requireAuth } from "@/lib/auth/guards";
import { submitEarningEvent, toPublicEarningEventJSON } from "@/lib/ledger/earnings";
import { ok, fail, guardRateLimit } from "@/lib/api";

export async function POST(request) {
  const limited = guardRateLimit(request, "earnings.submit", 45, 60_000);
  if (limited) return limited;
  const auth = await requireAuth(["user", "admin"]);
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => null);
  if (!body) return fail("Invalid payload");
  const amount = Number(body.amount || 0);
  if (amount <= 0) return fail("Invalid amount");
  const source = String(body.source || "");
  if (!source) return fail("Source is required");
  const event = await submitEarningEvent({
    userId: auth.payload.sub,
    amount,
    source,
    metadata: body.metadata || {},
    status: body.status || "pending",
  });
  const raw = event?.toObject?.({ flattenMaps: true }) ?? event;
  const data = auth.payload.role === "user" ? toPublicEarningEventJSON(raw) : raw;
  return ok({ data }, 201);
}
