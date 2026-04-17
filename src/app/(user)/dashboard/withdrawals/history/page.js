"use client";

import { useEffect, useState } from "react";
import { UserAppShell } from "@/components/user/UserAppShell";
import { UserDataTable } from "@/components/user/UserDataTable";
import { StatusChip } from "@/components/ui/StatusChip";

export default function WithdrawalsHistoryPage() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    fetch(`/api/dashboard/withdrawals?page=${page}&pageSize=${pageSize}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) return;
        setRows((data.data || []).map((item) => ({ ...item, id: item._id })));
        setTotal(data.total || 0);
      })
      .catch(() => {});
  }, [page]);

  const columns = [
    { field: "amount", header: "Amount (KES)", sortable: false, render: (row) => Number(row.amount || 0).toFixed(2) },
    { field: "fee", header: "Fee (KES)", sortable: false, render: (row) => Number(row.fee || 0).toFixed(2) },
    { field: "phoneNumber", header: "Phone", sortable: false },
    {
      field: "status",
      header: "Status",
      sortable: false,
      render: (row) => <StatusChip status={row.status} />,
    },
    { field: "createdAt", header: "Date", sortable: false, render: (row) => new Date(row.createdAt).toLocaleString() },
  ];

  return (
    <UserAppShell title="Withdrawal History">
      <div className="card-surface rounded-3xl section-card">
        <h2 className="heading-display text-lg font-semibold">Your withdrawals</h2>
        <p className="mt-1 text-sm muted-text">Track pending, completed, and failed payout requests.</p>
      </div>
      <UserDataTable
        title="Your withdrawal requests"
        columns={columns}
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        search=""
        sortState={{ field: "createdAt", direction: "desc" }}
        onSearchChange={() => {}}
        onSortChange={() => {}}
        onPageChange={setPage}
        emptyLabel="No withdrawals yet."
      />
    </UserAppShell>
  );
}
