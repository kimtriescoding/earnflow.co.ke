const memoryHits = new Map();
const memoryIpBlocks = new Set();
/** IPs verified not blocked recently — avoids a DB round-trip on every auth request. */
const memoryIpClear = new Map();
const IP_CLEAR_TTL_MS = 5 * 60_000;

function now() {
  return Date.now();
}

export function getClientFingerprint(headers) {
  const forwarded = headers.get("x-forwarded-for") || "unknown";
  const agent = headers.get("user-agent") || "unknown";
  return `${forwarded.slice(0, 80)}:${agent.slice(0, 80)}`;
}

export function enforceRateLimit({ key, limit = 25, windowMs = 60_000 }) {
  const entry = memoryHits.get(key) ?? { count: 0, resetAt: now() + windowMs };
  if (entry.resetAt < now()) {
    entry.count = 0;
    entry.resetAt = now() + windowMs;
  }
  entry.count += 1;
  memoryHits.set(key, entry);
  if (entry.count > limit) return { allowed: false, retryInMs: entry.resetAt - now() };
  return { allowed: true, retryInMs: 0 };
}

export function normalizeIp(raw) {
  return String(raw || "")
    .split(",")[0]
    .trim()
    .slice(0, 64);
}

export function getRequestIp(headers) {
  return normalizeIp(headers.get("x-forwarded-for") || headers.get("x-real-ip") || "unknown");
}

export function isIpBlockedInMemory(ip) {
  return memoryIpBlocks.has(ip);
}

export function setIpBlockedInMemory(ip) {
  if (!ip || ip === "unknown") return;
  memoryIpBlocks.add(ip);
  memoryIpClear.delete(ip);
}

export function isIpRecentlyCleared(ip) {
  if (!ip || ip === "unknown") return false;
  const expiresAt = memoryIpClear.get(ip);
  if (!expiresAt) return false;
  if (expiresAt < now()) {
    memoryIpClear.delete(ip);
    return false;
  }
  return true;
}

export function markIpRecentlyCleared(ip) {
  if (!ip || ip === "unknown") return;
  memoryIpClear.set(ip, now() + IP_CLEAR_TTL_MS);
}
