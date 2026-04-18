"use client";

import { useEffect, useMemo, useState } from "react";
import { UserAppShell } from "@/components/user/UserAppShell";
import { UserDataTable } from "@/components/user/UserDataTable";
import { StatusChip } from "@/components/ui/StatusChip";
import { useUserModuleAccess } from "@/components/user/UserModuleAccessProvider";
import { isTransactionAreaEnabled } from "@/lib/modules/module-access";
import { toast } from "sonner";

const AREA_LABEL = {
  main: "Main wallet",
  lucky_spin: "Lucky Spin",
  aviator: "Aviator",
};

function formatKes(n) {
  const x = Number(n || 0);
  return `${x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KES`;
}

export default function TransactionsPage() {
  const access = useUserModuleAccess();
  const [rawRows, setRawRows] = useState([]);
  const [summary, setSummary] = useState({ grandIn: 0, grandOut: 0 });
  const [loading, setLoading] = useState(true);
  const [areaFilter, setAreaFilter] = useState("all");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    setLoading(true);
    fetch("/api/dashboard/transactions")
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) {
          toast.error(data.message || "Could not load transactions.");
          return;
        }
        setRawRows(data.data?.rows || []);
        if (data.data?.summary) setSummary(data.data.summary);
      })
      .catch(() => toast.error("Could not load transactions."))
      .finally(() => setLoading(false));
  }, []);

  const areaOptions = useMemo(() => {
    const opts = [
      { value: "all", label: "All areas" },
      { value: "main", label: "Main wallet" },
    ];
    if (access.lucky_spin) opts.push({ value: "lucky_spin", label: "Lucky Spin" });
    if (access.aviator) opts.push({ value: "aviator", label: "Aviator" });
    return opts;
  }, [access.lucky_spin, access.aviator]);

  const areaFilterActive = useMemo(() => {
    if (areaFilter !== "all" && !isTransactionAreaEnabled(access, areaFilter)) return "all";
    return areaFilter;
  }, [access, areaFilter]);

  const filtered = useMemo(() => {
    const q = appliedSearch.trim().toLowerCase();
    return rawRows.filter((r) => {
      if (areaFilterActive !== "all" && r.area !== areaFilterActive) return false;
      if (directionFilter !== "all" && r.direction !== directionFilter) return false;
      if (!q) return true;
      const hay = [r.label, r.status, r.kind, AREA_LABEL[r.area] || r.area, r.direction].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [rawRows, areaFilterActive, directionFilter, appliedSearch]);

  const total = filtered.length;
  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize).map((r) => ({ ...r, id: r.id }));
  }, [filtered, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [areaFilterActive, directionFilter, appliedSearch]);

  const columns = useMemo(
    () => [
      {
        field: "createdAt",
        header: "Date",
        sortable: false,
        render: (row) => new Date(row.createdAt).toLocaleString(),
      },
      {
        field: "area",
        header: "Area",
        sortable: false,
        render: (row) => AREA_LABEL[row.area] || row.area,
      },
      {
        field: "direction",
        header: "Flow",
        sortable: false,
        render: (row) =>
          row.direction === "in" ? (
            <span className="font-medium text-emerald-600 dark:text-emerald-400">Money in</span>
          ) : (
            <span className="font-medium text-rose-600 dark:text-rose-400">Money out</span>
          ),
      },
      {
        field: "amount",
        header: "Amount",
        sortable: false,
        render: (row) => (
          <span
            className={`tabular-nums font-semibold ${row.direction === "in" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
          >
            {row.direction === "in" ? "+" : "−"}
            {Number(row.amount || 0).toFixed(2)} KES
          </span>
        ),
      },
      { field: "label", header: "Description", sortable: false },
      {
        field: "status",
        header: "Status",
        sortable: false,
        render: (row) => <StatusChip status={row.status} />,
      },
    ],
    []
  );

  return (
    <UserAppShell title="Transactions">
      <div className="card-surface rounded-3xl section-card">
        <h2 className="heading-display text-lg font-semibold">All money in and out</h2>
        <p className="mt-1 text-sm muted-text">
          Main wallet earnings and withdrawals, transfers to games, and Lucky Spin / Aviator play activity — newest first.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card-surface rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Total money in</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">+ {formatKes(summary.grandIn)}</p>
          <p className="mt-2 text-xs text-[var(--muted)]">Across all areas (from your history)</p>
        </div>
        <div className="card-surface rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Total money out</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-rose-600 dark:text-rose-400">− {formatKes(summary.grandOut)}</p>
          <p className="mt-2 text-xs text-[var(--muted)]">Withdrawals, bets, and transfers to games</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="grid gap-1 text-sm">
          <span className="muted-text">Area</span>
          <select
            className="interactive-control focus-ring min-w-[10rem] px-3 py-2 text-sm"
            value={areaFilterActive}
            onChange={(e) => setAreaFilter(e.target.value)}
          >
            {areaOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="muted-text">Flow</span>
          <select
            className="interactive-control focus-ring min-w-[10rem] px-3 py-2 text-sm"
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.target.value)}
          >
            <option value="all">In and out</option>
            <option value="in">Money in only</option>
            <option value="out">Money out only</option>
          </select>
        </label>
      </div>

      <UserDataTable
        title="Activity"
        columns={columns}
        rows={pagedRows}
        total={total}
        page={page}
        pageSize={pageSize}
        search={search}
        sortState={{ field: "createdAt", direction: "desc" }}
        onSearchChange={(v) => {
          setSearch(v);
          setAppliedSearch(v);
        }}
        onSortChange={() => {}}
        onPageChange={setPage}
        loading={loading}
        emptyLabel="No transactions match your filters."
      />
    </UserAppShell>
  );
}
