import mongoose from "mongoose";
import { getModel } from "./_model";

const schema = new mongoose.Schema(
  {
    module: { type: String, enum: ["video", "chat", "academic"], required: true, index: true },
    key: { type: String, required: true, index: true },
    label: { type: String, default: "" },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    pricingType: { type: String, enum: ["fixed", "unit"], default: "unit" },
    unitName: { type: String, default: "" },
    unitPrice: { type: Number, default: 0 },
    minimumCharge: { type: Number, default: 0 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

schema.index({ module: 1, key: 1 }, { unique: true });

export default getModel("ClientPricingRule", schema);
