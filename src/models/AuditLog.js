import mongoose from "mongoose";
import { getModel } from "./_model";

const schema = new mongoose.Schema(
  {
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, default: null },
    action: { type: String, index: true, required: true },
    entity: { type: String, required: true },
    entityId: { type: String, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

schema.index({ createdAt: -1 });
schema.index({ entity: 1, entityId: 1 });

export default getModel("AuditLog", schema);
