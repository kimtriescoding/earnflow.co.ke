"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ChevronRight,
  CreditCard,
  Gamepad2,
  GraduationCap,
  Network,
  PlayCircle,
  Rocket,
  Settings,
  Shield,
  Users,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/ui/AppShell";
import { StatCard } from "@/components/ui/StatCard";
import { adminNavItems } from "@/lib/nav/admin-nav";
import { FlowComparisonChart } from "@/components/charts/FlowComparisonChart";

const quickNavIconMap = {
  admin: Shield,
  users: Users,
  analytics: BarChart3,
  referrals: Network,
  videos: PlayCircle,
  games: Gamepad2,
  aviator: Rocket,
  academic: GraduationCap,
  withdrawals: Wallet,
  payments: CreditCard,
  config: Settings,
};

const emptySummary = {
  totalUsers: 0,
  totalActiveUsers: 0,
  totalInactiveUsers: 0,
  activatedToday: 0,
  activationPaymentsToday: 0,
  commissionsPaidToday: 0,
  totalCommissionsPaid: 0,
  earningsToday: 0,
  totalWithdrawable: 0,
  pendingWithdrawals: 0,
  completedWithdrawals: 0,
  statsTimeZone: "",
};

function kes(n) {
  return `KES ${Number(n || 0).toFixed(2)}`;
}

export default function AdminPage() {
  const pathname = usePathname();
  const normalizedPath = (pathname || "").replace(/\/+$/, "") || "/";

  const [summary, setSummary] = useState(emptySummary);
  const [flowData, setFlowData] = useState([]);

  useEffect(() => {
    Promise.all([fetch("/api/admin/summary").then((res) => res.json()), fetch("/api/admin/analytics").then((res) => res.json())])
      .then(([summaryRes, analyticsRes]) => {
        if (summaryRes?.success && summaryRes?.data) setSummary({ ...emptySummary, ...summaryRes.data });
        if (analyticsRes?.success) {
          setFlowData(
            (analyticsRes.data?.series || []).map((item) => ({
              label: item.label,
              inflow: Number(item.inflow ?? item.earnings ?? 0),
              outflow: Number(item.outflow ?? item.payouts ?? 0),
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  return (
    <AppShell
      title="Admin Control Center"
      navItems={adminNavItems}
      rightSlot={
        <Link
          href="/admin/users"
          className="primary-btn neon-ring hidden shrink-0 items-center justify-center px-3 py-2 text-xs whitespace-nowrap md:inline-flex md:px-3.5 md:text-sm lg:px-4"
        >
          <span className="lg:hidden">Users</span>
          <span className="hidden lg:inline">Manage users</span>
        </Link>
      }
    >
      <div className="grid grid-cols-1 gap-2 sm:gap-3 md:grid-cols-2 xl:grid-cols-4 xl:gap-3">
        <StatCard label="Total users" value={String(summary.totalUsers)} hint="All accounts" />
        <StatCard
          label="Total active users"
          value={String(summary.totalActiveUsers)}
          tone="success"
          hint="Activated and not blocked"
        />
        <StatCard label="Total inactive users" value={String(summary.totalInactiveUsers)} hint="Not activated or blocked" />
        <StatCard label="Activated today" value={String(summary.activatedToday)} hint="Accounts that finished activation today" />
        <StatCard
          label="Activation payments today"
          value={kes(summary.activationPaymentsToday)}
          hint="Money collected from activations today"
        />
        <StatCard label="Total commission paid" value={kes(summary.totalCommissionsPaid)} hint="Referral payouts, all time" />
        <StatCard
          label="Earnings today"
          value={kes(summary.earningsToday)}
          tone={summary.earningsToday >= 0 ? "default" : "danger"}
          hint="Today: activations minus commissions"
        />
        <StatCard label="Total withdrawable balances" value={kes(summary.totalWithdrawable)} hint="Main wallets, available only" />
      </div>
      {summary.statsTimeZone ? (
        <p className="mt-2 text-center text-xs muted-text">Today is the calendar day in {summary.statsTimeZone}.</p>
      ) : null}

      <div className="mt-6 grid gap-[var(--space-section)] md:grid-cols-2">
        <div className="card-surface neon-outline rounded-[var(--radius-panel)] section-card">
          <h2 className="section-title">Withdrawal status</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="panel-tile p-4">
              <p className="eyebrow-label">Pending</p>
              <p className="heading-display mt-2 text-2xl font-semibold">{summary.pendingWithdrawals}</p>
            </div>
            <div className="panel-tile p-4">
              <p className="eyebrow-label">Completed</p>
              <p className="heading-display mt-2 text-2xl font-semibold">{summary.completedWithdrawals}</p>
            </div>
          </div>
        </div>
        <div className="card-surface neon-outline rounded-[var(--radius-panel)] section-card">
          <h2 className="section-title text-base leading-tight">Quick navigation</h2>
          <ul className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {adminNavItems
              .filter((item) => item.href !== "/admin")
              .map((item) => {
                const Icon = quickNavIconMap[item.icon] || Shield;
                const hrefNorm = (item.href || "").replace(/\/+$/, "") || "/";
                const isActive =
                  normalizedPath === hrefNorm || (hrefNorm !== "/admin" && normalizedPath.startsWith(`${hrefNorm}/`));
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={item.label}
                      className={`group flex items-center gap-2 rounded-xl border px-2 py-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--brand)_65%,transparent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface)] ${
                        isActive
                          ? "border-[color-mix(in_srgb,var(--brand)_45%,var(--border))] bg-[color-mix(in_srgb,var(--brand)_10%,var(--surface-soft))]"
                          : "border-[var(--border)] bg-[var(--surface-soft)] hover:border-[color-mix(in_srgb,var(--brand)_35%,var(--border))] hover:bg-[color-mix(in_srgb,var(--brand)_6%,var(--surface-soft))]"
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition ${
                          isActive
                            ? "border-[color-mix(in_srgb,var(--brand)_35%,var(--border))] bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] text-[var(--brand)]"
                            : "border-[var(--border)] bg-[var(--surface)] text-[var(--brand)]"
                        }`}
                      >
                        <Icon size={14} strokeWidth={2} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-left text-xs font-medium leading-tight text-[var(--foreground)]">
                        {item.label}
                      </span>
                      <ChevronRight
                        className={`h-3.5 w-3.5 shrink-0 opacity-60 transition group-hover:opacity-100 ${
                          isActive ? "text-[var(--brand)] opacity-100" : "text-[var(--muted)]"
                        }`}
                        aria-hidden
                      />
                    </Link>
                  </li>
                );
              })}
          </ul>
        </div>
      </div>
      <div className="card-surface neon-outline mt-6 rounded-[var(--radius-panel)] section-card">
        <h2 className="section-title">Financial flow overview</h2>
        <p className="mt-1 text-sm muted-text">Last 14 days: activations vs commissions + withdrawals.</p>
        <div className="mt-4">
          <FlowComparisonChart
            data={flowData}
            title="14-day cash movement"
            moneyInLabel="Activations"
            moneyOutLabel="Commissions + withdrawals"
            chartSubtitle="Same calendar as admin stats"
          />
        </div>
      </div>
    </AppShell>
  );
}
