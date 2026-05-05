import connectDB from "@/lib/db";
import Settings from "@/models/Settings";
import { requireAuth } from "@/lib/auth/guards";
import { ok } from "@/lib/api";
import { getEnv } from "@/lib/env";
import { deleteCache } from "@/lib/cache/config-cache";
import { sanitizeWithdrawalFeeTiers, normalizeWithdrawalFeeMode } from "@/lib/payments/withdrawal-fees";
import { isSuperadminRole } from "@/lib/auth/roles";
import { REALITY_SWITCH_KEYS } from "@/lib/payments/reality-switch";

const SUPERADMIN_ONLY_KEYS = new Set([
  REALITY_SWITCH_KEYS.activation,
  REALITY_SWITCH_KEYS.aviatorTopup,
  REALITY_SWITCH_KEYS.luckySpinTopup,
]);

export async function GET() {
  const auth = await requireAuth(["admin", "support"]);
  if (auth.error) return auth.error;
  await connectDB();
  const configs = await Settings.find({}).lean();
  const includeSuperadminOnly = isSuperadminRole(auth.payload.role);
  const sanitized = configs
    .filter((doc) => includeSuperadminOnly || !SUPERADMIN_ONLY_KEYS.has(String(doc.key || "")))
    .map((doc) => {
    if ((doc.key === "zetupay_primary" || doc.key === "wavepay_primary") && doc.value && typeof doc.value === "object") {
      const { privateKey: _privateKey, ...safeValue } = doc.value;
      return { ...doc, value: safeValue };
    }
    return doc;
    });
  return ok({ data: sanitized });
}

export async function POST(request) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;
  await connectDB();
  const body = await request.json().catch(() => ({}));
  if (!isSuperadminRole(auth.payload.role)) {
    for (const key of SUPERADMIN_ONLY_KEYS) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        delete body[key];
      }
    }
  }
  if (body.activation_fee && getEnv().ACTIVATION_FEE_ALLOW_ADMIN_OVERRIDE !== "true") {
    delete body.activation_fee;
  }
  if (body.module_lucky_spin_default && typeof body.module_lucky_spin_default === "object") {
    const cfg = body.module_lucky_spin_default;
    const segmentCount = Number(cfg.segmentCount ?? 6);
    const minBetAmount = Number(cfg.minBetAmount ?? 10);
    const winProbability = Number(cfg.winProbability ?? 65);
    body.module_lucky_spin_default = {
      ...cfg,
      segmentCount: Number.isFinite(segmentCount) ? Math.min(12, Math.max(2, Math.floor(segmentCount))) : 6,
      minBetAmount: Number.isFinite(minBetAmount) ? Math.max(1, Number(minBetAmount.toFixed(2))) : 10,
      winProbability: Number.isFinite(winProbability) ? Math.min(95, Math.max(1, Number(winProbability.toFixed(2)))) : 65,
    };
  }
  if (body.module_aviator_default && typeof body.module_aviator_default === "object") {
    const cfg = body.module_aviator_default;
    const minBetAmount = Number(cfg.minBetAmount ?? 10);
    const winProbability = Number(cfg.winProbability ?? 60);
    const maxBurst = Number(cfg.maxBurst ?? 12);
    body.module_aviator_default = {
      ...cfg,
      minBetAmount: Number.isFinite(minBetAmount) ? Math.max(1, Number(minBetAmount.toFixed(2))) : 10,
      winProbability: Number.isFinite(winProbability) ? Math.min(95, Math.max(0, Number(winProbability.toFixed(2)))) : 60,
      maxBurst: Number.isFinite(maxBurst) ? Math.min(100, Math.max(2, Number(maxBurst.toFixed(2)))) : 12,
    };
  }
  if (body.module_status && typeof body.module_status === "object") {
    const existing = await Settings.findOne({ key: "module_status" }).lean();
    body.module_status = { ...(existing?.value || {}), ...body.module_status };
  }
  if (body.zetupay_primary && typeof body.zetupay_primary === "object") {
    const existing = await Settings.findOne({ key: "zetupay_primary" }).lean();
    const incoming = { ...body.zetupay_primary };
    if (!incoming.privateKey) delete incoming.privateKey;
    body.zetupay_primary = { ...(existing?.value || {}), ...incoming };
  }
  if (body.wavepay_primary && typeof body.wavepay_primary === "object") {
    const existing = await Settings.findOne({ key: "wavepay_primary" }).lean();
    const incoming = { ...body.wavepay_primary };
    if (!incoming.privateKey) delete incoming.privateKey;
    body.wavepay_primary = { ...(existing?.value || {}), ...incoming };
  }
  if (body.withdrawal_fee_mode !== undefined) {
    body.withdrawal_fee_mode = normalizeWithdrawalFeeMode(body.withdrawal_fee_mode);
  }
  if (body.withdrawal_fee_value !== undefined) {
    body.withdrawal_fee_value = Math.max(0, Number(body.withdrawal_fee_value || 0));
  }
  if (body.withdrawal_fee_tiers !== undefined) {
    body.withdrawal_fee_tiers = sanitizeWithdrawalFeeTiers(body.withdrawal_fee_tiers);
  }
  const entries = Object.entries(body);
  await Promise.all(
    entries.map(([key, value]) =>
      Settings.findOneAndUpdate({ key }, { key, value }, { upsert: true, new: true, setDefaultsOnInsert: true })
    )
  );
  if (body.module_status) {
    deleteCache("settings:module_status");
  }
  const settingsCacheKeys = [
    "withdrawal_fee_mode",
    "withdrawal_fee_value",
    "withdrawal_fee_tiers",
    "min_withdrawal_amount",
  ];
  for (const k of settingsCacheKeys) {
    if (Object.prototype.hasOwnProperty.call(body, k)) {
      deleteCache(`settings:${k}`);
    }
  }
  return ok({ message: "Configuration updated" });
}
