import connectDB from "@/lib/db";
import OutboxJob from "@/models/OutboxJob";
import User from "@/models/User";
import { grantReferralSignupBonuses } from "@/lib/referrals/engine";
import { sendWithdrawalSuccessEmail, sendWithdrawalFailedEmail } from "@/lib/email-utils";
import { createNotification } from "@/lib/notification-utils";
import { formatCurrency } from "@/lib/format-utils";
import { logError, logInfo } from "@/lib/observability/logger";

const LOCK_MS = 120_000;

/**
 * Runs referral grants for activation (idempotent via referral engine + unique indexes).
 */
async function runActivationReferralJob(payload) {
  const userId = payload?.userId;
  if (!userId) return;
  const user = await User.findById(userId);
  if (!user) return;
  await grantReferralSignupBonuses(user, {
    verifiedActivation: true,
    activationPaymentId: String(payload.activationPaymentId || ""),
    paidAmount: Number(payload.paidAmount || 0),
  });
}

async function runPayoutNotifySuccessJob(payload) {
  const user = await User.findById(payload.userId);
  if (user?.email) {
    await sendWithdrawalSuccessEmail({
      to: user.email,
      amount: payload.amount,
      currency: "KES",
      transactionId: payload.referenceNumber,
      referenceNumber: payload.referenceNumber,
      method: payload.method,
      phoneNumber: payload.phoneNumber,
    });
  }
  await createNotification({
    userId: payload.userId,
    type: "success",
    title: "Withdrawal Completed",
    message: `Your withdrawal of ${formatCurrency(payload.amount)} has been successfully processed. Reference: ${payload.referenceNumber}`,
    link: "/dashboard/withdrawals/history",
    metadata: { withdrawalId: String(payload.withdrawalId), amount: payload.amount, referenceNumber: payload.referenceNumber },
  });
}

async function runPayoutNotifyFailureJob(payload) {
  const user = await User.findById(payload.userId);
  if (user?.email) {
    await sendWithdrawalFailedEmail({
      to: user.email,
      amount: payload.amount,
      currency: "KES",
      referenceNumber: payload.referenceNumber,
      status: payload.status,
      reason: payload.reason,
    });
  }
  await createNotification({
    userId: payload.userId,
    type: "error",
    title: "Withdrawal Failed",
    message: `Your withdrawal of ${formatCurrency(payload.amount)} could not be processed. The amount remains in your balance.`,
    link: "/dashboard/withdrawals/history",
    metadata: { withdrawalId: String(payload.withdrawalId), amount: payload.amount, status: payload.status },
  });
}

async function dispatchJob(job) {
  switch (job.type) {
    case "activation_referral":
      await runActivationReferralJob(job.payload || {});
      break;
    case "payout_notify_success":
      await runPayoutNotifySuccessJob(job.payload || {});
      break;
    case "payout_notify_failure":
      await runPayoutNotifyFailureJob(job.payload || {});
      break;
    default:
      logError("outbox.unknown_type", { type: job.type, id: String(job._id) });
  }
}

/**
 * Claim and run a single outbox job by idempotency key (best-effort).
 */
export async function processOutboxJobByKey(idempotencyKey) {
  if (!idempotencyKey) return { ok: false, reason: "missing_key" };
  await connectDB();
  const now = new Date();
  const staleBefore = new Date(Date.now() - LOCK_MS);

  const job = await OutboxJob.findOneAndUpdate(
    {
      idempotencyKey,
      status: { $in: ["pending", "failed"] },
      $and: [
        { $or: [{ lockedAt: null }, { lockedAt: { $lte: staleBefore } }] },
        { $or: [{ runAfter: null }, { runAfter: { $lte: now } }] },
      ],
    },
    {
      $set: { status: "processing", lockedAt: now },
      $inc: { attempts: 1 },
    },
    { new: true }
  );

  if (!job) {
    const done = await OutboxJob.findOne({ idempotencyKey, status: "completed" }).lean();
    return { ok: true, skipped: true, completed: Boolean(done) };
  }

  try {
    await dispatchJob(job);
    await OutboxJob.findByIdAndUpdate(job._id, {
      $set: { status: "completed", lockedAt: null, lastError: "" },
    });
    logInfo("outbox.job_completed", { type: job.type, idempotencyKey });
    return { ok: true, processed: true };
  } catch (err) {
    const msg = err?.message || String(err);
    await OutboxJob.findByIdAndUpdate(job._id, {
      $set: {
        status: "failed",
        lockedAt: null,
        lastError: msg,
        runAfter: new Date(Date.now() + Math.min(60_000 * job.attempts, 900_000)),
      },
    });
    logError("outbox.job_failed", { type: job.type, idempotencyKey, error: msg });
    return { ok: false, error: msg };
  }
}

/**
 * Process a batch of pending outbox jobs (for cron / manual drain).
 */
export async function processOutboxBatch({ limit = 25 } = {}) {
  await connectDB();
  const now = new Date();
  const jobs = await OutboxJob.find({
    status: { $in: ["pending", "failed"] },
    $or: [{ runAfter: null }, { runAfter: { $lte: now } }],
  })
    .sort({ createdAt: 1 })
    .limit(limit)
    .select("idempotencyKey")
    .lean();

  let processed = 0;
  for (const j of jobs) {
    const r = await processOutboxJobByKey(j.idempotencyKey);
    if (r.processed) processed += 1;
  }
  return { ok: true, scanned: jobs.length, processed };
}
