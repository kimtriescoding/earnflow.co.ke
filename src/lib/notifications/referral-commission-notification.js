import connectDB from "@/lib/db";
import UserNotification from "@/models/UserNotification";

/**
 * Persists an in-app notification for a referral activation commission credit.
 * Pass `{ session }` from a Mongo transaction so the row rolls back with the payout.
 */
export async function createReferralCommissionUserNotification(
  { userId, amount, level, referredUserId, ledgerTransactionId },
  sessionOpts = null
) {
  await connectDB();
  const amt = Number(amount || 0);
  const lev = Number(level);
  const title = "New referral commission";
  const body = `You earned KES ${amt.toFixed(2)} from a level-${lev} activation bonus.`;
  const doc = {
    userId,
    type: "commission_referral",
    title,
    body,
    read: false,
    metadata: {
      amount: amt,
      level: lev,
      referredUserId: referredUserId || undefined,
      ledgerTransactionId: ledgerTransactionId || undefined,
    },
  };
  if (sessionOpts?.session) {
    await UserNotification.create([doc], { session: sessionOpts.session });
  } else {
    await UserNotification.create([doc]);
  }
}
