"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/ui/AppShell";
import { adminNavItems } from "@/lib/nav/admin-nav";
import { toast } from "sonner";
import { BarChart3, CreditCard, Plane, Orbit, Loader2 } from "lucide-react";

const ITEMS = [
  {
    key: "activation",
    title: "Activation checkout",
    description: "Account activation via Zetupay. When off, checkout still works but the gateway receives a non-real flag.",
    icon: CreditCard,
  },
  {
    key: "aviatorTopup",
    title: "Aviator top-up",
    description: "In-game top-up from checkout. Same behavior: payments continue; only the real flag and reporting change.",
    icon: Plane,
  },
  {
    key: "luckySpinTopup",
    title: "Lucky Spin top-up",
    description: "Lucky Spin checkout top-ups. Toggles the real flag for new initiations only.",
    icon: Orbit,
  },
];

const TALLY_KEYS = [
  { key: "activation_fee", label: "Activation fee (main wallet row)" },
  { key: "aviator_topup_checkout", label: "Aviator checkout top-up" },
  { key: "lucky_spin_topup_checkout", label: "Lucky Spin checkout top-up" },
];

export default function SwitcherPageClient() {
  const [loading, setLoading] = useState(true);
  const [switches, setSwitches] = useState({ activation: true, aviatorTopup: true, luckySpinTopup: true });
  const [tallies, setTallies] = useState({});
  const [saving, setSaving] = useState(false);

  async function loadData() {
    setLoading(true);
    const res = await fetch("/api/admin/switcher");
    const data = await res.json().catch(() => ({}));
    if (!data.success) {
      toast.error(data.message || "Unable to load switcher.");
      setLoading(false);
      return;
    }
    setSwitches(data.data?.switches || { activation: true, aviatorTopup: true, luckySpinTopup: true });
    setTallies(data.data?.tallies || {});
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/admin/switcher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(switches),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!data.success) {
      toast.error(data.message || "Unable to save switcher.");
      return;
    }
    toast.success("Switcher updated.");
    await loadData();
  }

  return (
    <AppShell title="Switcher" navItems={adminNavItems}>
      <div className="space-y-6">
        <header className="card-surface rounded-3xl p-6 md:p-8">
          <p className="eyebrow-label text-xs uppercase tracking-[0.14em]">Superadmin</p>
          <h2 className="heading-display mt-1 text-xl font-semibold md:text-2xl">Payment reality</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed muted-text">
            Each control is a <strong className="font-semibold text-[var(--foreground)]">real</strong> switch for that flow. When
            turned off, users still pay and the system still credits as usual; only the provider flag and how totals treat those
            transactions change. Synthetic activity is tallied at the bottom.
          </p>
        </header>

        <div className="grid gap-4">
          {ITEMS.map((item) => {
            const on = Boolean(switches[item.key]);
            const Icon = item.icon;
            return (
              <div
                key={item.key}
                className="card-surface flex flex-col gap-4 rounded-3xl border border-[color-mix(in_oklab,var(--border)_50%,transparent)] p-5 md:flex-row md:items-center md:justify-between md:gap-6"
              >
                <div className="flex min-w-0 flex-1 gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[color-mix(in_oklab,var(--brand)_32%,var(--border))] bg-[color-mix(in_srgb,var(--brand)_10%,var(--surface-soft))] text-[var(--brand)]">
                    <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <h3 className="heading-display text-base font-semibold">{item.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed muted-text">{item.description}</p>
                    <p className="mt-2 text-xs font-medium text-[var(--muted)]">
                      Status:{" "}
                      <span
                        className={
                          on
                            ? "text-[color-mix(in_srgb,var(--success)_90%,var(--foreground))]"
                            : "text-[color-mix(in_srgb,var(--warning)_90%,var(--foreground))]"
                        }
                      >
                        {on ? "Real (live reporting)" : "Test / non-real (excluded from revenue totals)"}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center justify-between gap-4 border-t border-[var(--border)] pt-4 md:border-t-0 md:pt-0">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)] md:hidden">Toggle</span>
                  <div className="flex items-center gap-3">
                    <span
                      className={`hidden text-sm font-medium sm:inline ${on ? "text-[var(--foreground)]" : "text-[var(--muted)]"}`}
                      id={`switcher-label-${item.key}`}
                    >
                      {on ? "On" : "Off"}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      aria-labelledby={`switcher-label-${item.key}`}
                      disabled={loading}
                      onClick={() => setSwitches((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                      className={`inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-50 ${
                        on ? "justify-end bg-[var(--brand)]" : "justify-start bg-[color-mix(in_oklab,var(--border)_75%,var(--surface))]"
                      }`}
                    >
                      <span className="pointer-events-none block h-6 w-6 rounded-full bg-white shadow" aria-hidden />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={save}
            disabled={saving || loading}
            className="primary-btn px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
                Saving…
              </span>
            ) : (
              "Save changes"
            )}
          </button>
          {loading ? (
            <span className="inline-flex items-center gap-1.5 text-sm muted-text">
              <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
              Loading…
            </span>
          ) : null}
        </div>

        <section className="card-surface rounded-3xl p-6 md:p-8">
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--brand)]">
              <BarChart3 className="h-5 w-5" strokeWidth={2} aria-hidden />
            </div>
            <div>
              <h3 className="heading-display text-base font-semibold">Synthetic payment tally</h3>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed muted-text">
                Counts and absolute amounts for transactions where <code className="rounded bg-[var(--surface)] px-1.5 py-0.5 text-xs">real</code> is
                false (activation fee debits, Aviator and Lucky Spin checkout top-up rows). These still appear in feeds but are excluded from
                revenue-style sums elsewhere.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="mt-6 flex items-center justify-center py-8 text-sm muted-text">
              <Loader2 className="mr-2 h-5 w-5 motion-safe:animate-spin" />
              Loading tallies…
            </div>
          ) : (
            <ul className="mt-6 grid gap-3 sm:grid-cols-3">
              {TALLY_KEYS.map(({ key, label }) => {
                const t = tallies[key] || {};
                const count = Number(t.count || 0);
                const total = Number(t.totalAmount || 0).toFixed(2);
                return (
                  <li
                    key={key}
                    className="rounded-2xl border border-[color-mix(in_oklab,var(--border)_45%,transparent)] bg-[var(--surface-soft)] p-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">{label}</p>
                    <p className="heading-display mt-2 text-2xl font-semibold tabular-nums">{count}</p>
                    <p className="mt-0.5 text-xs muted-text">transactions</p>
                    <p className="mt-3 border-t border-[var(--border)] pt-3 text-sm">
                      <span className="text-[var(--muted)]">KES</span>{" "}
                      <span className="font-semibold tabular-nums text-[var(--foreground)]">{total}</span>
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
