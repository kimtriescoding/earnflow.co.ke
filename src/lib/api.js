import { NextResponse } from "next/server";
import { getClientFingerprint, enforceRateLimit, getRequestIp, isIpBlockedInMemory, setIpBlockedInMemory } from "./fraud/guards";
import connectDB from "./db";
import BlockedIp from "@/models/BlockedIp";
import { logError } from "./observability/logger";

export function ok(data = {}, status = 200) {
  return NextResponse.json({ success: true, ...data }, { status });
}

export function fail(message, status = 400, extra = {}) {
  return NextResponse.json({ success: false, message, ...extra }, { status });
}

export function guardRateLimit(request, scope, limit = 40, windowMs = 60_000) {
  const fp = getClientFingerprint(request.headers);
  const rate = enforceRateLimit({ key: `${scope}:${fp}`, limit, windowMs });
  if (!rate.allowed) {
    return fail("Too many requests", 429, { retryInMs: rate.retryInMs });
  }
  return null;
}

export async function guardBlockedIp(request) {
  const ip = getRequestIp(request.headers);
  if (!ip || ip === "unknown") return null;
  if (isIpBlockedInMemory(ip)) return fail("Access denied", 403);
  try {
    await connectDB();
    const blocked = await BlockedIp.findOne({ ip, active: true }).select("_id").lean();
    if (!blocked) return null;
    setIpBlockedInMemory(ip);
    return fail("Access denied", 403);
  } catch {
    return null;
  }
}

export async function blockIpNow({ request, reason, evidence = {}, ipOverride = "" }) {
  const ip = String(ipOverride || getRequestIp(request.headers || new Headers())).split(",")[0].trim();
  if (!ip || ip === "unknown") return { blocked: false, ip };
  try {
    await connectDB();
    await BlockedIp.findOneAndUpdate(
      { ip },
      { ip, reason, evidence, active: true, blockedAt: new Date(), blockedBy: "system" },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    setIpBlockedInMemory(ip);
    return { blocked: true, ip };
  } catch (err) {
    logError("security.ip_block_failed", { ip, reason, error: err?.message || "unknown" });
    return { blocked: false, ip };
  }
}
