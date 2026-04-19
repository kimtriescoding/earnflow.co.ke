"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/ui/AppShell";
import { AdvancedTable } from "@/components/admin/AdvancedTable";
import { adminNavItems } from "@/lib/nav/admin-nav";
import { toast } from "sonner";
import { StatusChip } from "@/components/ui/StatusChip";

export default function AdminWithdrawalsPage() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const pageSize = 20;

  const loadData = () => {
    fetch(`/api/admin/withdrawals?page=${page}&pageSize=${pageSize}&status=${status}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) return;
        const filtered = (data.data || []).filter((r) => {
          if (!search.trim()) return true;
          const q = search.toLowerCase();
          return (
            String(r.user?.username || "").toLowerCase().includes(q) ||
            String(r.user?.email || "").toLowerCase().includes(q) ||
            String(r.phoneNumber || "").toLowerCase().includes(q)
          );
        });
        setRows(filtered.map((item) => ({ ...item, id: item._id })));
        setTotal(data.total || 0);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status]);

  const updateStatus = async (withdrawalId, nextStatus) => {
    const res = await fetch("/api/admin/withdrawals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ withdrawalId, status: nextStatus }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      toast.error(data.error || "Failed to update withdrawal.");
      return;
    }
    toast.success("Withdrawal status updated.");
    loadData();
  };

  const columns = [
    { field: "user", header: "User", sortable: false, render: (row) => row.user?.username || "-" },
    { field: "amount", header: "Amount", sortable: false, render: (row) => Number(row.amount || 0).toFixed(2) },
    { field: "phoneNumber", header: "Phone", sortable: false },
    {
      field: "status",
      header: "Status",
      sortable: false,
      render: (row) => <StatusChip status={row.status} />,
    },
    { field: "createdAt", header: "Date", sortable: false, render: (row) => new Date(row.createdAt).toLocaleString() },
    {
      field: "actions",
      header: "Actions",
      sortable: false,
      render: (row) => {
        const locked = row.status === "completed" || row.status === "failed";
        return (
          <div className="flex gap-2">
            <button
              type="button"
              className="secondary-btn px-2 py-1 text-xs disabled:opacity-40"
              disabled={locked}
              onClick={() => updateStatus(row._id, "approved")}
            >
              Approve
            </button>
            <button
              type="button"
              className="secondary-btn px-2 py-1 text-xs disabled:opacity-40"
              disabled={locked}
              onClick={() => updateStatus(row._id, "rejected")}
            >
              Reject
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <AppShell title="Withdrawals Management" navItems={adminNavItems}>
      <div className="card-surface rounded-3xl section-card">
        <h2 className="heading-display text-lg font-semibold">Withdrawals queue</h2>
        <p className="mt-1 text-sm muted-text">
          Review pending requests, status updates, and payout callback outcomes.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {["", "pending", "approved", "rejected", "completed"].map((item) => (
            <button
              key={item || "all"}
              className={`secondary-btn px-3.5 py-2 text-xs ${status === item ? "ring-2 ring-[var(--brand)]" : ""}`}
              onClick={() => {
                setPage(1);
                setStatus(item);
              }}
            >
              {item || "all"}
            </button>
          ))}
        </div>
      </div>
      <AdvancedTable
        title="User withdrawal requests"
        columns={columns}
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        search={search}
        sortState={{ field: "createdAt", direction: "desc" }}
        onSearchChange={setSearch}
        onSortChange={() => {}}
        onPageChange={setPage}
        emptyLabel="No withdrawals found."
      />
    </AppShell>
  );
}
