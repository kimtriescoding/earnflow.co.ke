import mongoose from "mongoose";
import { getModel } from "./_model";

const schema = new mongoose.Schema(
  {
    provider: { type: String, default: "zetupay" },
    route: { type: String, index: true },
    identifier: { type: String, index: true },
    bodyHash: { type: String, index: true },
    trusted: { type: Boolean, default: false },
    status: { type: String, default: "received" },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

schema.index({ createdAt: -1 });

export default getModel("PaymentCallbackAudit", schema);
