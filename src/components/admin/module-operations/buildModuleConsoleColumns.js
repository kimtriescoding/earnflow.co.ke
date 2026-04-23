"use client";

import { normalizeModuleKey } from "@/lib/modules/constants";
import { StatusChip } from "@/components/ui/StatusChip";
import {
  TableTextClamp,
  TableBriefWords,
  formatCompactDateTime,
  valueForItemFieldInput,
  getFieldValue,
} from "./consoleUtils";

export function buildItemColumns(deps) {
  const {
    itemTableShowBrief,
    scheduleColumn,
    itemFieldsForTable,
    itemFields,
    setViewItemRow,
    setItemForm,
    setItemModalOpen,
    deleteItem,
    itemDeleteId,
  } = deps;

  return [
    {
      field: "title",
      header: "Title",
      sortable: false,
      render: (row) => <TableTextClamp text={row.title} lines={1} maxWidthClass="max-w-[10rem]" />,
    },
    ...(itemTableShowBrief
      ? [
          {
            field: "description",
            header: "Brief",
            sortable: false,
            render: (row) => <TableBriefWords text={row.description} maxWords={8} />,
          },
        ]
      : []),
    ...scheduleColumn,
    ...itemFieldsForTable.map((field) => ({
      field: field.key,
      header: field.columnHeader ?? field.label,
      sortable: false,
      render: (row) => {
        const value = getFieldValue(row, field);
        if (field.type === "url") {
          const href = String(value || "").trim();
          if (!href) return "-";
          return (
            <a href={href} target="_blank" rel="noreferrer" className="font-medium text-[var(--brand)] underline underline-offset-2">
              Open URL
            </a>
          );
        }
        if (field.type === "checkbox") {
          return value ? "Yes" : "No";
        }
        if (field.type === "number" || field.type === "integer") {
          return field.integer || field.type === "integer"
            ? String(Math.floor(Number(value || 0)))
            : Number(value || 0).toFixed(2);
        }
        if (field.type === "datetime-local" || field.type === "date") {
          const compact = formatCompactDateTime(value);
          return compact || "—";
        }
        if (field.type === "textarea") {
          return <TableTextClamp text={value} lines={2} maxWidthClass="max-w-[10rem]" />;
        }
        return <TableTextClamp text={value} lines={2} maxWidthClass="max-w-[10rem]" />;
      },
    })),
    {
      field: "reward",
      header: "Reward",
      sortable: false,
      render: (row) => (
        <span className="whitespace-nowrap text-sm tabular-nums">
          {Number(row.reward || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} KES
        </span>
      ),
    },
    {
      field: "status",
      header: "Status",
      sortable: false,
      render: (row) => <StatusChip status={row.status} />,
    },
    {
      field: "actions",
      header: "",
      sortable: false,
      render: (row) => (
        <div className="flex shrink-0 flex-nowrap items-center gap-1.5">
          <button type="button" className="secondary-btn whitespace-nowrap px-2.5 py-1 text-xs" onClick={() => setViewItemRow(row)}>
            View
          </button>
          <button
            type="button"
            className="secondary-btn whitespace-nowrap px-2.5 py-1 text-xs"
            onClick={() => {
              setItemForm({
                id: row._id,
                title: row.title || "",
                description: row.description || "",
                reward: String(row.reward || 0),
                thresholdSeconds: String(row.thresholdSeconds || ""),
                status: row.status || "active",
                ...Object.fromEntries(itemFields.map((field) => [field.key, valueForItemFieldInput(field, getFieldValue(row, field))])),
              });
              setItemModalOpen(true);
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className="secondary-btn inline-flex items-center justify-center gap-1.5 whitespace-nowrap px-2.5 py-1 text-xs text-[var(--danger)]"
            disabled={itemDeleteId === String(row._id)}
            aria-busy={itemDeleteId === String(row._id)}
            onClick={() => deleteItem(row._id)}
          >
            {itemDeleteId === String(row._id) ? (
              <>
                <span
                  className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-90"
                  aria-hidden
                />
                <span>Deleting…</span>
              </>
            ) : (
              "Delete"
            )}
          </button>
        </div>
      ),
    },
  ];
}

export function buildDefaultInteractionColumns(deps) {
  const {
    moduleSlug,
    enablePendingEarningReview,
    interactionColumns,
    reviewingEventId,
    setReviewDialogRow,
    setReviewDialogStep,
    setReviewDialogChoice,
  } = deps;

  const submissionProofColumns =
    enablePendingEarningReview && interactionColumns == null
      ? [
          {
            field: "submissionProof",
            header: "Proof",
            sortable: false,
            render: (row) => {
              const eid = row.earningEventId ? String(row.earningEventId) : "";
              if (row.status !== "pending" || !eid) return <span className="muted-text">—</span>;
              const mod = normalizeModuleKey(moduleSlug);
              if (mod === "academic") {
                return (
                  <a
                    href={`/api/modules/academic/submissions/${eid}/file`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-[var(--brand)] underline underline-offset-2"
                  >
                    Open PDF
                  </a>
                );
              }
              if (mod === "video" && (row.metadata?.watchedSeconds != null || row.metadata?.threshold != null)) {
                const w = row.metadata?.watchedSeconds;
                const t = row.metadata?.threshold;
                return (
                  <span className="text-xs tabular-nums text-[var(--foreground)]">
                    {w != null ? `${w}s` : "—"} / {t != null ? `${t}s` : "—"}
                  </span>
                );
              }
              return <span className="muted-text">—</span>;
            },
          },
        ]
      : [];

  const reviewActionColumns =
    enablePendingEarningReview && interactionColumns == null
      ? [
          {
            field: "reviewActions",
            header: "Review",
            sortable: false,
            render: (row) => {
              const eid = row.earningEventId ? String(row.earningEventId) : "";
              if (row.status !== "pending" || !eid) return <span className="muted-text">—</span>;
              const busy = reviewingEventId === eid;
              return (
                <button
                  type="button"
                  className="primary-btn inline-flex items-center justify-center gap-1.5 whitespace-nowrap px-2.5 py-1 text-xs"
                  disabled={busy}
                  aria-busy={busy}
                  onClick={() => {
                    setReviewDialogRow(row);
                    setReviewDialogStep(1);
                    setReviewDialogChoice(null);
                  }}
                >
                  {busy ? (
                    <>
                      <span
                        className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-90"
                        aria-hidden
                      />
                      <span>Working…</span>
                    </>
                  ) : (
                    "Review"
                  )}
                </button>
              );
            },
          },
        ]
      : [];

  return [
    { field: "action", header: "Action", sortable: false },
    {
      field: "itemId",
      header: "Item",
      sortable: false,
      render: (row) => row.itemId?.title || "-",
    },
    {
      field: "userId",
      header: "User",
      sortable: false,
      render: (row) => row.userId?.username || row.userId?.email || "-",
    },
    {
      field: "status",
      header: "Status",
      sortable: false,
      render: (row) => <StatusChip status={row.status} />,
    },
    { field: "amount", header: "Amount (KES)", sortable: false, render: (row) => Number(row.amount || 0).toFixed(2) },
    ...submissionProofColumns,
    { field: "createdAt", header: "Date", sortable: false, render: (row) => new Date(row.createdAt).toLocaleString() },
    ...reviewActionColumns,
  ];
}
