import OutboxJob from "@/models/OutboxJob";

/**
 * Create outbox row if missing (idempotent on idempotencyKey).
 */
export async function ensureOutboxJob(doc) {
  try {
    await OutboxJob.create(doc);
  } catch (e) {
    if (e?.code === 11000) return;
    throw e;
  }
}
