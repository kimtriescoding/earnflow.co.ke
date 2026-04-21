"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/ui/AppShell";
import { AdvancedTable } from "@/components/admin/AdvancedTable";
import { adminNavItems } from "@/lib/nav/admin-nav";

function RankStars({ rank }) {
  const filled = 6 - rank;
  return (
    <span className="inline-flex shrink-0 items-center gap-px" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-3.5 md:w-3.5 ${i <= filled ? "fill-amber-400 text-amber-400" : "text-[color-mix(in_oklab,var(--border)_65%,transparent)]"}`}
          strokeWidth={i <= filled ? 0 : 1.5}
        />
      ))}
    </span>
  );
}

const leaderboardRowBorder = "border-b border-[color-mix(in_oklab,var(--border)_40%,transparent)]";

function LeaderboardRow({ rank, userId, username, email, amount }) {
  const primary = username || email || userId;
  const showEmailSub = Boolean(email && username);
  const amountStr = Number(amount || 0).toFixed(2);

  return (
    <li
      className={`grid gap-x-2 gap-y-2 py-3 max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:grid-rows-[auto_auto] max-sm:[grid-template-areas:'lead_amount'_'user_user'] sm:grid-cols-[2rem_5.5rem_minmax(0,1fr)_auto] sm:grid-rows-1 sm:items-center sm:gap-y-0 ${leaderboardRowBorder} last:border-b-0`}
    >
      <div className="flex min-w-0 items-center gap-1.5 max-sm:[grid-area:lead] sm:contents">
        <span className="flex w-6 shrink-0 items-center justify-center text-center text-[0.65rem] font-semibold tabular-nums leading-none muted-text sm:w-auto sm:self-stretch sm:text-[0.7rem]">
          #{rank}
        </span>
        <div className="flex shrink-0 items-center sm:self-stretch sm:items-center">
          <RankStars rank={rank} />
        </div>
      </div>
      <div className="flex min-w-0 flex-col justify-center gap-0.5 max-sm:[grid-area:user] sm:self-stretch sm:py-0.5">
        <Link
          href={`/admin/users/${userId}`}
          className="max-sm:break-words font-medium leading-snug text-[var(--brand)] underline-offset-2 hover:underline max-sm:text-[0.8125rem] sm:truncate sm:text-sm"
        >
          {primary}
        </Link>
        {showEmailSub ? (
          <p className="max-sm:break-words text-xs leading-snug muted-text max-sm:text-[0.7rem] sm:truncate">{email}</p>
        ) : null}
      </div>
      <div className="flex min-w-0 items-center justify-end max-sm:[grid-area:amount] max-sm:self-center sm:contents">
        <span className="text-right text-xs font-semibold tabular-nums leading-none sm:text-sm">KES {amountStr}</span>
      </div>
    </li>
  );
}

export default function AdminUsersPage() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ activated: 0, elevatedRoleCount: 0, totalWithdrawableKes: 0 });
  const [topLifetimeEarners, setTopLifetimeEarners] = useState([]);
  const [topWithdrawable, setTopWithdrawable] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [sortState, setSortState] = useState({ field: "createdAt", direction: "desc" });
  const [activation, setActivation] = useState("all");
  const [withdrawableOnly, setWithdrawableOnly] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      search,
      sortBy: sortState.field,
      sortDir: sortState.direction,
    });
    if (activation && activation !== "all") params.set("activation", activation);
    if (withdrawableOnly) params.set("withdrawableOnly", "true");
    return params;
  }, [page, pageSize, search, sortState, activation, withdrawableOnly]);

  useEffect(() => {
    fetch(`/api/admin/users?${query.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setRows((data.data || []).map((row) => ({ ...row, id: row._id })));
        setTotal(data.total || 0);
        setSummary({
          activated: Number(data.summary?.activated || 0),
          elevatedRoleCount: Number(data.summary?.elevatedRoleCount || 0),
          totalWithdrawableKes: Number(data.summary?.totalWithdrawableKes || 0),
        });
      });
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/users/leaderboards")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (!data.success) {
          toast.error(data.message || "Unable to load leaderboards.");
          return;
        }
        setTopLifetimeEarners(data.data?.topLifetimeEarners || []);
        setTopWithdrawable(data.data?.topWithdrawable || []);
      })
      .catch(() => {
        if (!cancelled) toast.error("Unable to load leaderboards.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function impersonate(userId) {
    const res = await fetch(`/api/admin/users/${userId}/impersonate`, { method: "POST" });
    const data = await res.json();
    if (data.success) {
      toast.success("Impersonation started.");
      window.location.href = "/dashboard";
    } else {
      toast.error(data.message || "Impersonation failed.");
    }
  }

  const columns = [
    { field: "username", header: "Username", sortable: true },
    { field: "email", header: "Email", sortable: true },
    {
      field: "withdrawableBalance",
      header: "Withdrawable (KES)",
      sortable: true,
      render: (row) => Number(row.withdrawableBalance || 0).toFixed(2),
    },
    { field: "role", header: "Role", sortable: true },
    { field: "isActivated", header: "Activated", sortable: true, render: (row) => (row.isActivated ? "Yes" : "No") },
    {
      field: "actions",
      header: "Actions",
      sortable: false,
      render: (row) => (
        <div className="flex flex-nowrap items-center gap-2 whitespace-nowrap">
          <Link href={`/admin/users/${row._id}`} className="secondary-btn inline-flex min-h-0 items-center px-3 py-1.5 text-xs leading-none">
            Details
          </Link>
          <button
            onClick={() => impersonate(row._id)}
            className="secondary-btn inline-flex min-h-0 items-center px-3 py-1.5 text-xs leading-none"
          >
            Impersonate
          </button>
        </div>
      ),
    },
  ];

  return (
    <AppShell title="User Management" navItems={adminNavItems}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card-surface rounded-3xl section-card">
          <p className="text-xs uppercase tracking-[0.12em] muted-text">Listed users</p>
          <p className="heading-display mt-2 text-2xl font-semibold">{total}</p>
        </div>
        <div className="card-surface rounded-3xl section-card">
          <p className="text-xs uppercase tracking-[0.12em] muted-text">Activated users</p>
          <p className="heading-display mt-2 text-2xl font-semibold">{summary.activated}</p>
          <p className="mt-1 text-xs muted-text">Across full result set</p>
        </div>
        <div className="card-surface rounded-3xl section-card">
          <p className="text-xs uppercase tracking-[0.12em] muted-text">Admin + support users</p>
          <p className="heading-display mt-2 text-2xl font-semibold">{summary.elevatedRoleCount}</p>
          <p className="mt-1 text-xs muted-text">Across full result set</p>
        </div>
        <div className="card-surface rounded-3xl section-card">
          <p className="text-xs uppercase tracking-[0.12em] muted-text">Total withdrawable (KES)</p>
          <p className="heading-display mt-2 text-2xl font-semibold tabular-nums">KES {Number(summary.totalWithdrawableKes || 0).toFixed(2)}</p>
          <p className="mt-1 text-xs muted-text">For the filtered list cohort</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="card-surface rounded-3xl section-card">
          <header className="border-b border-[color-mix(in_oklab,var(--border)_40%,transparent)] pb-3">
            <p className="text-xs uppercase tracking-[0.12em] muted-text">Top lifetime earners</p>
            <p className="mt-1 text-xs leading-relaxed muted-text">Wallet lifetime total (matches user dashboard), highest first.</p>
          </header>
          <ul className="m-0 list-none p-0 pt-2">
            {topLifetimeEarners.length ? (
              topLifetimeEarners.map((row, idx) => (
                <LeaderboardRow
                  key={row.userId}
                  rank={idx + 1}
                  userId={row.userId}
                  username={row.username}
                  email={row.email}
                  amount={row.lifetimeEarnings}
                />
              ))
            ) : (
              <li className="py-4 text-sm muted-text">No users with lifetime earnings yet.</li>
            )}
          </ul>
        </div>
        <div className="card-surface rounded-3xl section-card">
          <header className="border-b border-[color-mix(in_oklab,var(--border)_40%,transparent)] pb-3">
            <p className="text-xs uppercase tracking-[0.12em] muted-text">Top withdrawable balances</p>
            <p className="mt-1 text-xs leading-relaxed muted-text">Main wallet available balance only, highest first.</p>
          </header>
          <ul className="m-0 list-none p-0 pt-2">
            {topWithdrawable.length ? (
              topWithdrawable.map((row, idx) => (
                <LeaderboardRow
                  key={row.userId}
                  rank={idx + 1}
                  userId={row.userId}
                  username={row.username}
                  email={row.email}
                  amount={row.availableBalance}
                />
              ))
            ) : (
              <li className="py-4 text-sm muted-text">No withdrawable balances yet.</li>
            )}
          </ul>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-3xl border border-[color-mix(in_oklab,var(--border)_40%,transparent)] bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <label className="flex min-w-0 flex-col gap-1.5 sm:max-w-xs">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] muted-text">Activation</span>
          <select
            value={activation}
            onChange={(e) => {
              setPage(1);
              setActivation(e.target.value);
            }}
            className="interactive-control focus-ring w-full px-3 py-2 text-sm sm:w-auto"
          >
            <option value="all">All users</option>
            <option value="active">Activated</option>
            <option value="inactive">Not activated</option>
          </select>
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 self-start sm:self-center">
          <input
            type="checkbox"
            checked={withdrawableOnly}
            onChange={(e) => {
              setPage(1);
              setWithdrawableOnly(e.target.checked);
            }}
            className="h-4 w-4 shrink-0 rounded border-[var(--border)] accent-[var(--brand)]"
          />
          <span className="text-sm leading-snug">Has withdrawable balance</span>
        </label>
      </div>

      <div className="mt-4">
        <AdvancedTable
          title="All users"
          columns={columns}
          rows={rows}
          total={total}
          page={page}
          pageSize={pageSize}
          search={search}
          sortState={sortState}
          onSearchChange={(v) => {
            setPage(1);
            setSearch(v);
          }}
          onSortChange={setSortState}
          onPageChange={setPage}
        />
      </div>
    </AppShell>
  );
}
