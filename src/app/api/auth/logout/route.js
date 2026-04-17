import { clearAuthCookies, readAccessPayloadFromCookies } from "@/lib/auth/jwt";
import { ok } from "@/lib/api";
import connectDB from "@/lib/db";
import RefreshSession from "@/models/RefreshSession";

export async function POST() {
  const payload = await readAccessPayloadFromCookies();
  if (payload?.jti) {
    await connectDB();
    await RefreshSession.findOneAndUpdate({ jti: payload.jti, revokedAt: null }, { revokedAt: new Date() });
  }
  await clearAuthCookies();
  return ok({ message: "Logged out" });
}
