"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/ui/AppShell";
import { AdvancedTable } from "@/components/admin/AdvancedTable";
import { adminNavItems } from "@/lib/nav/admin-nav";
import { toast } from "sonner";

export default function AdminReferralsPage() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ totalUsers: 0, linkedL1: 0, linkedL2: 0, linkedL3: 0, totalCommissions: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [commissionFixIdentifier, setCommissionFixIdentifier] = useState("");
  const [commissionFixLoading, setCommissionFixLoading] = useState(false);
  const pageSize = 20;

  useEffect(() => {
    fetch(`/api/admin/referrals?page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(search)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) return;
        setRows((data.data || []).map((item) => ({ ...item, id: item._id })));
        setTotal(data.total || 0);
        setSummary({
          totalUsers: Number(data.summary?.totalUsers || 0),
          linkedL1: Number(data.summary?.linkedL1 || 0),
          linkedL2: Number(data.summary?.linkedL2 || 0),
          linkedL3: Number(data.summary?.linkedL3 || 0),
          totalCommissions: Number(data.summary?.totalCommissions || 0),
        });
      })
      .catch(() => {});
  }, [page, search]);

  const columns = [
    { field: "username", header: "Username", sortable: false },
    { field: "email", header: "Email", sortable: false },
    { field: "referredByUsername", header: "Direct Referrer", sortable: false, render: (row) => row.referredByUsername || "—" },
    { field: "uplineL2Username", header: "L2", sortable: false, render: (row) => row.uplineL2Username || "—" },
    { field: "uplineL3Username", header: "L3", sortable: false, render: (row) => row.uplineL3Username || "—" },
    {
      field: "totalReferralCommissions",
      header: "Commissions (KES)",
      sortable: false,
      render: (row) => Number(row.totalReferralCommissions || 0).toFixed(2),
    },
  ];

  return (
    <AppShell title="Referral Engine Control" navItems={adminNavItems}>
      <div className="card-surface rounded-3xl section-card">
        <h2 className="heading-display text-lg font-semibold">Referral hierarchy and commissions</h2>
        <p className="mt-1 text-sm muted-text">
          Inspect level 1-3 uplines, commission payouts, and per-user overrides.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card-surface rounded-3xl section-card">
          <p className="text-xs uppercase tracking-[0.12em] muted-text">Matching users</p>
          <p className="heading-display mt-2 text-2xl font-semibold">{summary.totalUsers || total}</p>
          <p className="mt-1 text-xs muted-text">Current query across referral records</p>
        </div>
        <div className="card-surface rounded-3xl section-card">
          <p className="text-xs uppercase tracking-[0.12em] muted-text">Commissions (all matches)</p>
          <p className="heading-display mt-2 text-2xl font-semibold">KES {summary.totalCommissions.toFixed(2)}</p>
          <p className="mt-1 text-xs muted-text">Summed across the full result set</p>
        </div>
        <div className="card-surface rounded-3xl section-card">
          <p className="text-xs uppercase tracking-[0.12em] muted-text">Upline coverage (all matches)</p>
          <p className="heading-display mt-2 text-2xl font-semibold">
            L1 {summary.linkedL1} | L2 {summary.linkedL2} | L3 {summary.linkedL3}
          </p>
          <p className="mt-1 text-xs muted-text">How many matching users are linked at each level</p>
        </div>
      </div>

      <div className="card-surface rounded-3xl section-card mt-4">
        <h3 className="heading-display text-sm font-semibold">Fix referral signup commissions</h3>
        <p className="mt-1 max-w-xl text-sm muted-text">
          Enter the activated account. Missing L1–L3 signup lines are applied; uplines are re-checked. Idempotent—no
          double credits.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="grid flex-1 gap-1 text-sm">
            <span className="muted-text">Activated user (id or username)</span>
            <input
              className="interactive-control focus-ring px-3.5 py-2.5"
              value={commissionFixIdentifier}
              onChange={(e) => setCommissionFixIdentifier(e.target.value)}
              placeholder="e.g. kimani08"
              disabled={commissionFixLoading}
            />
          </label>
          <button
            type="button"
            className="primary-btn px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            disabled={commissionFixLoading || !String(commissionFixIdentifier).trim()}
            onClick={async () => {
              const identifier = String(commissionFixIdentifier).trim();
              if (!identifier) return;
              setCommissionFixLoading(true);
              try {
                const res = await fetch("/api/admin/referrals/sync-signup-bonuses", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ identifier }),
                });
                const data = await res.json().catch(() => ({}));
                if (data.success) {
                  toast.success(data.message || "Done.");
                  setCommissionFixIdentifier("");
                } else {
                  toast.error(data.message || "Request failed.");
                }
              } catch {
                toast.error("Network error.");
              } finally {
                setCommissionFixLoading(false);
              }
            }}
          >
            {commissionFixLoading ? "Running…" : "Fix commissions"}
          </button>
        </div>
      </div>

      <AdvancedTable
        title="Referral relationships"
        columns={columns}
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        search={search}
        sortState={{ field: "createdAt", direction: "desc" }}
        onSearchChange={(value) => {
          setPage(1);
          setSearch(value);
        }}
        onSortChange={() => {}}
        onPageChange={setPage}
        emptyLabel="No referral records found."
      />
    </AppShell>
  );
}
