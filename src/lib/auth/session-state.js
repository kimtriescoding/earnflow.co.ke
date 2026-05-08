import connectDB from "@/lib/db";
import User from "@/models/User";
import { createTtlCache } from "@/lib/cache/ttl-cache";

const USER_STATE_CACHE = createTtlCache("session-user-state", 60_000);
const USER_PROFILE_CACHE = createTtlCache("session-user-profile", 60_000);

export function invalidateSessionUserCaches(userId) {
  const key = String(userId || "");
  if (!key) return;
  USER_STATE_CACHE.delete(key);
  USER_PROFILE_CACHE.delete(key);
}

export async function getCachedSessionUserState(userId) {
  const key = String(userId || "");
  if (!key) return null;
  const cached = USER_STATE_CACHE.get(key);
  if (cached) return cached;

  await connectDB();
  const user = await User.findById(key).select("role isActivated isBlocked").lean();
  USER_STATE_CACHE.set(key, user || null);
  return user || null;
}

export async function getCachedSessionUserProfile(userId) {
  const key = String(userId || "");
  if (!key) return null;
  const cached = USER_PROFILE_CACHE.get(key);
  if (cached) return cached;

  await connectDB();
  const user = await User.findById(key)
    .select("username email role phoneNumber referralCode referredByUserId isActivated isBlocked mfaEnabled")
    .lean();
  USER_PROFILE_CACHE.set(key, user || null);
  return user || null;
}
