import { getSetting } from "@/models/Settings";
import { deleteCache } from "@/lib/cache/config-cache";

export const REALITY_SWITCH_KEYS = {
  activation: "payment_real_activation",
  aviatorTopup: "payment_real_aviator_topup",
  luckySpinTopup: "payment_real_lucky_spin_topup",
};

function normalizeRealSwitch(value) {
  return value !== false;
}

export async function getPaymentRealSwitches() {
  const [activation, aviatorTopup, luckySpinTopup] = await Promise.all([
    getSetting(REALITY_SWITCH_KEYS.activation, true),
    getSetting(REALITY_SWITCH_KEYS.aviatorTopup, true),
    getSetting(REALITY_SWITCH_KEYS.luckySpinTopup, true),
  ]);
  return {
    activation: normalizeRealSwitch(activation),
    aviatorTopup: normalizeRealSwitch(aviatorTopup),
    luckySpinTopup: normalizeRealSwitch(luckySpinTopup),
  };
}

/** Call after updating payment-real settings so `getSetting` reads fresh values (see Settings in-memory cache). */
export function invalidatePaymentRealSwitchCache() {
  for (const key of Object.values(REALITY_SWITCH_KEYS)) {
    deleteCache(`settings:${key}`);
  }
}
