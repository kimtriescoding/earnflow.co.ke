import mongoose from "mongoose";
import { getModel } from "./_model";

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
    type: { type: String, index: true, required: true },
    amount: { type: Number, required: true },
    description: { type: String, default: "" },
    status: { type: String, default: "completed", index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

schema.index({ userId: 1, type: 1, createdAt: -1 });
schema.index(
  { type: 1, "metadata.activationPaymentId": 1 },
  {
    unique: true,
    partialFilterExpression: {
      type: "activation_fee",
      "metadata.activationPaymentId": { $exists: true, $type: "string", $ne: "" },
    },
  }
);
schema.index(
  { type: 1, "metadata.withdrawalId": 1 },
  {
    unique: true,
    partialFilterExpression: {
      type: { $in: ["withdrawal", "refund"] },
      "metadata.withdrawalId": { $exists: true },
    },
  }
);
schema.index(
  { userId: 1, type: 1, "metadata.referredUserId": 1, "metadata.level": 1 },
  {
    unique: true,
    partialFilterExpression: { type: "referral_signup_bonus" },
  }
);

export default getModel("Transaction", schema);
