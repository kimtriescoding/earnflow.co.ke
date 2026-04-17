import connectDB from "@/lib/db";
import User from "@/models/User";
import { fail, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth/guards";
import { issueAuthSession } from "@/lib/auth/session";

export async function POST() {
  const auth = await requireAuth(["user", "client", "admin", "support"]);
  if (auth.error) return auth.error;

  const adminId = String(auth.payload?.impersonatedBy || "").trim();
  if (!adminId) return fail("No active impersonation session", 400);

  await connectDB();
  const adminUser = await User.findById(adminId).select("_id role username isBlocked").lean();
  if (!adminUser) return fail("Impersonating admin account no longer exists", 404);
  if (adminUser.isBlocked) return fail("Impersonating admin account is blocked", 403);
  if (!["admin", "support"].includes(adminUser.role)) return fail("Impersonating account has no elevated access", 403);

  await issueAuthSession({
    sub: adminUser._id.toString(),
    role: adminUser.role,
    username: adminUser.username,
    mfa_verified: true,
  });

  return ok({ message: "Impersonation ended" });
}
