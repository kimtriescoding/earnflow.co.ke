import { getEnv } from "@/lib/env";
import { getSetting } from "@/models/Settings";

function toAmount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Number(numeric.toFixed(2));
}

export async function resolveActivationFee() {
  const env = getEnv();
  const envAmount = toAmount(env.ACTIVATION_FEE_KSH);
  if (envAmount <= 0) {
    throw new Error("ACTIVATION_FEE_KSH must be a positive number");
  }
  if (env.ACTIVATION_FEE_ALLOW_ADMIN_OVERRIDE !== "true") {
    return { amount: envAmount, source: "env" };
  }
  const override = await getSetting("activation_fee", {});
  const overrideAmount = toAmount(override?.amount);
  if (overrideAmount > 0) {
    return { amount: overrideAmount, source: "admin_override" };
  }
  return { amount: envAmount, source: "env" };
}
