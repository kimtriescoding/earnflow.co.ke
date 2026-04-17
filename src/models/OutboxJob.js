import mongoose from "mongoose";
import { getModel } from "./_model";

const schema = new mongoose.Schema(
  {
    type: { type: String, required: true, index: true },
    idempotencyKey: { type: String, required: true, unique: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true,
    },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: "" },
    lockedAt: { type: Date, default: null },
    runAfter: { type: Date, default: null },
  },
  { timestamps: true }
);

schema.index({ status: 1, runAfter: 1, createdAt: 1 });

export default getModel("OutboxJob", schema);
