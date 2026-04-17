import connectDB from "@/lib/db";
import User from "@/models/User";
import { requireAuth } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/api";
import { hashBackupCode, verifyTotp } from "@/lib/auth/totp";

export async function POST(request) {
  const auth = await requireAuth(["admin", "support"]);
  if (auth.error) return auth.error;
  await connectDB();
  const body = await request.json().catch(() => ({}));
  const token = String(body.token || "").trim();
  const user = await User.findById(auth.payload.sub);
  if (!user) return fail("User not found", 404);
  if (!user.mfaEnabled || !user.mfaSecret) return fail("MFA not enabled", 400);
  const byTotp = verifyTotp({ secret: user.mfaSecret, token });
  const byBackup = user.mfaBackupCodeHashes.includes(hashBackupCode(token));
  if (!byTotp && !byBackup) return fail("Invalid MFA code", 401);
  user.mfaEnabled = false;
  user.mfaSecret = "";
  user.mfaTempSecret = "";
  user.mfaBackupCodeHashes = [];
  await user.save();
  return ok({ message: "MFA disabled" });
}
