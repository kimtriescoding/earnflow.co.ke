"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function FlowComparisonChart({
  data = [],
  title = "Inflow vs outflow",
  moneyInLabel = "Inflow",
  moneyOutLabel = "Outflow",
  chartSubtitle = "Each bar is one day",
}) {
  const totalInflow = data.reduce((sum, item) => sum + Number(item.inflow || 0), 0);
  const totalOutflow = data.reduce((sum, item) => sum + Number(item.outflow || 0), 0);
  const net = totalInflow - totalOutflow;

  const tooltipRender = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const inflow = Number(payload.find((x) => x.dataKey === "inflow")?.value || 0);
    const outflow = Number(payload.find((x) => x.dataKey === "outflow")?.value || 0);
    return (
      <div className="rounded-xl border border-white/20 bg-[color-mix(in_srgb,var(--surface-strong)_88%,transparent)] px-3 py-2 shadow-xl backdrop-blur-md">
        <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">{label}</p>
        <p className="mt-1 text-xs text-emerald-300">
          {moneyInLabel}: KES {inflow.toLocaleString()}
        </p>
        <p className="text-xs text-rose-300">
          {moneyOutLabel}: KES {outflow.toLocaleString()}
        </p>
      </div>
    );
  };

  return (
    <div className="card-surface relative overflow-hidden rounded-2xl border border-white/10 p-3 sm:p-5">
      <div className="pointer-events-none absolute -right-12 bottom-0 h-36 w-36 rounded-full bg-[color-mix(in_srgb,var(--accent-strong)_20%,transparent)] blur-3xl" />
      <div className="relative z-10 mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="heading-display text-sm font-semibold sm:text-base">{title}</h3>
          <p className="text-xs muted-text">{chartSubtitle}</p>
        </div>
        <div
          className={`rounded-lg border px-2.5 py-1 text-sm font-semibold backdrop-blur-md ${
            net >= 0
              ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-200"
              : "border-rose-300/30 bg-rose-500/10 text-rose-200"
          }`}
        >
          Net {net >= 0 ? "+" : ""}KES {net.toLocaleString()}
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1.5 text-[var(--muted)]">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--success)]" />
          <span className="min-w-0">
            {moneyInLabel} · KES {totalInflow.toLocaleString()}
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-[var(--muted)]">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--danger)]" />
          <span className="min-w-0">
            {moneyOutLabel} · KES {totalOutflow.toLocaleString()}
          </span>
        </span>
      </div>
      <div className="h-44 w-full min-[400px]:h-48 sm:h-56 md:h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 4, left: 0, bottom: 0 }} barGap={3}>
            <defs>
              <linearGradient id="inflowGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--success)" stopOpacity={0.92} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.45} />
              </linearGradient>
              <linearGradient id="outflowGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--danger)" stopOpacity={0.94} />
                <stop offset="100%" stopColor="var(--accent-strong)" stopOpacity={0.48} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" opacity={0.22} vertical={false} />
            <XAxis axisLine={false} tickLine={false} dataKey="label" tick={{ fontSize: 10, fill: "var(--muted)" }} minTickGap={6} height={40} />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "var(--muted)" }}
              tickFormatter={(v) => `${Math.round(Number(v || 0) / 1000)}k`}
              width={40}
            />
            <Tooltip cursor={{ fill: "rgba(148, 163, 184, 0.08)" }} content={tooltipRender} />
            <Bar dataKey="inflow" name={moneyInLabel} fill="url(#inflowGradient)" radius={[8, 8, 0, 0]} maxBarSize={18} />
            <Bar dataKey="outflow" name={moneyOutLabel} fill="url(#outflowGradient)" radius={[8, 8, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
