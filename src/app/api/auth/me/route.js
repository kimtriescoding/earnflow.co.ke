import User from "@/models/User";
import { requireAuth } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/api";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import connectDB from "@/lib/db";
import { getCachedSessionUserProfile } from "@/lib/auth/session-state";

export async function GET(request) {
  const start = performance.now();
  const auth = await requireAuth(["user", "client", "admin", "support"]);
  if (auth.error) return auth.error;
  const { searchParams } = new URL(request.url);
  const lite = searchParams.get("lite") === "1";
  const user = await getCachedSessionUserProfile(auth.payload.sub);

  let referredBy = null;
  if (!lite && user?.referredByUserId) {
    await connectDB();
    const upline = await User.findById(user.referredByUserId).select("username referralCode").lean();
    referredBy = upline
      ? { id: String(upline._id), username: String(upline.username), referralCode: String(upline.referralCode || "") }
      : null;
  }

  const isBlocked = Boolean(user?.isBlocked);
  const isActivated = Boolean(user?.isActivated);

  const response = ok({
    data: {
      id: auth.payload.sub,
      username: user?.username || auth.payload.username || "user",
      email: user?.email || "",
      role: user?.role || auth.payload.role || "user",
      phoneNumber: user?.phoneNumber || "",
      referralCode: user?.referralCode || "",
      referredBy,
      isActivated,
      isBlocked,
      accountStatus: isBlocked ? "blocked" : isActivated ? "active" : "pending_activation",
      impersonatedBy: auth.payload.impersonatedBy || null,
      mfaEnabled: Boolean(user?.mfaEnabled),
      mfaVerified: Boolean(auth.payload.mfa_verified),
    },
  });
  response.headers.set("Server-Timing", `api_auth_me;dur=${(performance.now() - start).toFixed(1)}`);
  return response;
}

export async function PATCH(request) {
  const auth = await requireAuth(["user", "client", "admin", "support"]);
  if (auth.error) return auth.error;
  await connectDB();
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "").trim().toLowerCase();

  const user = await User.findById(auth.payload.sub);
  if (!user) return fail("User not found", 404);

  if (action === "change_email") {
    const email = String(body.email || "").trim().toLowerCase();
    const currentPassword = String(body.currentPassword || "");
    if (!email.includes("@")) return fail("Valid email is required");
    if (!currentPassword) return fail("Current password is required");
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) return fail("Current password is incorrect", 401);
    const exists = await User.findOne({ email, _id: { $ne: user._id } }).lean();
    if (exists) return fail("Email already in use", 409);
    user.email = email;
    await user.save();
    return ok({ message: "Email updated" });
  }

  if (action === "change_password") {
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");
    if (newPassword.length < 6) return fail("New password must be at least 6 characters");
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) return fail("Current password is incorrect", 401);
    user.passwordHash = await hashPassword(newPassword);
    await user.save();
    return ok({ message: "Password updated" });
  }

  return fail("Unsupported profile action", 400);
}
