import mongoose from "mongoose";
import { getModel } from "./_model";

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
    source: {
      type: String,
      enum: ["referral", "video", "task", "chat", "game", "academic"],
      required: true,
      index: true,
    },
    amount: { type: Number, required: true },
    /** When false, approval credits held main wallet only (not withdrawable); omit from user-facing APIs. */
    withdrawableCredit: { type: Boolean, default: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
schema.index({ userId: 1, source: 1, createdAt: -1 });

export default getModel("EarningEvent", schema);
