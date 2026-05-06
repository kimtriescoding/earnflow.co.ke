import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getRequestIp, isIpBlockedInMemory } from "@/lib/fraud/guards";
import { ROLE } from "@/lib/auth/roles";

const protectedUserRoutes = ["/dashboard", "/profile", "/activate"];
const protectedAdminRoutes = ["/admin"];
const protectedClientRoutes = ["/client"];
const JWT_ACCESS_SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET || "");

async function verifyToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_ACCESS_SECRET);
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(request) {
  const start = performance.now();
  const withTiming = (response) => {
    const dur = Math.max(0, performance.now() - start).toFixed(1);
    response.headers.set("Server-Timing", `middleware;dur=${dur}`);
    return response;
  };
  const { pathname } = request.nextUrl;
  if (pathname === "/") {
    const url = new URL("/signup", request.url);
    const res = NextResponse.redirect(url, 302);
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return withTiming(res);
  }
  const ip = getRequestIp(request.headers);
  if (ip && ip !== "unknown" && isIpBlockedInMemory(ip)) {
    return withTiming(NextResponse.json({ success: false, message: "Access denied" }, { status: 403 }));
  }
  const accessToken = request.cookies.get("tw_access")?.value;
  const payload = await verifyToken(accessToken);

  const onUserProtected = protectedUserRoutes.some((route) => pathname.startsWith(route));
  if (onUserProtected && !payload) {
    return withTiming(NextResponse.redirect(new URL("/login", request.url)));
  }

  const onAdminProtected = protectedAdminRoutes.some((route) => pathname.startsWith(route));
  const isAdminRole = payload?.role === ROLE.ADMIN || payload?.role === ROLE.SUPERADMIN;
  if (onAdminProtected && (!isAdminRole || !payload?.mfa_verified)) {
    if (payload?.role === "client") return withTiming(NextResponse.redirect(new URL("/client", request.url)));
    if (isAdminRole && !payload?.mfa_verified) return withTiming(NextResponse.redirect(new URL("/login?mfa=required", request.url)));
    return withTiming(NextResponse.redirect(new URL("/dashboard", request.url)));
  }

  const onClientProtected = protectedClientRoutes.some((route) => pathname.startsWith(route));
  if (onClientProtected && payload?.role !== "client") {
    if ([ROLE.ADMIN, ROLE.SUPPORT, ROLE.SUPERADMIN].includes(String(payload?.role || ""))) {
      return withTiming(NextResponse.redirect(new URL("/admin", request.url)));
    }
    return withTiming(NextResponse.redirect(new URL("/dashboard", request.url)));
  }

  return withTiming(NextResponse.next());
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/profile/:path*", "/admin/:path*", "/client/:path*", "/activate"],
};
