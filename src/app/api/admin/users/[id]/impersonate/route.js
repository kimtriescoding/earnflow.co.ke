import User from "@/models/User";
import connectDB from "@/lib/db";
import { requireAuth } from "@/lib/auth/guards";
import { issueAuthSession } from "@/lib/auth/session";
import { ok, fail } from "@/lib/api";
import { getEnv } from "@/lib/env";

export async function POST(request, { params }) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;
  const reauthWindowSec = getEnv().ADMIN_MFA_REAUTH_WINDOW_SEC;
  const iatSec = Number(auth.payload.iat || 0);
  if (!iatSec || Date.now() - iatSec * 1000 > reauthWindowSec * 1000) {
    return fail("Recent MFA re-auth required for impersonation", 403);
  }
  await connectDB();
  const { id: userId } = await params;
  const target = await User.findById(userId);
  if (!target) return fail("User not found", 404);
  await issueAuthSession({
    sub: target._id.toString(),
    role: target.role,
    username: target.username,
    mfa_verified: true,
    impersonatedBy: auth.payload.sub,
  });
  return ok({ message: "Impersonation started" });
}
