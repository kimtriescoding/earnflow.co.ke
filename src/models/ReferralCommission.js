import mongoose from "mongoose";
import { getModel } from "./_model";

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    beneficiaryUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    /** Optional; signup bonuses no longer create a host EarningEvent on the referred user. */
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "EarningEvent", default: null, index: true },
    level: { type: Number, enum: [1, 2, 3], required: true, index: true },
    amount: { type: Number, required: true },
    /** When set, main-wallet feed shows this credit via `Transaction` only (no duplicate commission row). */
    ledgerTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", default: null, index: true },
  },
  { timestamps: true }
);
schema.index({ beneficiaryUserId: 1, level: 1, createdAt: -1 });
schema.index({ userId: 1, beneficiaryUserId: 1, level: 1 }, { unique: true });
schema.index({ createdAt: -1 });

export default getModel("ReferralCommission", schema);
