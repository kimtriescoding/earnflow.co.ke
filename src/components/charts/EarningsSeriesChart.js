"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function EarningsSeriesChart({ data = [], title = "Earnings trend", subtitle = "Per calendar day" }) {
  const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0);

  const TooltipContent = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const amount = Number(payload[0]?.value || 0);
    return (
      <div className="rounded-xl border border-white/20 bg-[color-mix(in_srgb,var(--surface-strong)_88%,transparent)] px-3 py-2 shadow-xl backdrop-blur-md">
        <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">{label}</p>
        <p className="mt-1 heading-display text-base font-semibold text-[var(--foreground)]">KES {amount.toLocaleString()}</p>
      </div>
    );
  };

  return (
    <div className="card-surface relative overflow-hidden rounded-2xl border border-white/10 p-4 sm:p-5">
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[color-mix(in_srgb,var(--brand)_30%,transparent)] blur-3xl" />
      <div className="relative z-10 mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="heading-display text-sm font-semibold sm:text-base">{title}</h3>
          <p className="text-xs muted-text">{subtitle}</p>
        </div>
        <div className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-right backdrop-blur-md">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Total</p>
          <p className="heading-display text-sm font-semibold text-[var(--foreground)]">KES {total.toLocaleString()}</p>
        </div>
      </div>
      <div className="h-48 w-full sm:h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="earningsGlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.45} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" opacity={0.25} vertical={false} />
            <XAxis axisLine={false} tickLine={false} dataKey="label" tick={{ fontSize: 11, fill: "var(--muted)" }} />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "var(--muted)" }}
              tickFormatter={(v) => `${Math.round(Number(v || 0) / 1000)}k`}
              width={46}
            />
            <Tooltip cursor={{ stroke: "var(--brand)", strokeOpacity: 0.3 }} content={<TooltipContent />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--brand)"
              strokeWidth={2.5}
              fill="url(#earningsGlow)"
              activeDot={{ r: 4, fill: "var(--accent)", stroke: "white", strokeWidth: 1.5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
