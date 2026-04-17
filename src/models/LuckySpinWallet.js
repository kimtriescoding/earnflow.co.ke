import mongoose from "mongoose";
import { getModel } from "./_model";

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true, index: true, required: true },
    balance: { type: Number, default: 0 },
    totalTopups: { type: Number, default: 0 },
    totalWagered: { type: Number, default: 0 },
    totalPayouts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default getModel("LuckySpinWallet", schema);
