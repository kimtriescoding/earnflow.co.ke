const cache = new Map();

export function setCache(key, value, ttlMs = 30_000) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function getCache(key) {
  const record = cache.get(key);
  if (!record) return undefined;
  if (record.expiresAt < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return record.value;
}

export function deleteCache(key) {
  cache.delete(key);
}
