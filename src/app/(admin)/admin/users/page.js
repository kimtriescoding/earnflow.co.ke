"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/ui/AppShell";
import { AdvancedTable } from "@/components/admin/AdvancedTable";
import { adminNavItems } from "@/lib/nav/admin-nav";

export default function AdminUsersPage() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ activated: 0, elevatedRoleCount: 0 });
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [sortState, setSortState] = useState({ field: "createdAt", direction: "desc" });

  const query = useMemo(
    () => new URLSearchParams({ page: String(page), pageSize: String(pageSize), search, sortBy: sortState.field, sortDir: sortState.direction }),
    [page, pageSize, search, sortState]
  );

  useEffect(() => {
    fetch(`/api/admin/users?${query.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setRows((data.data || []).map((row) => ({ ...row, id: row._id })));
        setTotal(data.total || 0);
        setSummary({
          activated: Number(data.summary?.activated || 0),
          elevatedRoleCount: Number(data.summary?.elevatedRoleCount || 0),
        });
      });
  }, [query]);

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
      <div className="grid gap-3 md:grid-cols-3">
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
      </div>
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
    </AppShell>
  );
}
