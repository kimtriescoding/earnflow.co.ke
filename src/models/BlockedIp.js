import mongoose from "mongoose";
import { getModel } from "./_model";

const schema = new mongoose.Schema(
  {
    ip: { type: String, required: true, unique: true, index: true },
    reason: { type: String, required: true },
    evidence: { type: mongoose.Schema.Types.Mixed, default: {} },
    blockedAt: { type: Date, default: Date.now },
    blockedBy: { type: String, default: "system" },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export default getModel("BlockedIp", schema);
