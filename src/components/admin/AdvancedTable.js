"use client";

import { useMemo, useState } from "react";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { LayoutGrid, Table } from "lucide-react";

export function AdvancedTable({
  columns,
  rows,
  total,
  page,
  pageSize,
  search,
  onSearchChange,
  onSortChange,
  sortState,
  onPageChange,
  loading = false,
  emptyLabel = "No records found.",
  title = "Records",
  showMobileLayoutToggle = true,
}) {
  const totalPages = useMemo(() => Math.max(1, Math.ceil((total || 0) / pageSize)), [total, pageSize]);
  const [value, setValue] = useState(search || "");
  const [mobileLayout, setMobileLayout] = useState("cards");
  const tableColumns = useMemo(
    () =>
      columns.map((column) => ({
        id: column.field,
        accessorFn: (row) => row[column.field],
        header: () => {
          if (!column.sortable) {
            return <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{column.header}</span>;
          }
          const isActive = sortState.field === column.field;
          const dir = isActive ? sortState.direction : undefined;
          return (
            <button
              type="button"
              onClick={() =>
                onSortChange?.({
                  field: column.field,
                  direction: !isActive ? "asc" : dir === "asc" ? "desc" : "asc",
                })
              }
              className="flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]"
            >
              {column.header}
              <span>{isActive ? (dir === "asc" ? "↑" : "↓") : "↕"}</span>
            </button>
          );
        },
        cell: (info) =>
          column.render ? column.render(info.row.original) : (info.getValue() ?? <span className="muted-text">-</span>),
      })),
    [columns, onSortChange, sortState.direction, sortState.field]
  );
  const table = useReactTable({
    data: rows || [],
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
  });
  const actionColumns = useMemo(() => columns.filter((column) => column.field === "actions"), [columns]);
  const dataColumns = useMemo(() => columns.filter((column) => column.field !== "actions"), [columns]);

  const showCardsOnMobile = !showMobileLayoutToggle || mobileLayout === "cards";
  const showTableOnMobile = !showMobileLayoutToggle || mobileLayout === "table";

  return (
    <section className="card-surface neon-outline rounded-[var(--radius-panel)] section-card">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start justify-between gap-3 md:block">
          <div className="min-w-0">
            <h2 className="section-title">{title}</h2>
            <p className="text-sm muted-text">{total} records</p>
          </div>
          {showMobileLayoutToggle ? (
            <div
              className="flex shrink-0 rounded-xl border border-[color-mix(in_oklab,var(--border)_55%,transparent)] bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] p-0.5 md:hidden"
              role="group"
              aria-label="Layout on small screens"
            >
              <button
                type="button"
                title="Card view"
                aria-pressed={mobileLayout === "cards"}
                onClick={() => setMobileLayout("cards")}
                className={`rounded-lg p-2 transition-colors ${
                  mobileLayout === "cards"
                    ? "bg-[color-mix(in_srgb,var(--brand)_22%,transparent)] text-[var(--brand)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                <LayoutGrid className="h-4 w-4" aria-hidden strokeWidth={mobileLayout === "cards" ? 2.25 : 2} />
              </button>
              <button
                type="button"
                title="Table view"
                aria-pressed={mobileLayout === "table"}
                onClick={() => setMobileLayout("table")}
                className={`rounded-lg p-2 transition-colors ${
                  mobileLayout === "table"
                    ? "bg-[color-mix(in_srgb,var(--brand)_22%,transparent)] text-[var(--brand)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                <Table className="h-4 w-4" aria-hidden strokeWidth={mobileLayout === "table" ? 2.25 : 2} />
              </button>
            </div>
          ) : null}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSearchChange?.(value);
          }}
          className="flex w-full gap-2 sm:w-auto"
        >
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Search..."
            className="interactive-control focus-ring w-full px-3.5 py-2.5 text-sm sm:w-72"
          />
          <button className="primary-btn px-4 py-2.5 text-sm">
            Search
          </button>
        </form>
      </div>

      <div className={`grid gap-3 md:hidden ${showCardsOnMobile ? "" : "hidden"}`}>
        {loading ? (
          <div className="rounded-2xl border bg-[var(--surface)] px-3 py-6 text-center text-sm muted-text">Loading...</div>
        ) : (rows || []).length ? (
          (rows || []).map((row, idx) => (
            <article key={row.id || row._id || idx} className="rounded-2xl border bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] px-3 py-3">
              <div className="space-y-2">
                {dataColumns.map((column) => (
                  <div key={column.field} className="flex items-start justify-between gap-3 border-b border-[var(--border)] pb-2 last:border-b-0 last:pb-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] muted-text">
                      {typeof column.header === "string" ? column.header : column.field}
                    </p>
                    <div className="text-right text-sm text-[var(--foreground)]">
                      {column.render ? column.render(row) : (row[column.field] ?? <span className="muted-text">-</span>)}
                    </div>
                  </div>
                ))}
              </div>
              {actionColumns.length ? (
                <footer className="mt-3 border-t border-[var(--border)] pt-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    {actionColumns.map((column) => (
                      <div key={column.field}>{column.render ? column.render(row) : null}</div>
                    ))}
                  </div>
                </footer>
              ) : null}
            </article>
          ))
        ) : (
          <div className="rounded-2xl border bg-[var(--surface)] px-3 py-6 text-center text-sm muted-text">{emptyLabel}</div>
        )}
      </div>

      <div
        className={`overflow-x-auto rounded-2xl border border-[color-mix(in_srgb,var(--brand)_22%,var(--border))] md:block ${
          showTableOnMobile ? "block" : "hidden"
        }`}
      >
        <table className="min-w-full text-sm">
          <thead className="bg-[linear-gradient(135deg,color-mix(in_srgb,var(--brand)_12%,var(--surface-soft)),color-mix(in_srgb,var(--accent)_10%,var(--surface-soft)))]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-[var(--border)]">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-3 py-3.5 text-left">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-[color-mix(in_srgb,var(--surface)_96%,transparent)]">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-sm muted-text">
                  Loading...
                </td>
              </tr>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[linear-gradient(90deg,color-mix(in_srgb,var(--brand)_14%,transparent),color-mix(in_srgb,var(--accent)_10%,transparent))]">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-3.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-sm muted-text">
                  {emptyLabel}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
        <p className="text-xs muted-text">
          Page {page} of {totalPages}
        </p>
        <div className="flex gap-2">
          <button
            className="secondary-btn px-3.5 py-2 text-xs disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => onPageChange?.(page - 1)}
          >
            Prev
          </button>
          <button
            className="secondary-btn px-3.5 py-2 text-xs disabled:opacity-40"
            disabled={page >= totalPages}
            onClick={() => onPageChange?.(page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
