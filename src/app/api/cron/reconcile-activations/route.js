import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import ActivationPayment from "@/models/ActivationPayment";
import User from "@/models/User";
import { getEnv } from "@/lib/env";
import { ensureOutboxJob } from "@/lib/payments/outbox-enqueue";
import { processOutboxJobByKey } from "@/lib/payments/outbox-processor";
import { logInfo } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

/**
 * Best-effort repair: users marked activated in DB but referral outbox may have failed.
 * Enqueues/replays `activation_referral` jobs for recent successful payments.
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

  await connectDB();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const rows = await ActivationPayment.find({
    status: "success",
    updatedAt: { $gte: since },
  })
    .select("userId _id")
    .limit(200)
    .lean();

  let replayed = 0;
  for (const row of rows) {
    const u = await User.findById(row.userId).select("isActivated").lean();
    if (!u?.isActivated) continue;
    const key = `activation_referral:${row._id}`;
    await ensureOutboxJob({
      type: "activation_referral",
      idempotencyKey: key,
      payload: {
        userId: row.userId,
        activationPaymentId: String(row._id),
        paidAmount: 0,
      },
      status: "pending",
    });
    await processOutboxJobByKey(key);
    replayed += 1;
  }

  logInfo("cron.reconcile_activations", { scanned: rows.length, replayed });
  return NextResponse.json({ success: true, scanned: rows.length, replayed });
}
