import connectDB from "@/lib/db";
import User from "@/models/User";
import mongoose from "mongoose";
import { grantReferralSignupBonuses, reconcileReferralSignupBonusesForBeneficiary } from "@/lib/referrals/engine";
import { requireAuth } from "@/lib/auth/guards";
import { ok, fail } from "@/lib/api";

function isLikelyObjectIdString(value) {
  if (value.length !== 24) return false;
  if (!/^[a-f0-9]+$/i.test(value)) return false;
  return mongoose.Types.ObjectId.isValid(value);
}

function uniqueUplineBeneficiaryIds(userDoc) {
  const keys = ["referredByUserId", "uplineL1UserId", "uplineL2UserId", "uplineL3UserId"];
  const out = new Set();
  for (const k of keys) {
    const v = userDoc?.[k];
    if (v) out.add(String(v));
  }
  return [...out];
}

/**
 * Re-applies referral signup bonuses for an activated user (per-level idempotency), then reconciles
 * each upline in their chain so related accounts pick up any missing lines without double credits.
 */
export async function POST(request) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;
  await connectDB();
  const body = await request.json().catch(() => ({}));
  const identifier = String(body.identifier || body.userId || "").trim();
  if (!identifier) return fail("identifier or userId is required", 400);
  let user = null;
  if (isLikelyObjectIdString(identifier)) {
    user = await User.findById(identifier);
  }
  if (!user) {
    user = await User.findOne({ username: identifier.toLowerCase() });
  }
  if (!user) return fail("User not found", 404);
  if (!user.isActivated) return fail("User must be activated", 400);
  await grantReferralSignupBonuses(user, {
    verifiedActivation: true,
    activationPaymentId: `admin_sync:${String(user._id)}:${Date.now()}`,
  });
  const uplineIds = uniqueUplineBeneficiaryIds(user);
  const reconciles = [];
  let reconciledAccounts = 0;
  for (const bid of uplineIds) {
    const r = await reconcileReferralSignupBonusesForBeneficiary(bid);
    reconciles.push({ beneficiaryUserId: bid, processed: r.processed });
    reconciledAccounts += Number(r.processed || 0);
  }
  return ok({
    data: {
      mode: "activated_user",
      userId: String(user._id),
      username: user.username || "",
      uplineReconciles: reconciles,
      reconciledAccounts,
    },
    message:
      uplineIds.length === 0
        ? "Missing signup bonuses applied for this account (no upline to reconcile)."
        : `Missing signup bonuses applied; re-checked ${uplineIds.length} upline(s), ${reconciledAccounts} account(s) touched.`,
  });
}
