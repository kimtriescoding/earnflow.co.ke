"use client";

import { normalizeModuleKey } from "@/lib/modules/constants";

export function ReviewSubmissionDialog({
  reviewDialogRow,
  reviewDialogStep,
  reviewDialogChoice,
  setReviewDialogChoice,
  setReviewDialogStep,
  reviewingEventId,
  moduleSlug,
  closeReviewDialog,
  confirmReviewFromDialog,
}) {
  if (!reviewDialogRow) return null;

  const r = reviewDialogRow;
  const eid = r.earningEventId ? String(r.earningEventId) : "";
  const mod = normalizeModuleKey(moduleSlug);
  const dialogBusy = reviewingEventId === eid;
  const userLabel = r.userId?.username || r.userId?.email || "—";
  const itemLabelText = r.itemId?.title || "—";
  const amountText = Number(r.amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        if (!reviewingEventId) closeReviewDialog();
      }}
    >
      <div
        className="card-surface max-h-[min(90vh,640px)] w-full max-w-lg overflow-y-auto rounded-3xl p-5 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h4 id="review-dialog-title" className="heading-display text-base font-semibold">
            Review submission
          </h4>
          <button type="button" className="secondary-btn px-3 py-1.5 text-xs" disabled={!!reviewingEventId} onClick={closeReviewDialog}>
            Close
          </button>
        </div>

        <dl className="mt-4 grid gap-3 border-b border-[var(--border)] pb-4 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">User</dt>
            <dd className="mt-0.5">{userLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Item</dt>
            <dd className="mt-0.5">{itemLabelText}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Amount (KES)</dt>
            <dd className="mt-0.5 tabular-nums">{amountText}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Proof</dt>
            <dd className="mt-0.5">
              {mod === "academic" && eid ? (
                <a
                  href={`/api/modules/academic/submissions/${eid}/file`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-[var(--brand)] underline underline-offset-2"
                >
                  Open PDF
                </a>
              ) : mod === "video" && (r.metadata?.watchedSeconds != null || r.metadata?.threshold != null) ? (
                <span className="tabular-nums text-[var(--foreground)]">
                  {r.metadata?.watchedSeconds != null ? `${r.metadata.watchedSeconds}s` : "—"} /{" "}
                  {r.metadata?.threshold != null ? `${r.metadata.threshold}s` : "—"}
                </span>
              ) : (
                <span className="muted-text">—</span>
              )}
            </dd>
          </div>
        </dl>

        {reviewDialogStep === 1 ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-[var(--foreground)]">Choose an outcome for this reward.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={dialogBusy}
                onClick={() => setReviewDialogChoice("approve")}
                className={`rounded-2xl border-2 px-4 py-3 text-left text-sm font-medium transition-colors ${
                  reviewDialogChoice === "approve"
                    ? "border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--foreground)]"
                    : "border-[var(--border)] text-[var(--foreground)] hover:border-[var(--muted)]"
                }`}
              >
                Approve
                <span className="mt-1 block text-xs font-normal text-[var(--muted)]">Pay the user this reward.</span>
              </button>
              <button
                type="button"
                disabled={dialogBusy}
                onClick={() => setReviewDialogChoice("reject")}
                className={`rounded-2xl border-2 px-4 py-3 text-left text-sm font-medium transition-colors ${
                  reviewDialogChoice === "reject"
                    ? "border-[var(--danger)] bg-red-500/10 text-[var(--foreground)]"
                    : "border-[var(--border)] text-[var(--foreground)] hover:border-[var(--muted)]"
                }`}
              >
                Reject
                <span className="mt-1 block text-xs font-normal text-[var(--muted)]">Do not pay; mark as rejected.</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                className="primary-btn inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm"
                disabled={!reviewDialogChoice || dialogBusy}
                onClick={() => setReviewDialogStep(2)}
              >
                Continue to confirmation
              </button>
              <button type="button" className="secondary-btn px-4 py-2 text-sm" disabled={dialogBusy} onClick={closeReviewDialog}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div
              className={`rounded-2xl border px-4 py-3 text-sm leading-relaxed ${
                reviewDialogChoice === "reject"
                  ? "border-[var(--danger)]/40 bg-red-500/5"
                  : "border-[var(--border)] bg-[var(--muted)]/10"
              }`}
            >
              {reviewDialogChoice === "approve" ? (
                <p>
                  <strong className="text-[var(--foreground)]">Confirm approval:</strong> this credits{" "}
                  <span className="tabular-nums font-semibold">{amountText} KES</span> to <span className="font-semibold">{userLabel}</span>{" "}
                  for <span className="font-semibold">{itemLabelText}</span>.
                </p>
              ) : (
                <p>
                  <strong className="text-[var(--danger)]">Confirm rejection:</strong> the user will <strong>not</strong> be paid for this
                  submission. You can still change your mind by going back.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium ${
                  reviewDialogChoice === "reject"
                    ? "rounded-2xl bg-[var(--danger)] text-white hover:opacity-95 disabled:opacity-50"
                    : "primary-btn"
                }`}
                disabled={dialogBusy}
                aria-busy={dialogBusy}
                onClick={() => confirmReviewFromDialog()}
              >
                {dialogBusy ? (
                  <>
                    <span
                      className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-90"
                      aria-hidden
                    />
                    <span>Working…</span>
                  </>
                ) : reviewDialogChoice === "approve" ? (
                  "Confirm approval"
                ) : (
                  "Confirm rejection"
                )}
              </button>
              <button type="button" className="secondary-btn px-4 py-2 text-sm" disabled={dialogBusy} onClick={() => setReviewDialogStep(1)}>
                Back
              </button>
              <button type="button" className="secondary-btn px-4 py-2 text-sm" disabled={dialogBusy} onClick={closeReviewDialog}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
