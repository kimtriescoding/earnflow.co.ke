import mongoose from "mongoose";
import connectDB from "@/lib/db";
import { isStandaloneMongoTransactionError } from "@/lib/db/mongo-transaction-support";
import Wallet from "@/models/Wallet";
import EarningEvent from "@/models/EarningEvent";
import { loadReferralCommissionRules } from "@/lib/referrals/commission-config";
import ModuleInteraction from "@/models/ModuleInteraction";
import User from "@/models/User";

async function persistApprovedEarning(event, user, actorId, session) {
  const opts = session ? { session } : {};
  event.status = "approved";
  event.approvedBy = actorId;
  event.approvedAt = new Date();
  await event.save(opts);
  const withdrawable = event.withdrawableCredit !== false;
  if (withdrawable) {
    await Wallet.findOneAndUpdate(
      { userId: user._id },
      { $inc: { pendingBalance: -event.amount, availableBalance: event.amount, lifetimeEarnings: event.amount } },
      { ...opts, upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await User.findByIdAndUpdate(user._id, { $inc: { balance: event.amount } }, opts);
  } else {
    await Wallet.findOneAndUpdate(
      { userId: user._id },
      { $inc: { pendingBalance: -event.amount, heldMainBalance: event.amount, lifetimeEarnings: event.amount } },
      { ...opts, upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
}

export async function getCommissionRules() {
  await connectDB();
  return loadReferralCommissionRules();
}

export async function submitEarningEvent({ userId, amount, source, metadata = {}, status = "pending", withdrawableCredit = true }) {
  await connectDB();
  return EarningEvent.create({ userId, amount, source, metadata, status, withdrawableCredit: withdrawableCredit !== false });
}

/** Removes internal ledger flags from API payloads shown to end users. */
export function toPublicEarningEventJSON(doc) {
  if (!doc) return doc;
  const plain = typeof doc.toObject === "function" ? doc.toObject({ flattenMaps: true }) : { ...doc };
  const rest = { ...plain };
  delete rest.withdrawableCredit;
  return rest;
}

export async function approveEarningEvent({ eventId, actorId }) {
  await connectDB();
  let event = await EarningEvent.findById(eventId);
  if (!event || event.status === "approved") return { success: false, reason: "not_found_or_done" };

  const user = await User.findById(event.userId).select("_id");
  if (!user) return { success: false, reason: "user_not_found" };

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await persistApprovedEarning(event, user, actorId, session);
    });
  } catch (err) {
    if (!isStandaloneMongoTransactionError(err)) throw err;
    event = await EarningEvent.findById(eventId);
    if (!event) return { success: false, reason: "not_found_or_done" };
    if (event.status === "pending") {
      await persistApprovedEarning(event, user, actorId, null);
    } else if (event.status !== "approved") {
      return { success: false, reason: "not_pending" };
    }
  } finally {
    session.endSession();
  }
  await ModuleInteraction.updateMany(
    { earningEventId: event._id, status: { $in: ["pending", "failed"] } },
    {
      $set: {
        status: "approved",
        metadata: {
          ...(event.metadata || {}),
          reviewedBy: actorId,
          reviewedAt: new Date().toISOString(),
        },
      },
    }
  );
  return { success: true };
}

export async function rejectEarningEvent({ eventId, actorId }) {
  await connectDB();
  const event = await EarningEvent.findById(eventId);
  if (!event || event.status !== "pending") return { success: false, reason: "not_pending" };

  event.status = "rejected";
  event.approvedBy = actorId;
  event.approvedAt = new Date();
  await event.save();

  await ModuleInteraction.updateMany(
    { earningEventId: event._id, status: "pending" },
    {
      $set: {
        status: "rejected",
        metadata: {
          reviewedBy: actorId,
          reviewedAt: new Date().toISOString(),
        },
      },
    }
  );
  return { success: true };
}
