"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/ui/AppShell";
import { AdvancedTable } from "@/components/admin/AdvancedTable";
import { StatCard } from "@/components/ui/StatCard";
import { adminNavItems } from "@/lib/nav/admin-nav";
import { StatusChip } from "@/components/ui/StatusChip";

export default function AdminPaymentsPage() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const pageSize = 20;

  useEffect(() => {
    fetch(`/api/admin/payments?page=${page}&pageSize=${pageSize}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) return;
        setRows((data.data || []).map((item) => ({ ...item, id: item.id })));
        setTotal(data.total || 0);
      })
      .catch(() => {});
  }, [page]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (item) =>
        String(item.reference || "").toLowerCase().includes(q) ||
        String(item.kind || "").toLowerCase().includes(q) ||
        String(item.status || "").toLowerCase().includes(q) ||
        String(item.username || "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const checkoutCount = rows.filter((r) => r.kind === "activation_checkout").length;
  const payoutCount = rows.filter((r) => r.kind === "payout").length;
  const columns = [
    { field: "kind", header: "Type", sortable: false },
    { field: "username", header: "Username", sortable: false },
    {
      field: "status",
      header: "Status",
      sortable: false,
      render: (row) => <StatusChip status={row.status} />,
    },
    { field: "amount", header: "Amount (KES)", sortable: false, render: (row) => Number(row.amount || 0).toFixed(2) },
    { field: "reference", header: "Reference", sortable: false },
    { field: "createdAt", header: "Date", sortable: false, render: (row) => new Date(row.createdAt).toLocaleString() },
  ];

  return (
    <AppShell title="Payments Center" navItems={adminNavItems}>
      <div className="card-surface rounded-3xl section-card">
        <h2 className="heading-display text-lg font-semibold">Activation and payout gateway</h2>
        <p className="mt-1 text-sm muted-text">
          Monitor checkout initiations, callback logs, payout statuses, and failed attempts.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <StatCard label="Activation checkouts" value={String(checkoutCount)} />
        <StatCard label="Payout attempts" value={String(payoutCount)} tone="danger" />
      </div>
      <AdvancedTable
        title="Checkout & payout activity"
        columns={columns}
        rows={filteredRows}
        total={total}
        page={page}
        pageSize={pageSize}
        search={search}
        sortState={{ field: "createdAt", direction: "desc" }}
        onSearchChange={setSearch}
        onSortChange={() => {}}
        onPageChange={setPage}
        emptyLabel="No payment records yet."
      />
    </AppShell>
  );
}
