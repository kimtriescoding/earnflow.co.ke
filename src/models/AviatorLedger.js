import mongoose from "mongoose";
import { getModel } from "./_model";

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
    type: {
      type: String,
      enum: ["aviator_bet", "aviator_payout", "aviator_loss", "topup_transfer", "topup_checkout"],
      required: true,
      index: true,
    },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

schema.index({ userId: 1, createdAt: -1 });

export default getModel("AviatorLedger", schema);
