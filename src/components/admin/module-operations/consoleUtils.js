"use client";

export function normalizeConfig(config, fields) {
  const next = {};
  for (const field of fields) {
    const raw = config?.[field.key];
    if (field.type === "checkbox") next[field.key] = Boolean(raw);
    else if (raw !== undefined && raw !== null) next[field.key] = String(raw);
    else next[field.key] = "";
  }
  return next;
}

export function isoToDatetimeLocalValue(iso) {
  if (!iso) return "";
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function isoToDateInputValue(iso) {
  if (!iso) return "";
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function valueForItemFieldInput(field, stored) {
  if (field.type === "datetime-local") return isoToDatetimeLocalValue(stored);
  if (field.type === "date") return isoToDateInputValue(stored);
  if (field.type === "number" || field.type === "integer") return String(stored ?? "");
  return String(stored ?? "");
}

export function formatCompactDateTime(value) {
  const d = value ? new Date(String(value)) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

export function toLabel(value) {
  const text = String(value || "").trim();
  if (!text) return "Item";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function getFieldValue(row, field) {
  if (field.target === "root") return row?.[field.key] ?? "";
  return row?.metadata?.[field.key] ?? "";
}

export function formatItemFieldForDetails(row, field) {
  const value = getFieldValue(row, field);
  if (field.type === "url") {
    const href = String(value || "").trim();
    if (!href) return "—";
    return (
      <a href={href} target="_blank" rel="noreferrer" className="font-medium text-[var(--brand)] underline underline-offset-2">
        {href}
      </a>
    );
  }
  if (field.type === "number" || field.type === "integer") {
    const n = Number(value || 0);
    return field.integer || field.type === "integer" ? String(Math.floor(n)) : n.toFixed(2);
  }
  if (field.type === "datetime-local" || field.type === "date") {
    const d = value ? new Date(String(value)) : null;
    return d && !Number.isNaN(d.getTime()) ? d.toLocaleString() : "—";
  }
  const t = String(value ?? "").trim();
  return t || "—";
}

export function TableTextClamp({ text, lines = 2, maxWidthClass = "max-w-[11rem]" }) {
  const s = String(text ?? "").trim();
  if (!s) return <span className="muted-text">—</span>;
  const clamp =
    lines <= 1 ? `${maxWidthClass} truncate` : `${maxWidthClass} line-clamp-2 break-words leading-snug`;
  return (
    <span title={s.length > 48 ? s : undefined} className={`block text-sm ${clamp}`}>
      {s}
    </span>
  );
}

export function TableBriefWords({ text, maxWords = 8 }) {
  const s = String(text ?? "").trim();
  if (!s) return <span className="muted-text">—</span>;
  const words = s.split(/\s+/).filter(Boolean);
  const short = words.length <= maxWords ? s : `${words.slice(0, maxWords).join(" ")}…`;
  return (
    <span title={s} className="block max-w-[9rem] text-sm leading-snug text-[var(--foreground)]">
      {short}
    </span>
  );
}
