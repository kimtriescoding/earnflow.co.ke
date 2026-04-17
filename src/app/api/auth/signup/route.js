import connectDB from "@/lib/db";
import User from "@/models/User";
import Wallet from "@/models/Wallet";
import { hashPassword } from "@/lib/auth/password";
import { issueAuthSession } from "@/lib/auth/session";
import { resolveReferralHierarchy } from "@/lib/referrals/engine";
import { ok, fail, guardRateLimit, guardBlockedIp } from "@/lib/api";

export async function POST(request) {
  const blocked = await guardBlockedIp(request);
  if (blocked) return blocked;
  const limited = guardRateLimit(request, "auth.signup", 10, 60_000);
  if (limited) return limited;
  await connectDB();
  const body = await request.json().catch(() => null);
  if (!body) return fail("Invalid payload");
  const username = String(body.username || "").trim().toLowerCase();
  const email = String(body.email || "").trim().toLowerCase();
  const phoneNumber = String(body.phoneNumber || "").trim();
  const password = String(body.password || "");
  if (!username || !email || password.length < 6) return fail("username, email and password are required");
  const exists = await User.findOne({ $or: [{ username }, { email }] }).lean();
  if (exists) return fail("Username or email already taken", 409);
  const hierarchy = await resolveReferralHierarchy(String(body.referralCode || "").trim().toLowerCase());
  const user = await User.create({
    username,
    referralCode: username,
    email,
    phoneNumber,
    passwordHash: await hashPassword(password),
    ...hierarchy,
  });
  await Wallet.create({ userId: user._id });
  await issueAuthSession({
    sub: user._id.toString(),
    role: user.role,
    username: user.username,
    isActivated: Boolean(user.isActivated),
    mfa_verified: true,
  });
  return ok({ message: "Account created and logged in", role: user.role, isActivated: Boolean(user.isActivated) }, 201);
}
