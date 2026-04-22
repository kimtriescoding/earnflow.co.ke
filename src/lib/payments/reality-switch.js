import { getSetting } from "@/models/Settings";

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
