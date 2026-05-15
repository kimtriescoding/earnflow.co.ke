const stores = new Map();

function getStore(namespace) {
  if (!stores.has(namespace)) stores.set(namespace, new Map());
  return stores.get(namespace);
}

export function createTtlCache(namespace, ttlMs) {
  const store = getStore(namespace);
  return {
    get(key) {
      const row = store.get(key);
      if (!row) return null;
      if (Date.now() > row.expiresAt) {
        store.delete(key);
        return null;
      }
      return row.value;
    },
    set(key, value) {
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    },
    delete(key) {
      store.delete(key);
    },
    deleteByPrefix(prefix) {
      const p = String(prefix || "");
      if (!p) return;
      for (const key of store.keys()) {
        if (String(key).startsWith(p)) store.delete(key);
      }
    },
    clear() {
      store.clear();
    },
  };
}
