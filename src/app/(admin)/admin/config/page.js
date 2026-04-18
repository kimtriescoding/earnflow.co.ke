"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/ui/AppShell";
import { adminNavItems } from "@/lib/nav/admin-nav";
import { toast } from "sonner";

const MODULE_LABELS = {
  video: "Video",
  task: "Tasks",
  lucky_spin: "Lucky Spin",
  aviator: "Aviator",
  academic: "Academic",
  chat: "Chat",
};

export default function AdminConfigPage() {
  const [activationFee, setActivationFee] = useState(1000);
  const [minWithdrawalAmount, setMinWithdrawalAmount] = useState(0);
  const [withdrawalFeeMode, setWithdrawalFeeMode] = useState("fixed");
  const [withdrawalFeeValue, setWithdrawalFeeValue] = useState(0);
  const [zetupayPublicKey, setZetupayPublicKey] = useState("");
  const [zetupayPrivateKey, setZetupayPrivateKey] = useState("");
  const [zetupayWalletId, setZetupayWalletId] = useState("");
  const [levels, setLevels] = useState({
    level1Enabled: true,
    level1Amount: 100,
    level2Enabled: true,
    level2Amount: 50,
    level3Enabled: true,
    level3Amount: 25,
  });
  const [modules, setModules] = useState({
    video: true,
    task: true,
    lucky_spin: true,
    aviator: true,
    academic: true,
    chat: true,
  });
  const [clientServicesEnabled, setClientServicesEnabled] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/config")
      .then((res) => res.json())
      .then((data) => {
        if (!data?.success) return;
        const map = Object.fromEntries((data.data || []).map((item) => [item.key, item.value]));
        if (map.activation_fee?.amount) setActivationFee(Number(map.activation_fee.amount));
        if (map.min_withdrawal_amount !== undefined) setMinWithdrawalAmount(Number(map.min_withdrawal_amount || 0));
        if (map.withdrawal_fee_mode) setWithdrawalFeeMode(String(map.withdrawal_fee_mode));
        if (map.withdrawal_fee_value !== undefined) setWithdrawalFeeValue(Number(map.withdrawal_fee_value || 0));
        const gateway = map.zetupay_primary || map.wavepay_primary;
        if (gateway?.publicKey) setZetupayPublicKey(gateway.publicKey);
        if (gateway?.walletId) setZetupayWalletId(gateway.walletId);
        if (map.referral_commissions) {
          setLevels({
            level1Enabled: Boolean(map.referral_commissions.level1?.enabled),
            level1Amount: Number(map.referral_commissions.level1?.amount || 0),
            level2Enabled: Boolean(map.referral_commissions.level2?.enabled),
            level2Amount: Number(map.referral_commissions.level2?.amount || 0),
            level3Enabled: Boolean(map.referral_commissions.level3?.enabled),
            level3Amount: Number(map.referral_commissions.level3?.amount || 0),
          });
        }
        if (map.module_status) {
          const ms = map.module_status;
          const hasLucky = Object.prototype.hasOwnProperty.call(ms, "lucky_spin");
          const hasAviator = Object.prototype.hasOwnProperty.call(ms, "aviator");
          const gameLegacy = ms.game !== false;
          setModules({
            video: ms.video !== false,
            task: ms.task !== false,
            lucky_spin: hasLucky ? ms.lucky_spin !== false : gameLegacy,
            aviator: hasAviator ? ms.aviator !== false : gameLegacy,
            academic: ms.academic !== false,
            chat: ms.chat !== false,
          });
        }
        if (map.client_services_enabled !== undefined) {
          setClientServicesEnabled(Boolean(map.client_services_enabled));
        }
      })
      .catch(() => {});
  }, []);

  async function save() {
    const credentialsPayload = {
      publicKey: zetupayPublicKey,
      walletId: zetupayWalletId,
      ...(String(zetupayPrivateKey || "").trim() ? { privateKey: zetupayPrivateKey } : {}),
    };
    const res = await fetch("/api/admin/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        activation_fee: { amount: Number(activationFee), currency: "KES" },
        min_withdrawal_amount: Number(minWithdrawalAmount),
        withdrawal_fee_mode: withdrawalFeeMode === "percentage" ? "percentage" : "fixed",
        withdrawal_fee_value: Number(withdrawalFeeValue),
        zetupay_primary: credentialsPayload,
        referral_commissions: {
          level1: { enabled: levels.level1Enabled, amount: Number(levels.level1Amount) },
          level2: { enabled: levels.level2Enabled, amount: Number(levels.level2Amount) },
          level3: { enabled: levels.level3Enabled, amount: Number(levels.level3Amount) },
        },
        module_status: {
          video: modules.video,
          task: modules.task,
          lucky_spin: modules.lucky_spin,
          aviator: modules.aviator,
          academic: modules.academic,
          chat: modules.chat,
        },
        client_services_enabled: clientServicesEnabled,
      }),
    });
    const data = await res.json();
    const msg = data.success ? "Configuration saved." : "Failed to save configuration.";
    setMessage(msg);
    if (data.success) toast.success(msg);
    else toast.error(msg);
  }

  return (
    <AppShell title="Economy Configuration" navItems={adminNavItems}>
      <div className="card-surface rounded-3xl p-6">
        <h2 className="heading-display text-lg font-semibold">Global settings</h2>
        <p className="mt-1 text-sm muted-text">Update economic controls used across all earning modules.</p>
        <div className="mt-5 grid gap-4">
          <section className="rounded-2xl border bg-[var(--surface-soft)] p-4">
            <h3 className="heading-display text-sm font-semibold">Core economy</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="grid gap-1 text-sm">
                <span className="muted-text">Activation fee (KES)</span>
                <input
                  className="interactive-control focus-ring px-3.5 py-2.5"
                  value={activationFee}
                  onChange={(e) => setActivationFee(e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="muted-text">Minimum withdrawal (KES)</span>
                <input
                  className="interactive-control focus-ring px-3.5 py-2.5"
                  value={minWithdrawalAmount}
                  onChange={(e) => setMinWithdrawalAmount(e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="muted-text">Withdrawal fee mode</span>
                <select
                  className="interactive-control focus-ring px-3.5 py-2.5"
                  value={withdrawalFeeMode}
                  onChange={(e) => setWithdrawalFeeMode(e.target.value === "percentage" ? "percentage" : "fixed")}
                >
                  <option value="fixed">fixed</option>
                  <option value="percentage">percentage</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="muted-text">Withdrawal fee value ({withdrawalFeeMode === "percentage" ? "%" : "KES"})</span>
                <input
                  className="interactive-control focus-ring px-3.5 py-2.5"
                  value={withdrawalFeeValue}
                  onChange={(e) => setWithdrawalFeeValue(e.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border bg-[var(--surface-soft)] p-4">
            <h3 className="heading-display text-sm font-semibold">Zetupay credentials</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <input
                className="interactive-control focus-ring px-3.5 py-2.5"
                value={zetupayPublicKey}
                onChange={(e) => setZetupayPublicKey(e.target.value)}
                placeholder="Public key"
              />
              <input
                className="interactive-control focus-ring px-3.5 py-2.5"
                value={zetupayPrivateKey}
                onChange={(e) => setZetupayPrivateKey(e.target.value)}
                placeholder="Set new private key (optional)"
              />
              <input
                className="interactive-control focus-ring px-3.5 py-2.5"
                value={zetupayWalletId}
                onChange={(e) => setZetupayWalletId(e.target.value)}
                placeholder="Wallet ID"
              />
            </div>
          </section>

          <section className="rounded-2xl border bg-[var(--surface-soft)] p-4">
            <h3 className="heading-display text-sm font-semibold">Referral signup bonuses (upline tiers)</h3>
            <p className="mt-1 max-w-3xl text-xs muted-text">
              Fixed KES paid when a referred user activates. Level 1 is the direct inviter; levels 2–3 pay that inviter’s sponsors
              (upstream). This is not the same as “level 2” in the affiliate network tab (referrals of referrals).
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {[
                { enabledKey: "level1Enabled", amountKey: "level1Amount", label: "Upline L1 — direct inviter" },
                { enabledKey: "level2Enabled", amountKey: "level2Amount", label: "Upline L2 — inviter’s sponsor" },
                { enabledKey: "level3Enabled", amountKey: "level3Amount", label: "Upline L3 — inviter’s L2 sponsor" },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border bg-[var(--surface)] p-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(levels[item.enabledKey])}
                      onChange={(e) => setLevels((p) => ({ ...p, [item.enabledKey]: e.target.checked }))}
                    />
                    {item.label}
                  </label>
                  <input
                    className="interactive-control focus-ring mt-2 w-full rounded-lg bg-[var(--surface)] px-2.5 py-1.5 text-sm"
                    value={levels[item.amountKey]}
                    onChange={(e) => setLevels((p) => ({ ...p, [item.amountKey]: e.target.value }))}
                    placeholder="KES amount"
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border bg-[var(--surface-soft)] p-4">
            <h3 className="heading-display text-sm font-semibold">Module enable / disable</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
              {Object.keys(modules).map((key) => (
                <label key={key} className="flex items-center gap-2 rounded-xl border bg-[var(--surface)] px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(modules[key])}
                    onChange={(e) => setModules((p) => ({ ...p, [key]: e.target.checked }))}
                  />
                  {MODULE_LABELS[key] || key}
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border bg-[var(--surface-soft)] p-4">
            <h3 className="heading-display text-sm font-semibold">Client services feature flag</h3>
            <label className="mt-3 flex items-center gap-2 rounded-xl border bg-[var(--surface)] px-3 py-2 text-sm">
              <input type="checkbox" checked={clientServicesEnabled} onChange={(e) => setClientServicesEnabled(e.target.checked)} />
              Enable client services marketplace (videos, chat, academic)
            </label>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={save} className="primary-btn w-fit px-4 py-2 text-sm">
              Save settings
            </button>
            {message ? <p className="text-sm muted-text">{message}</p> : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
