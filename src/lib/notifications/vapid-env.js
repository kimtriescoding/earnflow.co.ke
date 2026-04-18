/**
 * Normalizes VAPID material from .env (quotes, CRLF, accidental line breaks in pasted keys).
 */
export function normalizeVapidKey(value) {
  if (value === "" || value == null) return undefined;
  let s = String(value).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  const out = s.replace(/\s+/g, "");
  return out || undefined;
}
