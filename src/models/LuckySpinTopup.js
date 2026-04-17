import mongoose from "mongoose";
import { getModel } from "./_model";

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
    amount: { type: Number, required: true },
    method: { type: String, enum: ["wallet_transfer", "checkout"], required: true, index: true },
    status: { type: String, enum: ["pending", "completed", "failed"], default: "pending", index: true },
    reference: { type: String, default: "" },
    paymentKey: { type: String, default: "" },
    phoneNumber: { type: String, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

schema.index({ userId: 1, createdAt: -1 });

export default getModel("LuckySpinTopup", schema);
