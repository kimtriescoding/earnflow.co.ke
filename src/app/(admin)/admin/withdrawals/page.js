"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/ui/AppShell";
import { AdvancedTable } from "@/components/admin/AdvancedTable";
import { adminNavItems } from "@/lib/nav/admin-nav";
import { toast } from "sonner";
import { StatusChip } from "@/components/ui/StatusChip";

function withdrawalFailedReasonTitle(row) {
  if (row.status !== "failed") return undefined;
  const notes = String(row.notes || "").trim();
  if (notes) return notes;
  const cb = row.metadata?.lastCallbackStatus;
  if (cb != null && String(cb).trim() !== "") return `Gateway status: ${String(cb).trim()}`;
  return "No failure details recorded";
}

export default function AdminWithdrawalsPage() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [refundModalRow, setRefundModalRow] = useState(null);
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [ackModalRow, setAckModalRow] = useState(null);
  const [ackSubmitting, setAckSubmitting] = useState(false);
  const [postModalRow, setPostModalRow] = useState(null);
  const [postSubmitting, setPostSubmitting] = useState(false);
  const [completeModalRow, setCompleteModalRow] = useState(null);
  const [completeSubmitting, setCompleteSubmitting] = useState(false);
  const [completeTxId, setCompleteTxId] = useState("");
  const [completeNotes, setCompleteNotes] = useState("");
  const [cancelModalRow, setCancelModalRow] = useState(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelNotes, setCancelNotes] = useState("");
  const pageSize = 20;

  const loadData = () => {
    setLoading(true);
    fetch(`/api/admin/withdrawals?page=${page}&pageSize=${pageSize}&status=${status}&search=${encodeURIComponent(search)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) return;
        setRows((data.data || []).map((item) => ({ ...item, id: item._id })));
        setTotal(data.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, search]);

  const closeRefundModal = useCallback(() => {
    if (refundSubmitting) return;
    setRefundModalRow(null);
  }, [refundSubmitting]);

  const closeAckModal = useCallback(() => {
    if (ackSubmitting) return;
    setAckModalRow(null);
  }, [ackSubmitting]);

  const closePostModal = useCallback(() => {
    if (postSubmitting) return;
    setPostModalRow(null);
  }, [postSubmitting]);

  const closeCompleteModal = useCallback(() => {
    if (completeSubmitting) return;
    setCompleteModalRow(null);
    setCompleteTxId("");
    setCompleteNotes("");
  }, [completeSubmitting]);

  const closeCancelModal = useCallback(() => {
    if (cancelSubmitting) return;
    setCancelModalRow(null);
    setCancelNotes("");
  }, [cancelSubmitting]);

  useEffect(() => {
    if (!refundModalRow) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !refundSubmitting) closeRefundModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [refundModalRow, refundSubmitting, closeRefundModal]);

  useEffect(() => {
    if (!ackModalRow) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !ackSubmitting) closeAckModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ackModalRow, ackSubmitting, closeAckModal]);

  useEffect(() => {
    if (!postModalRow) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !postSubmitting) closePostModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [postModalRow, postSubmitting, closePostModal]);

  useEffect(() => {
    if (!completeModalRow) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !completeSubmitting) closeCompleteModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [completeModalRow, completeSubmitting, closeCompleteModal]);

  useEffect(() => {
    if (!cancelModalRow) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !cancelSubmitting) closeCancelModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cancelModalRow, cancelSubmitting, closeCancelModal]);

  const confirmPostToGateway = async () => {
    const row = postModalRow;
    if (!row) return;
    setPostSubmitting(true);
    try {
      const res = await fetch("/api/admin/withdrawals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withdrawalId: row._id, action: "post_to_gateway" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        toast.error(data.message || data.error || "Failed to post payout to gateway.");
        return;
      }
      toast.success("Payout successfully posted to gateway.");
      setPostModalRow(null);
      loadData();
    } finally {
      setPostSubmitting(false);
    }
  };

  const confirmCompleteManually = async () => {
    const row = completeModalRow;
    if (!row) return;
    setCompleteSubmitting(true);
    try {
      const res = await fetch("/api/admin/withdrawals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          withdrawalId: row._id,
          action: "complete_manual",
          transactionId: completeTxId,
          notes: completeNotes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        toast.error(data.message || data.error || "Failed to complete payout manually.");
        return;
      }
      toast.success("Payout marked as completed manually.");
      setCompleteModalRow(null);
      setCompleteTxId("");
      setCompleteNotes("");
      loadData();
    } finally {
      setCompleteSubmitting(false);
    }
  };

  const confirmCancelPayout = async () => {
    const row = cancelModalRow;
    if (!row) return;
    setCancelSubmitting(true);
    try {
      const res = await fetch("/api/admin/withdrawals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          withdrawalId: row._id,
          action: "cancel",
          notes: cancelNotes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        toast.error(data.message || data.error || "Failed to cancel payout.");
        return;
      }
      toast.success("Payout cancelled and refunded to wallet.");
      setCancelModalRow(null);
      setCancelNotes("");
      loadData();
    } finally {
      setCancelSubmitting(false);
    }
  };

  const updateStatus = async (withdrawalId, nextStatus) => {
    const res = await fetch("/api/admin/withdrawals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ withdrawalId, status: nextStatus }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      toast.error(data.message || data.error || "Failed to update withdrawal.");
      return;
    }
    toast.success("Withdrawal status updated.");
    loadData();
  };

  const confirmAcknowledgeNoRefund = async () => {
    const row = ackModalRow;
    if (!row) return;
    setAckSubmitting(true);
    try {
      const res = await fetch("/api/admin/withdrawals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withdrawalId: row._id, action: "acknowledge_no_refund" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        toast.error(data.message || data.error || "Could not record refund verification.");
        return;
      }
      toast.success(data.message || "Refund verified on ledger.");
      setAckModalRow(null);
      loadData();
    } finally {
      setAckSubmitting(false);
    }
  };

  const confirmIssueRefund = async () => {
    const row = refundModalRow;
    if (!row) return;
    setRefundSubmitting(true);
    try {
      const res = await fetch("/api/admin/withdrawals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withdrawalId: row._id, action: "issue_refund" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        toast.error(data.message || data.error || "Could not issue refund.");
        return;
      }
      toast.success(data.message || "Refund issued.");
      setRefundModalRow(null);
      loadData();
    } finally {
      setRefundSubmitting(false);
    }
  };

  const columns = [
    { field: "user", header: "User", sortable: false, render: (row) => row.user?.username || "-" },
    {
      field: "walletBefore",
      header: "Bal. before (KES)",
      sortable: false,
      render: (row) => {
        const v = row.metadata?.walletAvailableBefore;
        if (v === undefined || v === null || Number.isNaN(Number(v))) return <span className="muted-text">—</span>;
        return <span className="tabular-nums">{Number(v).toFixed(2)}</span>;
      },
    },
    { field: "amount", header: "Amount (KES)", sortable: false, render: (row) => Number(row.amount || 0).toFixed(2) },
    {
      field: "fee",
      header: "Fee (KES)",
      sortable: false,
      render: (row) => Number(row.fee ?? 0).toFixed(2),
    },
    { field: "phoneNumber", header: "Phone", sortable: false },
    {
      field: "status",
      header: "Status",
      sortable: false,
      render: (row) => <StatusChip status={row.status} title={withdrawalFailedReasonTitle(row)} />,
    },
    { field: "createdAt", header: "Date", sortable: false, render: (row) => new Date(row.createdAt).toLocaleString() },
    {
      field: "actions",
      header: "Actions",
      sortable: false,
      render: (row) => {
        const isPending = row.status === "pending";
        const isFailed = row.status === "failed";
        const ledgerAck = Boolean(row.metadata?.noRefundLedgerAcknowledged);
        const walletAlreadyReconciledInitNeverCompleted =
          isFailed &&
          !row.hasRefundTransaction &&
          row.metadata?.balanceRefunded === true &&
          row.metadata?.payoutGatewayQueued === false;
        const canAttemptRefund =
          isFailed &&
          !row.hasRefundTransaction &&
          !walletAlreadyReconciledInitNeverCompleted &&
          Number(row.amount || 0) + Number(row.fee || 0) > 0;
        const canShowRefund = canAttemptRefund && ledgerAck;
        const canShowLedgerRefund = canAttemptRefund && !ledgerAck;
        const btnDense =
          "secondary-btn inline-flex min-h-0 shrink-0 cursor-pointer items-center rounded-md px-2.5 py-1.5 text-xs font-medium leading-snug disabled:cursor-not-allowed";

        if (isFailed) {
          return (
            <div className="flex flex-wrap items-center gap-1">
              {row.hasRefundTransaction ? (
                <span className="text-xs leading-snug text-[var(--muted)]">Refunded</span>
              ) : walletAlreadyReconciledInitNeverCompleted ? (
                <span
                  className="text-xs leading-snug text-[var(--muted)]"
                  title="Payout never reached the gateway; wallet was rolled back when the request failed. No manual refund."
                >
                  —
                </span>
              ) : canShowLedgerRefund ? (
                <button
                  type="button"
                  className="inline-flex min-h-0 shrink-0 cursor-pointer items-center rounded-md border border-emerald-800 bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold leading-snug text-white shadow-sm hover:bg-emerald-600"
                  onClick={() => setAckModalRow(row)}
                >
                  Refund
                </button>
              ) : canShowRefund ? (
                <button
                  type="button"
                  className="inline-flex min-h-0 shrink-0 cursor-pointer items-center rounded-md border border-orange-600/90 bg-orange-600 px-2.5 py-1.5 text-xs font-semibold leading-snug text-white shadow-sm hover:bg-orange-500"
                  onClick={() => setRefundModalRow(row)}
                >
                  Refund
                </button>
              ) : (
                <span className="text-xs leading-snug text-[var(--muted)]">—</span>
              )}
            </div>
          );
        }

        if (row.status === "completed") {
          return <span className="text-xs leading-snug text-[var(--muted)]">—</span>;
        }

        return (
          <div className="flex flex-wrap items-center gap-1">
            {row.metadata?.payoutGatewayQueued && (
              <span className="text-[10px] uppercase font-semibold text-sky-500 bg-sky-500/10 px-1.5 py-0.5 rounded mr-1">
                Gateway Queued
              </span>
            )}
            {!row.metadata?.payoutGatewayQueued && (
              <button
                type="button"
                className="inline-flex min-h-0 shrink-0 cursor-pointer items-center rounded-md border border-[var(--brand)] bg-[var(--brand)] px-2.5 py-1.5 text-xs font-semibold leading-snug text-white shadow-sm hover:bg-[color-mix(in_srgb,var(--brand)_90%,black)]"
                onClick={() => setPostModalRow(row)}
              >
                Post to Gateway
              </button>
            )}
            <button
              type="button"
              className="inline-flex min-h-0 shrink-0 cursor-pointer items-center rounded-md border border-emerald-800 bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold leading-snug text-white shadow-sm hover:bg-emerald-600"
              onClick={() => setCompleteModalRow(row)}
            >
              Complete
            </button>
            <button
              type="button"
              className="inline-flex min-h-0 shrink-0 cursor-pointer items-center rounded-md border border-red-800 bg-red-700 px-2.5 py-1.5 text-xs font-semibold leading-snug text-white shadow-sm hover:bg-red-600"
              onClick={() => setCancelModalRow(row)}
            >
              Cancel
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
          Review pending requests, status updates, and payout callback outcomes. For failed payouts with no refund on
          file: <strong className="text-[var(--foreground)]">Refund</strong> (green) records your ledger check; then{" "}
          <strong className="text-[var(--foreground)]">Refund</strong> (orange) credits the wallet.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {["", "pending", "failed", "completed", "approved", "rejected"].map((item) => (
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
        onSearchChange={(value) => {
          setPage(1);
          setSearch(value);
        }}
        onSortChange={() => {}}
        onPageChange={setPage}
        emptyLabel="No withdrawals found."
        loading={loading}
      />

      {refundModalRow ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={(e) => {
            if (e.target !== e.currentTarget) return;
            if (!refundSubmitting) closeRefundModal();
          }}
        >
          <div
            className="card-surface w-full max-w-md overflow-y-auto rounded-3xl p-5 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="refund-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h4 id="refund-dialog-title" className="heading-display text-base font-semibold">
                Issue wallet refund
              </h4>
              <button
                type="button"
                className="secondary-btn inline-flex min-h-0 cursor-pointer items-center px-3 py-1.5 text-xs"
                disabled={refundSubmitting}
                onClick={closeRefundModal}
              >
                Close
              </button>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-[var(--foreground)]">
              {"This credits the user's available balance for a failed payout: M-Pesa amount plus fee. Only continue if you have verified "}
              <strong>no</strong>
              {" existing refund transaction for this withdrawal."}
            </p>

            <dl className="mt-4 grid gap-3 border-y border-[var(--border)] py-4 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">User</dt>
                <dd className="mt-0.5">{refundModalRow.user?.username || refundModalRow.user?.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Phone</dt>
                <dd className="mt-0.5">{refundModalRow.phoneNumber || "—"}</dd>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Payout (KES)</dt>
                  <dd className="mt-0.5 tabular-nums">{Number(refundModalRow.amount || 0).toFixed(2)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Fee (KES)</dt>
                  <dd className="mt-0.5 tabular-nums">{Number(refundModalRow.fee ?? 0).toFixed(2)}</dd>
                </div>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Total credit (KES)</dt>
                <dd className="mt-0.5 text-base font-semibold tabular-nums text-[var(--foreground)]">
                  {(Number(refundModalRow.amount || 0) + Number(refundModalRow.fee ?? 0)).toFixed(2)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Wallet before request (KES)</dt>
                <dd className="mt-0.5 tabular-nums">
                  {refundModalRow.metadata?.walletAvailableBefore != null &&
                  !Number.isNaN(Number(refundModalRow.metadata.walletAvailableBefore))
                    ? Number(refundModalRow.metadata.walletAvailableBefore).toFixed(2)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Ledger</dt>
                <dd className="mt-0.5 text-[var(--foreground)]">
                  Ledger verified: no refund transaction on file. Wallet credit is allowed.
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Withdrawal ID</dt>
                <dd className="mt-0.5 break-all font-mono text-xs text-[var(--muted)]">{String(refundModalRow._id)}</dd>
              </div>
            </dl>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex min-h-0 cursor-pointer items-center justify-center gap-1.5 rounded-2xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-55"
                disabled={refundSubmitting}
                aria-busy={refundSubmitting}
                onClick={() => void confirmIssueRefund()}
              >
                {refundSubmitting ? (
                  <>
                    <span
                      className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-90"
                      aria-hidden
                    />
                    <span>Issuing…</span>
                  </>
                ) : (
                  "Confirm refund"
                )}
              </button>
              <button
                type="button"
                className="secondary-btn inline-flex min-h-0 cursor-pointer px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                disabled={refundSubmitting}
                onClick={closeRefundModal}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {ackModalRow ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={(e) => {
            if (e.target !== e.currentTarget) return;
            if (!ackSubmitting) closeAckModal();
          }}
        >
          <div
            className="card-surface w-full max-w-md overflow-y-auto rounded-3xl p-5 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ack-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h4 id="ack-dialog-title" className="heading-display text-base font-semibold">
                Refund — verify ledger
              </h4>
              <button
                type="button"
                className="secondary-btn inline-flex min-h-0 cursor-pointer items-center px-3 py-1.5 text-xs"
                disabled={ackSubmitting}
                onClick={closeAckModal}
              >
                Close
              </button>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-[var(--foreground)]">
              Confirm you checked the ledger and that <strong>no refund</strong> row exists for this withdrawal. After
              this, the orange <strong>Refund</strong> button will credit the user wallet.
            </p>

            <dl className="mt-4 grid gap-3 border-y border-[var(--border)] py-4 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">User</dt>
                <dd className="mt-0.5">{ackModalRow.user?.username || ackModalRow.user?.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Wallet before request (KES)</dt>
                <dd className="mt-0.5 tabular-nums">
                  {ackModalRow.metadata?.walletAvailableBefore != null &&
                  !Number.isNaN(Number(ackModalRow.metadata.walletAvailableBefore))
                    ? Number(ackModalRow.metadata.walletAvailableBefore).toFixed(2)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Withdrawal ID</dt>
                <dd className="mt-0.5 break-all font-mono text-xs text-[var(--muted)]">{String(ackModalRow._id)}</dd>
              </div>
            </dl>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex min-h-0 cursor-pointer items-center justify-center gap-1.5 rounded-2xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-55"
                disabled={ackSubmitting}
                aria-busy={ackSubmitting}
                onClick={() => void confirmAcknowledgeNoRefund()}
              >
                {ackSubmitting ? (
                  <>
                    <span
                      className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-90"
                      aria-hidden
                    />
                    <span>Saving…</span>
                  </>
                ) : (
                  "Verify refund"
                )}
              </button>
              <button
                type="button"
                className="secondary-btn inline-flex min-h-0 cursor-pointer px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                disabled={ackSubmitting}
                onClick={closeAckModal}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {postModalRow ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={(e) => {
            if (e.target !== e.currentTarget) return;
            if (!postSubmitting) closePostModal();
          }}
        >
          <div
            className="card-surface w-full max-w-md overflow-y-auto rounded-3xl p-5 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="post-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h4 id="post-dialog-title" className="heading-display text-base font-semibold">
                Post payout to gateway
              </h4>
              <button
                type="button"
                className="secondary-btn inline-flex min-h-0 cursor-pointer items-center px-3 py-1.5 text-xs"
                disabled={postSubmitting}
                onClick={closePostModal}
              >
                Close
              </button>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-[var(--foreground)]">
              This will send the payout request to the configured payment gateway (Zetupay/Wavepay) immediately.
            </p>

            <dl className="mt-4 grid gap-3 border-y border-[var(--border)] py-4 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">User</dt>
                <dd className="mt-0.5">{postModalRow.user?.username || postModalRow.user?.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Phone</dt>
                <dd className="mt-0.5">{postModalRow.phoneNumber || "—"}</dd>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Payout (KES)</dt>
                  <dd className="mt-0.5 tabular-nums">{Number(postModalRow.amount || 0).toFixed(2)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Fee (KES)</dt>
                  <dd className="mt-0.5 tabular-nums">{Number(postModalRow.fee ?? 0).toFixed(2)}</dd>
                </div>
              </div>
            </dl>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex min-h-0 cursor-pointer items-center justify-center gap-1.5 rounded-2xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[color-mix(in_srgb,var(--brand)_90%,black)] disabled:cursor-not-allowed disabled:opacity-55"
                disabled={postSubmitting}
                aria-busy={postSubmitting}
                onClick={() => void confirmPostToGateway()}
              >
                {postSubmitting ? (
                  <>
                    <span
                      className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-90"
                      aria-hidden
                    />
                    <span>Posting…</span>
                  </>
                ) : (
                  "Confirm post to gateway"
                )}
              </button>
              <button
                type="button"
                className="secondary-btn inline-flex min-h-0 cursor-pointer px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                disabled={postSubmitting}
                onClick={closePostModal}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {completeModalRow ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={(e) => {
            if (e.target !== e.currentTarget) return;
            if (!completeSubmitting) closeCompleteModal();
          }}
        >
          <div
            className="card-surface w-full max-w-md overflow-y-auto rounded-3xl p-5 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="complete-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h4 id="complete-dialog-title" className="heading-display text-base font-semibold">
                Complete payout manually
              </h4>
              <button
                type="button"
                className="secondary-btn inline-flex min-h-0 cursor-pointer items-center px-3 py-1.5 text-xs"
                disabled={completeSubmitting}
                onClick={closeCompleteModal}
              >
                Close
              </button>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-[var(--foreground)]">
              This will mark the withdrawal request as completed. Enter the manual transaction reference/receipt and notes below.
            </p>

            <div className="mt-4 space-y-3">
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Transaction ID / Reference
                <input
                  className="interactive-control focus-ring mt-1 w-full rounded-xl bg-[var(--surface-soft)] px-3.5 py-2.5 text-sm normal-case font-normal text-[var(--foreground)]"
                  value={completeTxId}
                  onChange={(e) => setCompleteTxId(e.target.value)}
                  placeholder="e.g. MPESA-REF-1234"
                  disabled={completeSubmitting}
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Admin Notes
                <input
                  className="interactive-control focus-ring mt-1 w-full rounded-xl bg-[var(--surface-soft)] px-3.5 py-2.5 text-sm normal-case font-normal text-[var(--foreground)]"
                  value={completeNotes}
                  onChange={(e) => setCompleteNotes(e.target.value)}
                  placeholder="e.g. Paid manually via alternative channel"
                  disabled={completeSubmitting}
                />
              </label>
            </div>

            <dl className="mt-4 grid gap-3 border-y border-[var(--border)] py-4 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">User</dt>
                <dd className="mt-0.5">{completeModalRow.user?.username || completeModalRow.user?.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Phone</dt>
                <dd className="mt-0.5">{completeModalRow.phoneNumber || "—"}</dd>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Payout (KES)</dt>
                  <dd className="mt-0.5 tabular-nums">{Number(completeModalRow.amount || 0).toFixed(2)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Fee (KES)</dt>
                  <dd className="mt-0.5 tabular-nums">{Number(completeModalRow.fee ?? 0).toFixed(2)}</dd>
                </div>
              </div>
            </dl>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex min-h-0 cursor-pointer items-center justify-center gap-1.5 rounded-2xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-55"
                disabled={completeSubmitting}
                aria-busy={completeSubmitting}
                onClick={() => void confirmCompleteManually()}
              >
                {completeSubmitting ? (
                  <>
                    <span
                      className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-90"
                      aria-hidden
                    />
                    <span>Completing…</span>
                  </>
                ) : (
                  "Confirm complete manually"
                )}
              </button>
              <button
                type="button"
                className="secondary-btn inline-flex min-h-0 cursor-pointer px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                disabled={completeSubmitting}
                onClick={closeCompleteModal}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {cancelModalRow ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={(e) => {
            if (e.target !== e.currentTarget) return;
            if (!cancelSubmitting) closeCancelModal();
          }}
        >
          <div
            className="card-surface w-full max-w-md overflow-y-auto rounded-3xl p-5 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h4 id="cancel-dialog-title" className="heading-display text-base font-semibold">
                Cancel payout & refund
              </h4>
              <button
                type="button"
                className="secondary-btn inline-flex min-h-0 cursor-pointer items-center px-3 py-1.5 text-xs"
                disabled={cancelSubmitting}
                onClick={closeCancelModal}
              >
                Close
              </button>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-[var(--foreground)]">
              This will cancel the payout, setting the status to Failed, and refund the amount plus fee back to the user's available wallet balance.
            </p>

            <div className="mt-4">
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Cancellation Reason / Note
                <input
                  className="interactive-control focus-ring mt-1 w-full rounded-xl bg-[var(--surface-soft)] px-3.5 py-2.5 text-sm normal-case font-normal text-[var(--foreground)]"
                  value={cancelNotes}
                  onChange={(e) => setCancelNotes(e.target.value)}
                  placeholder="e.g. Invalid phone number or account details"
                  disabled={cancelSubmitting}
                />
              </label>
            </div>

            <dl className="mt-4 grid gap-3 border-y border-[var(--border)] py-4 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">User</dt>
                <dd className="mt-0.5">{cancelModalRow.user?.username || cancelModalRow.user?.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Phone</dt>
                <dd className="mt-0.5">{cancelModalRow.phoneNumber || "—"}</dd>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Payout (KES)</dt>
                  <dd className="mt-0.5 tabular-nums">{Number(cancelModalRow.amount || 0).toFixed(2)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Fee (KES)</dt>
                  <dd className="mt-0.5 tabular-nums">{Number(cancelModalRow.fee ?? 0).toFixed(2)}</dd>
                </div>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Total refund to wallet (KES)</dt>
                <dd className="mt-0.5 text-base font-semibold tabular-nums text-[var(--foreground)]">
                  {(Number(cancelModalRow.amount || 0) + Number(cancelModalRow.fee ?? 0)).toFixed(2)}
                </dd>
              </div>
            </dl>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex min-h-0 cursor-pointer items-center justify-center gap-1.5 rounded-2xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-55"
                disabled={cancelSubmitting}
                aria-busy={cancelSubmitting}
                onClick={() => void confirmCancelPayout()}
              >
                {cancelSubmitting ? (
                  <>
                    <span
                      className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-90"
                      aria-hidden
                    />
                    <span>Cancelling…</span>
                  </>
                ) : (
                  "Confirm cancellation"
                )}
              </button>
              <button
                type="button"
                className="secondary-btn inline-flex min-h-0 cursor-pointer px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                disabled={cancelSubmitting}
                onClick={closeCancelModal}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
