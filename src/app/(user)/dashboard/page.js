"use client";

import { useEffect, useMemo, useState } from "react";
import { UserAppShell } from "@/components/user/UserAppShell";
import { StatCard } from "@/components/ui/StatCard";
import { UserDataTable } from "@/components/user/UserDataTable";
import { StatusChip } from "@/components/ui/StatusChip";
import { Gift, Link2, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { useUserModuleAccess } from "@/components/user/UserModuleAccessProvider";

export default function DashboardPage() {
  const moduleAccess = useUserModuleAccess();
  const [summary, setSummary] = useState({
    wallet: { availableBalance: 0, pendingBalance: 0, lifetimeEarnings: 0 },
    withdrawals: { totalAmount: 0, totalCount: 0 },
    referrals: 0,
    referralEarned: 0,
    moduleTotals: {},
    pendingCounts: {},
    referralCode: "",
    username: "",
    todaysEarnings: 0,
    todaysEarningsTimeZone: "Africa/Nairobi",
  });
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard/summary").then((res) => res.json()),
      fetch("/api/dashboard/activity?page=1&pageSize=10").then((res) => res.json()),
    ])
      .then(([summaryRes, activityRes]) => {
        if (summaryRes?.success && summaryRes?.data) setSummary(summaryRes.data);
        if (activityRes?.success) setActivity(activityRes.data || []);
      })
      .catch(() => {});
  }, []);

  const inviteLink = useMemo(() => {
    if (!summary.referralCode || typeof window === "undefined") return "";
    return `${window.location.origin}/signup?ref=${encodeURIComponent(summary.referralCode)}`;
  }, [summary.referralCode]);

  const available = Number(summary.wallet?.availableBalance || 0).toFixed(2);
  const todayEarned = Number(summary.todaysEarnings ?? 0).toFixed(2);
  const lifetime = Number(summary.wallet?.lifetimeEarnings || 0).toFixed(2);
  const withdrawals = Number(summary.withdrawals?.totalAmount || 0).toFixed(2);
  const withdrawalCount = Number(summary.withdrawals?.totalCount || 0);
  const directReferrals = Number(summary.referrals || 0);
  const moduleCards = useMemo(() => {
    const cards = [];
    if (moduleAccess.task) {
      cards.push({
        key: "task",
        label: "Tasks earned",
        amount: Number(summary.moduleTotals?.task || 0).toFixed(2),
        pending: Number(summary.pendingCounts?.task || 0),
      });
    }
    if (moduleAccess.video) {
      cards.push({
        key: "video",
        label: "Video earned",
        amount: Number(summary.moduleTotals?.video || 0).toFixed(2),
        pending: Number(summary.pendingCounts?.video || 0),
      });
    }
    if (moduleAccess.chat) {
      cards.push({
        key: "chat",
        label: "Chat earned",
        amount: Number(summary.moduleTotals?.chat || 0).toFixed(2),
        pending: Number(summary.pendingCounts?.chat || 0),
      });
    }
    cards.push({
      key: "referral",
      label: "Referral earned",
      amount: Number(summary.referralEarned || 0).toFixed(2),
      pending: 0,
    });
    return cards;
  }, [moduleAccess.task, moduleAccess.video, moduleAccess.chat, summary.moduleTotals, summary.pendingCounts, summary.referralEarned]);
  const activityColumns = [
    { field: "type", header: "Type", sortable: false },
    { field: "source", header: "Source", sortable: false },
    { field: "amount", header: "Amount (KES)", sortable: false, render: (row) => Number(row.amount || 0).toFixed(2) },
    {
      field: "status",
      header: "Status",
      sortable: false,
      render: (row) => <StatusChip status={row.status} />,
    },
    {
      field: "createdAt",
      header: "Date",
      sortable: false,
      render: (row) => new Date(row.createdAt).toLocaleString(),
    },
  ];
  function copyInvite() {
    if (!inviteLink) {
      toast.error("Invite link is not ready yet.");
      return;
    }
    navigator.clipboard
      .writeText(inviteLink)
      .then(() => toast.success("Referral link copied."))
      .catch(() => toast.error("Unable to copy link."));
  }

  return (
    <UserAppShell title={`Welcome back ${summary.username || "User"}`}>
      <div className="grid grid-cols-1 gap-2 sm:gap-3 md:grid-cols-4 md:gap-4">
        <StatCard compact label="Available Balance" value={`KES ${available}`} hint="Ready for withdrawals" />
        <StatCard
          compact
          label="Today's earnings"
          value={`KES ${todayEarned}`}
          tone="amber"
          hint={`Approved credits today (${String(summary.todaysEarningsTimeZone || "Africa/Nairobi").replace(/_/g, " ")})`}
        />
        <StatCard compact label="Lifetime Earnings" value={`KES ${lifetime}`} tone="success" hint="All-time confirmed earnings" />
        <StatCard
          compact
          label="Total Withdrawals"
          value={`KES ${withdrawals}`}
          tone="danger"
          hint={`${withdrawalCount} completed withdrawal${withdrawalCount === 1 ? "" : "s"}`}
        />
      </div>
      <div className="grid gap-3 sm:gap-4 xl:grid-cols-[1.05fr_0.82fr] xl:gap-5">
        <div className="card-surface neon-outline rounded-2xl p-3 sm:p-4 md:rounded-[var(--radius-panel)] md:p-4 lg:p-5">
          <div className="flex items-center gap-1.5">
            <WalletCards className="h-3.5 w-3.5 shrink-0 text-[var(--brand)] sm:h-4 sm:w-4" strokeWidth={2} aria-hidden />
            <h2 className="section-title text-[0.98rem] leading-tight sm:text-base md:text-[1.08rem]">Performance snapshot</h2>
          </div>
          <div className="mt-2 grid gap-1.5 sm:mt-2.5 sm:gap-2 md:grid-cols-2">
            {moduleCards.map((item) => (
              <div key={item.key} className="panel-tile p-2 sm:p-2.5 md:p-3">
                <p className="eyebrow-label text-[0.58rem] tracking-[0.11em] sm:text-[0.625rem] sm:tracking-[0.12em]">{item.label}</p>
                <p className="heading-display mt-0.5 text-base font-semibold leading-tight sm:mt-1 sm:text-lg md:text-xl">
                  KES {item.amount}
                </p>
                <p className="mt-0.5 text-[10px] leading-snug muted-text sm:text-[11px]">Pending approvals: {item.pending}</p>
              </div>
            ))}
          </div>
        </div>
        <aside className="card-strong neon-outline rounded-2xl p-3 sm:p-4 md:rounded-[var(--radius-panel)] md:p-4 lg:p-5">
          <div className="flex items-center gap-1.5">
            <Gift className="h-3.5 w-3.5 shrink-0 text-[var(--brand)] sm:h-4 sm:w-4" strokeWidth={2} aria-hidden />
            <h3 className="section-title text-[0.98rem] leading-tight sm:text-base md:text-[1.08rem]">Referral invite</h3>
          </div>
          <p className="mt-1.5 text-xs leading-snug muted-text sm:text-[13px] sm:leading-relaxed">
            Share your invite link to grow your network and unlock referral commissions automatically.
          </p>
          <div className="panel-tile mt-2 p-2 sm:mt-2.5 sm:p-2.5">
            <p className="eyebrow-label text-[0.58rem] tracking-[0.11em] sm:text-[0.625rem]">Direct referrals</p>
            <p className="heading-display mt-0.5 text-base font-semibold sm:mt-1 sm:text-lg md:text-xl">{directReferrals}</p>
          </div>
          <div className="panel-tile mt-2 p-2 sm:mt-2.5 sm:p-2.5">
            <p className="eyebrow-label text-[0.58rem] tracking-[0.11em] sm:text-[0.625rem]">Referral code</p>
            <p className="mt-0.5 text-xs font-semibold sm:text-sm">{summary.referralCode || "-"}</p>
          </div>
          <div className="mt-2.5 sm:mt-3">
            <label className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)] sm:text-xs">Invite link</label>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <input readOnly value={inviteLink} className="interactive-control w-full min-w-0 px-2.5 py-2 text-xs sm:flex-1 sm:text-[13px]" />
              <button
                type="button"
                onClick={copyInvite}
                className="secondary-btn inline-flex shrink-0 items-center justify-center gap-1 px-3 py-2 text-xs sm:text-sm"
              >
                <Link2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
                Copy
              </button>
            </div>
          </div>
        </aside>
      </div>
      <UserDataTable
        title="Recent account activity"
        columns={activityColumns}
        rows={activity.map((row) => ({ ...row, id: row.id }))}
        total={activity.length}
        page={1}
        pageSize={10}
        search=""
        sortState={{ field: "createdAt", direction: "desc" }}
        onSearchChange={() => {}}
        onSortChange={() => {}}
        onPageChange={() => {}}
        emptyLabel="No activity yet."
      />
    </UserAppShell>
  );
}
