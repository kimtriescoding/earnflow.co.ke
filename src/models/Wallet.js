import mongoose from "mongoose";
import { getModel } from "./_model";

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true, index: true },
    pendingBalance: { type: Number, default: 0 },
    availableBalance: { type: Number, default: 0 },
    lifetimeEarnings: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default getModel("Wallet", schema);
