import connectDB from "@/lib/db";
import User from "@/models/User";
import { ok, fail, guardRateLimit } from "@/lib/api";
import { getCache, setCache } from "@/lib/cache/config-cache";

function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isValidUsername(username) {
  return /^[a-z0-9_]{3,20}$/.test(username);
}

function normalizeBaseForSuggestions(value) {
  const cleaned = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
  if (!cleaned) return "user";
  return cleaned.slice(0, 16);
}

async function buildSuggestions(rawInput) {
  const base = normalizeBaseForSuggestions(rawInput);
  const candidates = [];
  for (let i = 1; i <= 40; i += 1) {
    const suffix = String(i).padStart(2, "0");
    const candidate = `${base}${suffix}`.slice(0, 20);
    if (isValidUsername(candidate)) candidates.push(candidate);
  }
  if (!candidates.length) return [];
  const used = await User.find({ username: { $in: candidates } }).select("username").lean();
  const usedSet = new Set(used.map((u) => String(u.username || "").toLowerCase()));
  return candidates.filter((name) => !usedSet.has(name)).slice(0, 6);
}

export async function GET(request) {
  const limited = guardRateLimit(request, "auth.check_username", 60, 60_000);
  if (limited) return limited;
  const { searchParams } = new URL(request.url);
  const username = normalizeUsername(searchParams.get("username"));
  if (!username) return fail("username is required");
  const cacheKey = `username:availability:${username}`;
  const cached = getCache(cacheKey);
  if (cached) {
    return ok(cached);
  }

  if (!isValidUsername(username)) {
    await connectDB();
    const suggestions = await buildSuggestions(username);
    const payload = {
      available: false,
      reason: "Username must be 3-20 chars and use only letters, numbers, or underscore.",
      suggestions,
    };
    setCache(cacheKey, payload, 10_000);
    return ok(payload);
  }

  await connectDB();
  const exists = await User.findOne({ username }).select("_id").lean();
  const suggestions = exists ? await buildSuggestions(username) : [];
  const payload = {
    available: !exists,
    reason: exists ? "Username is already taken." : "Username is available.",
    suggestions,
  };
  // Short-lived cache to absorb burst traffic from repeated checks.
  setCache(cacheKey, payload, 10_000);
  return ok(payload);
}
