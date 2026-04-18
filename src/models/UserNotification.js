import mongoose from "mongoose";
import { getModel } from "./_model";

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["commission_referral"], required: true, index: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
    metadata: {
      amount: { type: Number, required: true },
      level: { type: Number },
      referredUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      ledgerTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" },
    },
  },
  { timestamps: true }
);

schema.index({ userId: 1, read: 1, createdAt: -1 });
schema.index({ userId: 1, createdAt: -1 });

export default getModel("UserNotification", schema);
