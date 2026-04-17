import mongoose from "mongoose";
import { getModel } from "./_model";

const messageSchema = new mongoose.Schema(
  {
    senderUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    senderRole: { type: String, enum: ["client", "worker", "admin"], required: true },
    body: { type: String, required: true, trim: true },
    sentAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    clientUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "ClientOrder", default: null, index: true },
    title: { type: String, required: true, trim: true },
    topic: { type: String, default: "" },
    status: { type: String, enum: ["open", "pending", "closed"], default: "open", index: true },
    participantIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    totalBilledMinutes: { type: Number, default: 0 },
    totalBilledAmount: { type: Number, default: 0 },
    messages: { type: [messageSchema], default: [] },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

schema.index({ clientUserId: 1, status: 1, updatedAt: -1 });

export default getModel("ClientChatThread", schema);
