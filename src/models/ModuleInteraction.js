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
    action: { type: String, required: true, index: true },
    status: { type: String, enum: ["pending", "approved", "rejected", "failed"], default: "pending", index: true },
    amount: { type: Number, default: 0 },
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: "ModuleItem", default: null, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    earningEventId: { type: mongoose.Schema.Types.ObjectId, ref: "EarningEvent", default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

schema.index({ module: 1, createdAt: -1 });

export default getModel("ModuleInteraction", schema);
