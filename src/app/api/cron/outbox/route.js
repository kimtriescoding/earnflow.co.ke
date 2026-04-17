import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { processOutboxBatch } from "@/lib/payments/outbox-processor";
import { logInfo } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

/**
 * Drain pending outbox jobs (activation referrals, payout emails, etc.).
 * Secured with `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set.
 */
export async function GET(request) {
  const env = getEnv();
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (env.NODE_ENV === "production") {
    if (!env.CRON_SECRET || bearer !== env.CRON_SECRET) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
  } else if (env.CRON_SECRET && bearer !== env.CRON_SECRET) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  const result = await processOutboxBatch({ limit: 40 });
  logInfo("cron.outbox_batch", result);
  return NextResponse.json({ success: true, ...result });
}
