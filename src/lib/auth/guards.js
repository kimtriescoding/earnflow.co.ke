import { NextResponse } from "next/server";
import { readAccessPayloadFromCookies } from "./jwt";

export async function requireAuth(allowedRoles = [], options = {}) {
  const requireMfa = options.requireMfa !== false;
  const payload = await readAccessPayloadFromCookies();
  if (!payload) {
    return { error: NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 }) };
  }
  if (allowedRoles.length && !allowedRoles.includes(payload.role)) {
    return { error: NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 }) };
  }
  if (requireMfa && ["admin", "support"].includes(String(payload.role || "")) && !payload.mfa_verified) {
    return { error: NextResponse.json({ success: false, message: "MFA required" }, { status: 403, headers: { "x-mfa-required": "1" } }) };
  }
  return { payload };
}
