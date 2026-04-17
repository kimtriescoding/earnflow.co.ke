import mongoose from "mongoose";
import { getModel } from "./_model";

const schema = new mongoose.Schema(
  {
    key: { type: String, unique: true, index: true, required: true },
    value: { type: mongoose.Schema.Types.Mixed, default: {} },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default getModel("ModuleConfig", schema);
