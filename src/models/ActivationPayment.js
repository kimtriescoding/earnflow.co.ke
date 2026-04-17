import mongoose from "mongoose";
import { getModel } from "./_model";

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "KES" },
    paymentKey: { type: String, index: true, default: null },
    reference: { type: String, index: true },
    status: { type: String, enum: ["pending", "success", "failed"], default: "pending", index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);
schema.index({ userId: 1, status: 1, createdAt: -1 });
schema.index({ status: 1, createdAt: -1 });
schema.index({ status: 1, updatedAt: -1 });
schema.index(
  { paymentKey: 1 },
  { unique: true, sparse: true, partialFilterExpression: { paymentKey: { $type: "string", $nin: [null, ""] } } }
);

export default getModel("ActivationPayment", schema);
