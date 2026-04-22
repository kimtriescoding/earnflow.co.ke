import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getRequestIp, isIpBlockedInMemory } from "@/lib/fraud/guards";
import { ROLE } from "@/lib/auth/roles";

const protectedUserRoutes = ["/dashboard", "/profile", "/activate"];
const protectedAdminRoutes = ["/admin"];
const protectedClientRoutes = ["/client"];

async function verifyToken(token) {
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET || "");
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  if (pathname === "/") {
    const url = new URL("/signup", request.url);
    const res = NextResponse.redirect(url, 302);
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  }
  const ip = getRequestIp(request.headers);
  if (ip && ip !== "unknown" && isIpBlockedInMemory(ip)) {
    return NextResponse.json({ success: false, message: "Access denied" }, { status: 403 });
  }
  const accessToken = request.cookies.get("tw_access")?.value;
  const payload = await verifyToken(accessToken);

  const onUserProtected = protectedUserRoutes.some((route) => pathname.startsWith(route));
  if (onUserProtected && !payload) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const onAdminProtected = protectedAdminRoutes.some((route) => pathname.startsWith(route));
  const isAdminRole = payload?.role === ROLE.ADMIN || payload?.role === ROLE.SUPERADMIN;
  if (onAdminProtected && (!isAdminRole || !payload?.mfa_verified)) {
    if (payload?.role === "client") return NextResponse.redirect(new URL("/client", request.url));
    if (isAdminRole && !payload?.mfa_verified) return NextResponse.redirect(new URL("/login?mfa=required", request.url));
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const onClientProtected = protectedClientRoutes.some((route) => pathname.startsWith(route));
  if (onClientProtected && payload?.role !== "client") {
    if ([ROLE.ADMIN, ROLE.SUPPORT, ROLE.SUPERADMIN].includes(String(payload?.role || ""))) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/profile/:path*", "/admin/:path*", "/client/:path*", "/activate"],
};
