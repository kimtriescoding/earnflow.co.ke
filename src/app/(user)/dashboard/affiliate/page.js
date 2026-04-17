"use client";

import { useEffect, useState } from "react";
import { UserAppShell } from "@/components/user/UserAppShell";
import { UserDataTable } from "@/components/user/UserDataTable";
import { StatusChip } from "@/components/ui/StatusChip";

const initialData = {
  level1: [],
  level2: [],
  counts: { level1: 0, level2: 0, level1Active: 0, level1Inactive: 0, level2Active: 0, level2Inactive: 0 },
  levels: { level1Enabled: true, level2Enabled: true },
};

export default function AffiliatePage() {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("level1");
  const level1Enabled = Boolean(data?.levels?.level1Enabled);
  const level2Enabled = Boolean(data?.levels?.level2Enabled);
  const visibleCardCount = Number(level1Enabled) + Number(level2Enabled);

  useEffect(() => {
    fetch("/api/dashboard/affiliate-network")
      .then((res) => res.json())
      .then((payload) => {
        if (!payload?.success) {
          setError(payload?.message || "Unable to load affiliate network.");
          return;
        }
        setData({
          level1: payload?.data?.level1 || [],
          level2: payload?.data?.level2 || [],
          counts:
            payload?.data?.counts || { level1: 0, level2: 0, level1Active: 0, level1Inactive: 0, level2Active: 0, level2Inactive: 0 },
          levels: payload?.data?.levels || { level1Enabled: true, level2Enabled: true },
        });
      })
      .catch(() => {
        setError("Unable to load affiliate network.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const level1Enabled = Boolean(data?.levels?.level1Enabled);
    const level2Enabled = Boolean(data?.levels?.level2Enabled);
    if (activeTab === "level1" && !level1Enabled && level2Enabled) {
      setActiveTab("level2");
    } else if (activeTab === "level2" && !level2Enabled && level1Enabled) {
      setActiveTab("level1");
    }
  }, [activeTab, data?.levels?.level1Enabled, data?.levels?.level2Enabled]);

  const maskEmail = (email) => {
    const value = String(email || "").trim();
    if (!value || !value.includes("@")) return "-";
    const [local, domain] = value.split("@");
    if (!local || !domain) return "-";
    if (local.length <= 2) return `${local[0] || "*"}***@${domain}`;
    return `${local.slice(0, 2)}***@${domain}`;
  };

  const tableColumns = [
    { field: "username", header: "Username", sortable: false },
    { field: "email", header: "Email", sortable: false, render: (row) => maskEmail(row.email) },
    { field: "phoneNumber", header: "Phone", sortable: false, render: (row) => row.phoneNumber || "-" },
    {
      field: "accountStatus",
      header: "Status",
      sortable: false,
      render: (row) => <StatusChip status={row.accountStatus} />,
    },
    {
      field: "createdAt",
      header: "Joined",
      sortable: false,
      render: (row) => (row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"),
    },
  ];

  return (
    <UserAppShell title="Affiliate Network">
      <div className={`grid grid-cols-1 gap-3 md:gap-4 ${visibleCardCount > 1 ? "md:grid-cols-2" : ""}`}>
        {level1Enabled ? (
          <div className="card-surface rounded-[var(--radius-panel)] p-5">
            <p className="text-xs uppercase tracking-[0.12em] muted-text">Level 1 affiliates</p>
            <p className="heading-display mt-2 text-2xl font-semibold">{Number(data.counts?.level1 || 0)}</p>
            <p className="mt-1 text-xs muted-text">Users who signed up directly under your referral code</p>
            <p className="mt-2 text-xs muted-text">
              Active: {Number(data.counts?.level1Active || 0)} | Inactive: {Number(data.counts?.level1Inactive || 0)}
            </p>
          </div>
        ) : null}
        {level2Enabled ? (
          <div className="card-surface rounded-[var(--radius-panel)] p-5">
            <p className="text-xs uppercase tracking-[0.12em] muted-text">Level 2 affiliates</p>
            <p className="heading-display mt-2 text-2xl font-semibold">{Number(data.counts?.level2 || 0)}</p>
            <p className="mt-1 text-xs muted-text">Users referred by your level 1 affiliates</p>
            <p className="mt-2 text-xs muted-text">
              Active: {Number(data.counts?.level2Active || 0)} | Inactive: {Number(data.counts?.level2Inactive || 0)}
            </p>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="card-surface rounded-[var(--radius-panel)] p-6 text-sm muted-text">Loading affiliate network...</div>
      ) : null}
      {error ? <div className="card-surface rounded-[var(--radius-panel)] p-6 text-sm text-rose-300">{error}</div> : null}

      {!loading && !error ? (
        <div className="content-stack">
          {level1Enabled || level2Enabled ? (
            <div className="card-surface rounded-[var(--radius-panel)] p-3 sm:p-4">
              <div className="flex flex-wrap gap-2">
                {level1Enabled ? (
                  <button
                    type="button"
                    onClick={() => setActiveTab("level1")}
                    className={`secondary-btn px-3 py-2 text-sm ${activeTab === "level1" ? "neon-chip font-semibold" : ""}`}
                  >
                    Level 1 ({data.level1.length})
                  </button>
                ) : null}
                {level2Enabled ? (
                  <button
                    type="button"
                    onClick={() => setActiveTab("level2")}
                    className={`secondary-btn px-3 py-2 text-sm ${activeTab === "level2" ? "neon-chip font-semibold" : ""}`}
                  >
                    Level 2 ({data.level2.length})
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {activeTab === "level1" && level1Enabled ? (
            <UserDataTable
              title="Level 1 members"
              columns={tableColumns}
              rows={data.level1}
              total={data.level1.length}
              page={1}
              pageSize={Math.max(1, data.level1.length)}
              search=""
              sortState={{ field: "createdAt", direction: "desc" }}
              onSearchChange={() => {}}
              onSortChange={() => {}}
              onPageChange={() => {}}
              emptyLabel="No level 1 affiliates yet."
            />
          ) : activeTab === "level2" && level2Enabled ? (
            <UserDataTable
              title="Level 2 members"
              columns={tableColumns}
              rows={data.level2}
              total={data.level2.length}
              page={1}
              pageSize={Math.max(1, data.level2.length)}
              search=""
              sortState={{ field: "createdAt", direction: "desc" }}
              onSearchChange={() => {}}
              onSortChange={() => {}}
              onPageChange={() => {}}
              emptyLabel="No level 2 affiliates yet."
            />
          ) : (
            <div className="card-surface rounded-[var(--radius-panel)] p-6 text-sm muted-text">Affiliate levels are disabled in config.</div>
          )}
        </div>
      ) : null}
    </UserAppShell>
  );
}
