import mongoose from "mongoose";
import { getModel } from "./_model";

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, default: null },
    fingerprint: { type: String, index: true, required: true },
    reason: { type: String, required: true },
    severity: { type: String, enum: ["low", "medium", "high"], default: "low" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);
schema.index({ userId: 1, fingerprint: 1, createdAt: -1 });

export default getModel("FraudSignal", schema);
