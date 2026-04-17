"use client";

import { StatusChip } from "@/components/ui/StatusChip";
import { getFieldValue, valueForItemFieldInput, formatItemFieldForDetails } from "./consoleUtils";

export function ModuleItemViewModal({
  viewItemRow,
  itemLabel,
  showThresholdSeconds,
  itemFields,
  onClose,
  onEdit,
}) {
  if (!viewItemRow) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="card-surface max-h-[min(90vh,720px)] w-full max-w-2xl overflow-y-auto rounded-3xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h4 className="heading-display text-base font-semibold">View {itemLabel}</h4>
          <button type="button" className="secondary-btn px-3 py-1.5 text-xs" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="mt-4 space-y-4">
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Title</p>
            <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{viewItemRow.title || "—"}</p>
          </section>
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Description</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)]">
              {viewItemRow.description?.trim() ? viewItemRow.description : "—"}
            </p>
          </section>
          <dl className="grid gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Reward (KES)</dt>
              <dd className="mt-0.5 tabular-nums">
                {Number(viewItemRow.reward || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                })}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Status</dt>
              <dd className="mt-0.5">
                <StatusChip status={viewItemRow.status} />
              </dd>
            </div>
            {showThresholdSeconds ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Threshold (seconds)</dt>
                <dd className="mt-0.5">{viewItemRow.thresholdSeconds ?? "—"}</dd>
              </div>
            ) : null}
            {itemFields.map((field) => (
              <div key={field.key} className={field.type === "textarea" ? "md:col-span-2" : ""}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{field.label}</dt>
                <dd className="mt-0.5 break-words">{formatItemFieldForDetails(viewItemRow, field)}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
            <button type="button" className="primary-btn px-4 py-2 text-sm" onClick={() => onEdit(viewItemRow)}>
              Edit {itemLabel}
            </button>
            <button type="button" className="secondary-btn px-4 py-2 text-sm" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
