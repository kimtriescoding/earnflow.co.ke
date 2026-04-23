import mongoose from "mongoose";
import { getModel } from "./_model";

const schema = new mongoose.Schema(
  {
    module: {
      type: String,
      enum: ["video", "chat", "lucky_spin", "aviator", "academic", "task"],
      index: true,
      required: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    reward: { type: Number, default: 0 },
    /** When false, watch rewards credit lifetime / stats but not withdrawable balance (admin-only control). */
    rewardWithdrawable: { type: Boolean, default: true },
    thresholdSeconds: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    sourceType: { type: String, enum: ["admin", "client"], default: "admin", index: true },
    approvalStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "approved", index: true },
    clientOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    clientOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "ClientOrder", default: null, index: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    targetViews: { type: Number, default: 0 },
    pricingSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

schema.index({ module: 1, createdAt: -1 });
schema.index({ module: 1, approvalStatus: 1, status: 1, createdAt: -1 });

export default getModel("ModuleItem", schema);
