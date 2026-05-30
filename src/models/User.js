import mongoose from "mongoose";
import { getModel } from "./_model";

const schema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, index: true, lowercase: true },
    referralCode: { type: String, required: true, unique: true, index: true, lowercase: true },
    email: { type: String, required: true, unique: true, index: true, lowercase: true },
    phoneNumber: { type: String, default: "", index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["user", "client", "admin", "support", "superadmin"], default: "user" },
    isActivated: { type: Boolean, default: false, index: true },
    isBlocked: { type: Boolean, default: false },
    mfaEnabled: { type: Boolean, default: false, index: true },
    mfaSecret: { type: String, default: "" },
    mfaTempSecret: { type: String, default: "" },
    mfaBackupCodeHashes: { type: [String], default: [] },
    mfaLastVerifiedAt: { type: Date, default: null },
    mfaSetupOtpHash: { type: String, default: "" },
    mfaSetupOtpExpiresAt: { type: Date, default: null },
    mfaSetupOtpAttempts: { type: Number, default: 0 },
    mfaSetupVerifiedAt: { type: Date, default: null },
    balance: { type: Number, default: 0 },
    referredByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, default: null },
    uplineL1UserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, default: null },
    uplineL2UserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, default: null },
    uplineL3UserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, default: null },
  },
  { timestamps: true }
);

schema.index({ role: 1, createdAt: -1 });

export default getModel("User", schema);
