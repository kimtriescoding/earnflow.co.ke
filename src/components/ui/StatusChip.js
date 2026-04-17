"use client";

const TONE_CLASSES = {
  success:
    "border-emerald-400/42 bg-[linear-gradient(135deg,rgba(16,185,129,0.2),rgba(16,185,129,0.1))] text-emerald-900 dark:text-emerald-200",
  danger:
    "border-rose-400/42 bg-[linear-gradient(135deg,rgba(244,63,94,0.2),rgba(244,63,94,0.1))] text-rose-900 dark:text-rose-200",
  warning:
    "border-amber-400/45 bg-[linear-gradient(135deg,rgba(245,158,11,0.2),rgba(245,158,11,0.1))] text-amber-900 dark:text-amber-200",
  info: "border-cyan-400/45 bg-[linear-gradient(135deg,rgba(22,217,255,0.2),rgba(22,217,255,0.08))] text-cyan-900 dark:text-cyan-200",
  neutral:
    "border-[color-mix(in_srgb,var(--brand)_28%,var(--border))] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--brand)_12%,transparent),color-mix(in_srgb,var(--accent)_10%,transparent))] text-[var(--muted)]",
};

const SUCCESS = new Set(["completed", "approved", "active", "success", "paid", "win"]);
const DANGER = new Set(["failed", "rejected", "inactive", "cancelled", "canceled", "error", "loss"]);
const WARNING = new Set(["pending", "processing", "submitted", "queued"]);

/**
 * @param {string | null | undefined} status
 * @returns {"success"|"danger"|"warning"|"info"|"neutral"}
 */
export function statusTone(status) {
  const key = String(status ?? "")
    .trim()
    .toLowerCase();
  if (!key) return "neutral";
  if (SUCCESS.has(key)) return "success";
  if (DANGER.has(key)) return "danger";
  if (WARNING.has(key)) return "warning";
  return "neutral";
}

function humanizeStatus(status) {
  const s = String(status ?? "").trim();
  if (!s) return "—";
  return s.replace(/_/g, " ");
}

/**
 * Pill status indicator for tables and detail views.
 */
export function StatusChip({ status, label, className = "" }) {
  const tone = statusTone(status);
  const display =
    label != null && String(label).trim() !== "" ? String(label).trim() : humanizeStatus(status) || "—";

  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-xs font-semibold capitalize tracking-[0.01em] ${TONE_CLASSES[tone]} ${className}`.trim()}
      title={display.length > 24 ? display : undefined}
    >
      <span className="truncate">{display}</span>
    </span>
  );
}
