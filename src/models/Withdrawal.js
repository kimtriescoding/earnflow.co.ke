import mongoose from "mongoose";
import { getModel } from "./_model";

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
    amount: { type: Number, required: true },
    fee: { type: Number, default: 0 },
    method: { type: String, default: "mpesa" },
    phoneNumber: { type: String, required: true },
    status: { type: String, enum: ["pending", "completed", "failed"], default: "pending", index: true },
    transactionId: { type: String, default: null },
    notes: { type: String, default: "" },
    processedAt: { type: Date, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

schema.index({ userId: 1, status: 1, createdAt: -1 });
schema.index({ status: 1, createdAt: -1 });
schema.index({ status: 1, processedAt: -1 });
schema.index({ userId: 1 }, { unique: true, partialFilterExpression: { status: "pending" } });

export default getModel("Withdrawal", schema);
