"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = ["#0f766e", "#14b8a6", "#10b8d5", "#f973ae", "#10b981", "#f59e0b", "#ef4444"];

export function SourceBreakdownChart({ data = [], title = "Earnings by source", subtitle = "Share of each category" }) {
  const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const withPercent = data.map((item) => {
    const value = Number(item.value || 0);
    const percent = total > 0 ? (value / total) * 100 : 0;
    return { ...item, value, percent };
  });

  const TooltipContent = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const item = payload[0]?.payload;
    if (!item) return null;
    return (
      <div className="rounded-xl border border-white/20 bg-[color-mix(in_srgb,var(--surface-strong)_88%,transparent)] px-3 py-2 shadow-xl backdrop-blur-md">
        <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">{item.name}</p>
        <p className="mt-1 heading-display text-base font-semibold text-[var(--foreground)]">KES {item.value.toLocaleString()}</p>
        <p className="text-xs muted-text">{item.percent.toFixed(1)}%</p>
      </div>
    );
  };

  return (
    <div className="card-surface relative overflow-hidden rounded-2xl border border-white/10 p-4 sm:p-5">
      <div className="pointer-events-none absolute -bottom-14 -left-10 h-36 w-36 rounded-full bg-[color-mix(in_srgb,var(--accent)_24%,transparent)] blur-3xl" />
      <div className="relative z-10 mb-3 flex items-end justify-between gap-2">
        <div>
          <h3 className="heading-display text-sm font-semibold sm:text-base">{title}</h3>
          <p className="text-xs muted-text">{subtitle}</p>
        </div>
        <p className="heading-display text-sm font-semibold text-[var(--foreground)]">KES {total.toLocaleString()}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_170px]">
        <div className="relative h-48 w-full sm:h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={withPercent} dataKey="value" nameKey="name" innerRadius={54} outerRadius={88} paddingAngle={3}>
                {withPercent.map((entry, idx) => (
                  // Stable color cycle keeps categories recognizable between reloads.
                <Cell key={`${entry.name}-${idx}`} fill={COLORS[idx % COLORS.length]} />
              ))}
              </Pie>
              <Tooltip content={<TooltipContent />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-full border border-white/15 bg-[color-mix(in_srgb,var(--surface-strong)_84%,transparent)] px-4 py-2 text-center backdrop-blur-sm">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Total</p>
              <p className="heading-display text-sm font-semibold text-[var(--foreground)]">{withPercent.length}</p>
              <p className="text-[11px] muted-text">sources</p>
            </div>
          </div>
        </div>
        <div className="space-y-1.5 overflow-y-auto pr-1">
          {withPercent.slice(0, 6).map((item, idx) => (
            <div
              key={item.name}
              className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 backdrop-blur-sm"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                <span className="truncate text-xs text-[var(--foreground)]">{item.name}</span>
              </div>
              <span className="text-[11px] font-medium text-[var(--muted)]">{item.percent.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
