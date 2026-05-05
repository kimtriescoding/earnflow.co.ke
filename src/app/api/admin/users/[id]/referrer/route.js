import connectDB from "@/lib/db";
import User from "@/models/User";
import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth/guards";
import { ok, fail } from "@/lib/api";
import { INTERNAL_ONLY_ROLES, isSuperadminRole } from "@/lib/auth/roles";
import { adminAssignDirectReferrer } from "@/lib/referrals/engine";

function isLikelyObjectIdString(value) {
  if (value.length !== 24) return false;
  if (!/^[a-f0-9]+$/i.test(value)) return false;
  return mongoose.Types.ObjectId.isValid(value);
}

async function resolveReferrerUserId(identifier) {
  const raw = String(identifier || "").trim();
  if (!raw) return null;
  if (isLikelyObjectIdString(raw)) {
    const u = await User.findById(raw).select("_id").lean();
    if (u) return u._id;
  }
  const u = await User.findOne({ username: raw.toLowerCase() }).select("_id").lean();
  return u?._id || null;
}

/**
 * Assign direct referrer only when the user has none yet; L2/L3 follow signup rules.
 * Optional `distributeCommission` runs idempotent signup bonus payouts for activated accounts.
 */
export async function POST(request, { params }) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;
  await connectDB();
  const { id: subjectId } = await params;
  const body = await request.json().catch(() => null);
  if (!body || !String(body.referrer || "").trim()) return fail("referrer is required (username or user id)", 400);

  if (!isSuperadminRole(auth.payload.role)) {
    const existing = await User.findById(subjectId).select("role").lean();
    if (!existing || INTERNAL_ONLY_ROLES.includes(String(existing.role || ""))) return fail("User not found", 404);
  }

  const referrerUserId = await resolveReferrerUserId(body.referrer);
  if (!referrerUserId) return fail("Referrer user not found", 404);

  const distributeCommission = Boolean(body.distributeCommission);

  const result = await adminAssignDirectReferrer(subjectId, referrerUserId, { distributeCommission });
  if (!result.ok) {
    const msg =
      result.error === "referrer_not_found"
        ? "Referrer not found"
        : result.error === "self_referral"
          ? "User cannot refer themselves"
          : result.error === "referrer_cycle"
            ? "That assignment would create a referral cycle"
            : result.error === "commission_requires_activation"
              ? "Commission distribution requires an activated account"
              : result.error === "already_has_direct_referrer"
                ? "This user already has a direct referrer"
                : result.error === "invalid_id"
                ? "Invalid user id"
                : result.error === "subject_not_found"
                  ? "User not found"
                  : "Assignment failed";
    const status = result.error === "subject_not_found" || result.error === "referrer_not_found" ? 404 : 400;
    return fail(msg, status);
  }

  return ok({
    data: {
      hierarchy: {
        referredByUserId: String(result.hierarchy.referredByUserId || ""),
        uplineL1UserId: String(result.hierarchy.uplineL1UserId || ""),
        uplineL2UserId: result.hierarchy.uplineL2UserId ? String(result.hierarchy.uplineL2UserId) : null,
        uplineL3UserId: result.hierarchy.uplineL3UserId ? String(result.hierarchy.uplineL3UserId) : null,
      },
      commission: result.commission,
    },
    message: distributeCommission
      ? "Referrer assigned and signup commissions reconciled where eligible."
      : "Referrer assigned; L2 and L3 uplines updated from the new direct referrer.",
  });
}
