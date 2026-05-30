import mongoose from "mongoose";
import User from "@/models/User";
import Wallet from "@/models/Wallet";
import Transaction from "@/models/Transaction";
import { resolveChatUnlockConfig } from "@/lib/payments/chat-unlock-config";
import { logError, logInfo } from "@/lib/observability/logger";

function toUserObjectId(value) {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (typeof value === "object" && value._id) return toUserObjectId(value._id);
  const s = String(value);
  if (s.length === 24 && mongoose.Types.ObjectId.isValid(s)) return new mongoose.Types.ObjectId(s);
  return null;
}

/**
 * Credits the direct referrer of `userId` with the configured chat-unlock bonus, once per unlock payment.
 * Idempotent via the unique partial index on Transaction (type + metadata.chatUnlockPaymentId).
 */
export async function grantChatUnlockReferrerBonus({ userId, chatUnlockPaymentId, real = true }) {
  const referredUserId = toUserObjectId(userId);
  const paymentKey = String(chatUnlockPaymentId || "");
  if (!referredUserId || !paymentKey) return;

  const user = await User.findById(referredUserId).select("referredByUserId uplineL1UserId").lean();
  const beneficiaryUserId = toUserObjectId(user?.referredByUserId) || toUserObjectId(user?.uplineL1UserId);
  if (!beneficiaryUserId) return;

  const { referrerBonus } = await resolveChatUnlockConfig();
  const amount = Number(referrerBonus || 0);
  if (!(amount > 0)) return;

  const existing = await Transaction.exists({
    type: "chat_unlock_referral_bonus",
    "metadata.chatUnlockPaymentId": paymentKey,
  });
  if (existing) return;

  await Wallet.findOneAndUpdate(
    { userId: beneficiaryUserId },
    { $inc: { availableBalance: amount, lifetimeEarnings: amount } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );
  await User.findByIdAndUpdate(beneficiaryUserId, { $inc: { balance: amount } });

  try {
    await Transaction.create({
      userId: beneficiaryUserId,
      type: "chat_unlock_referral_bonus",
      amount,
      description: "Chat unlock referral bonus",
      status: "completed",
      real,
      metadata: {
        chatUnlockPaymentId: paymentKey,
        referredUserId: String(referredUserId),
      },
    });
  } catch (e) {
    if (e?.code === 11000) {
      await Wallet.findOneAndUpdate(
        { userId: beneficiaryUserId },
        { $inc: { availableBalance: -amount, lifetimeEarnings: -amount } }
      );
      await User.findByIdAndUpdate(beneficiaryUserId, { $inc: { balance: -amount } });
      return;
    }
    logError("chat_unlock.referral_bonus_failed", {
      chatUnlockPaymentId: paymentKey,
      beneficiaryUserId: String(beneficiaryUserId),
      error: e?.message || "unknown",
    });
    throw e;
  }

  logInfo("chat_unlock.referral_bonus_granted", {
    chatUnlockPaymentId: paymentKey,
    beneficiaryUserId: String(beneficiaryUserId),
    referredUserId: String(referredUserId),
    amount,
  });
}
