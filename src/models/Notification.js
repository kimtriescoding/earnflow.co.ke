import mongoose from "mongoose";
import { getModel } from "./_model";

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["info", "success", "error"], default: "info" },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: { type: String, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    seenAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default getModel("Notification", schema);
