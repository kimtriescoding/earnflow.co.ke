"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/ui/AppShell";
import { adminNavItems } from "@/lib/nav/admin-nav";
import { EarningsSeriesChart } from "@/components/charts/EarningsSeriesChart";
import { SourceBreakdownChart } from "@/components/charts/SourceBreakdownChart";
import { FlowComparisonChart } from "@/components/charts/FlowComparisonChart";
import { StatCard } from "@/components/ui/StatCard";
import { DASHBOARD_EARNINGS_TIMEZONE } from "@/lib/config/dashboard-timezone";
import { defaultRollingRangeYmd } from "@/lib/datetime/zoned-range";

const emptySummary = {
  totalSignups: 0,
  totalActivationRevenue: 0,
  totalCommissionsPaid: 0,
  totalWithdrawalsPaid: 0,
  totalOutflow: 0,
  netFlow: 0,
};

const TZ = DASHBOARD_EARNINGS_TIMEZONE;

function buildQuery(fromYmd, toYmd) {
  const p = new URLSearchParams();
  p.set("from", fromYmd);
  p.set("to", toYmd);
  return `/api/admin/analytics?${p.toString()}`;
}

export default function AdminAnalyticsPage() {
  const [series, setSeries] = useState([]);
  const [breakdown, setBreakdown] = useState([]);
  const [summary, setSummary] = useState(emptySummary);
  const [statsTz, setStatsTz] = useState("");
  const [fromYmd, setFromYmd] = useState("");
  const [toYmd, setToYmd] = useState("");
  const [rangeDays, setRangeDays] = useState(14);
  const [maxRangeDays, setMaxRangeDays] = useState(120);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (url) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (!data.success) {
        setError(String(data.message || "Could not load analytics."));
        return;
      }
      setSeries(data.data?.series || []);
      setBreakdown(data.data?.sourceBreakdown || []);
      setStatsTz(String(data.data?.statsTimeZone || ""));
      const r = data.data?.range;
      if (r?.from && r?.to) {
        setFromYmd(r.from);
        setToYmd(r.to);
        setRangeDays(Number(r.days || 0) || 14);
        if (r.maxDays != null) setMaxRangeDays(Number(r.maxDays));
      }
      const s = data.data?.summary || {};
      setSummary({
        totalSignups: Number(s.totalSignups || 0),
        totalActivationRevenue: Number(s.totalActivationRevenue || 0),
        totalCommissionsPaid: Number(s.totalCommissionsPaid || 0),
        totalWithdrawalsPaid: Number(s.totalWithdrawalsPaid || 0),
        totalOutflow: Number(s.totalOutflow || 0),
        netFlow: Number(s.netFlow || 0),
      });
    } catch {
      setError("Network error while loading analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load("/api/admin/analytics");
  }, [load]);

  const applyRange = () => {
    if (!fromYmd || !toYmd) return;
    load(buildQuery(fromYmd, toYmd));
  };

  const applyPreset = (days) => {
    const { fromYmd: f, toYmd: t } = defaultRollingRangeYmd({ days, timeZone: statsTz || TZ });
    setFromYmd(f);
    setToYmd(t);
    load(buildQuery(f, t));
  };

  const lineSeries = series.map((x) => ({ label: x.label, value: Number(x.inflow ?? x.earnings ?? 0) }));
  const flowSeries = series.map((x) => ({
    label: x.label,
    inflow: Number(x.inflow ?? x.earnings ?? 0),
    outflow: Number(x.outflow ?? x.payouts ?? 0),
  }));

  const rangeHint = `${rangeDays} calendar day${rangeDays === 1 ? "" : "s"}`;
  const statSuffix = ` (${rangeHint})`;

  return (
    <AppShell title="Platform Analytics" navItems={adminNavItems}>
      <div className="card-surface neon-outline mb-3 flex flex-col gap-3 rounded-[var(--radius-panel)] p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow-label">Date range</p>
            <p className="mt-0.5 text-xs muted-text">
              Buckets use {statsTz || TZ}. Aggregations are capped at {maxRangeDays} days per request.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                disabled={loading}
                onClick={() => applyPreset(d)}
                className="secondary-btn px-3 py-1.5 text-xs disabled:opacity-50"
              >
                Last {d}d
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium text-[var(--foreground)]">
            From
            <input
              type="date"
              value={fromYmd}
              onChange={(e) => setFromYmd(e.target.value)}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 py-2 text-sm text-[var(--foreground)]"
            />
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium text-[var(--foreground)]">
            To
            <input
              type="date"
              value={toYmd}
              onChange={(e) => setToYmd(e.target.value)}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 py-2 text-sm text-[var(--foreground)]"
            />
          </label>
          <button
            type="button"
            disabled={loading || !fromYmd || !toYmd}
            onClick={applyRange}
            className="primary-btn neon-ring shrink-0 px-4 py-2 text-sm disabled:opacity-50"
          >
            {loading ? "Loading…" : "Apply range"}
          </button>
        </div>
        {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={`New signups${statSuffix}`} value={String(summary.totalSignups)} hint="New user + client accounts" />
        <StatCard
          label={`Activation revenue${statSuffix}`}
          value={`KES ${summary.totalActivationRevenue.toFixed(2)}`}
          tone="success"
          hint="Successful activation checkouts"
        />
        <StatCard
          label={`Cash out${statSuffix}`}
          value={`KES ${summary.totalOutflow.toFixed(2)}`}
          tone="danger"
          hint="Commissions + withdrawals (incl. fees)"
        />
        <StatCard
          label={`Net${statSuffix}`}
          value={`KES ${summary.netFlow.toFixed(2)}`}
          tone={summary.netFlow >= 0 ? "success" : "danger"}
          hint="Activations minus cash out"
        />
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        <EarningsSeriesChart
          data={lineSeries}
          title="Activation revenue by day"
          subtitle={`Successful checkouts — ${fromYmd && toYmd ? `${fromYmd} → ${toYmd}` : rangeHint}`}
        />
        <SourceBreakdownChart
          data={breakdown}
          title="Outflows split"
          subtitle={`Commissions vs withdrawals — ${rangeHint}`}
        />
      </div>
      <FlowComparisonChart
        data={flowSeries}
        title="Activations vs cash out"
        moneyInLabel="Activations"
        moneyOutLabel="Commissions + withdrawals"
        chartSubtitle={fromYmd && toYmd ? `Each bar is one day (${fromYmd} → ${toYmd})` : "Each bar is one day in app time zone"}
      />
    </AppShell>
  );
}
