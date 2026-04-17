import mongoose from "mongoose";
import { getModel } from "./_model";

const schema = new mongoose.Schema(
  {
    module: { type: String, enum: ["video", "chat", "academic"], required: true, index: true },
    clientUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    moduleItemId: { type: mongoose.Schema.Types.ObjectId, ref: "ModuleItem", default: null, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    status: {
      type: String,
      enum: ["draft", "pending_payment", "paid", "pending_approval", "approved", "rejected", "in_progress", "completed", "cancelled"],
      default: "pending_payment",
      index: true,
    },
    currency: { type: String, default: "KES" },
    targetViews: { type: Number, default: 0 },
    requestedMinutes: { type: Number, default: 0 },
    wordCount: { type: Number, default: 0 },
    itemReward: { type: Number, default: 0 },
    unitPrice: { type: Number, default: 0 },
    subtotalAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    paymentMethod: { type: String, default: "wavepay_checkout" },
    paymentStatus: { type: String, enum: ["pending", "success", "failed"], default: "pending", index: true },
    paymentReference: { type: String, default: "", index: true },
    paymentKey: { type: String, default: "", index: true },
    checkoutUrl: { type: String, default: "" },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

schema.index({ clientUserId: 1, module: 1, createdAt: -1 });
schema.index({ module: 1, status: 1, createdAt: -1 });

export default getModel("ClientOrder", schema);
