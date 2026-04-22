import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authCookieNames, verifyRefreshToken } from "@/lib/auth/jwt";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { rotateRefreshSession } from "@/lib/auth/session";
import { guardBlockedIp } from "@/lib/api";
import { isElevatedRole } from "@/lib/auth/roles";

export async function POST(request) {
  const blocked = await guardBlockedIp(request);
  if (blocked) return blocked;
  const store = await cookies();
  const token = store.get(authCookieNames.REFRESH_COOKIE)?.value;
  if (!token) return NextResponse.json({ success: false, message: "Missing refresh token" }, { status: 401 });
  try {
    const payload = await verifyRefreshToken(token);
    await connectDB();
    const user = await User.findById(payload.sub).select("_id role username isBlocked isActivated mfaEnabled").lean();
    if (!user || user.isBlocked) {
      return NextResponse.json({ success: false, message: "Invalid refresh token" }, { status: 401 });
    }
    const rotated = await rotateRefreshSession({
      currentJti: payload.jti,
      payload: {
        sub: user._id.toString(),
        role: user.role,
        username: user.username,
        isActivated: Boolean(user.isActivated),
        mfa_verified: isElevatedRole(user.role) ? Boolean(payload.mfa_verified && user.mfaEnabled) : true,
        mfa_setup_verified: isElevatedRole(user.role) ? Boolean(!user.mfaEnabled && payload.mfa_setup_verified) : false,
      },
      metadata: { source: "refresh" },
    });
    if (!rotated.ok) {
      return NextResponse.json({ success: false, message: "Invalid refresh token" }, { status: 401 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, message: "Invalid refresh token" }, { status: 401 });
  }
}
