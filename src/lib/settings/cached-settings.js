import connectDB from "@/lib/db";
import { getSetting } from "@/models/Settings";
import { createTtlCache } from "@/lib/cache/ttl-cache";

const SETTINGS_CACHE = createTtlCache("settings", 30_000);

export async function getCachedSetting(key, fallbackValue) {
  const cacheKey = `${key}`;
  const cached = SETTINGS_CACHE.get(cacheKey);
  if (cached !== null) return cached;

  await connectDB();
  const value = await getSetting(key, fallbackValue);
  SETTINGS_CACHE.set(cacheKey, value);
  return value;
}
