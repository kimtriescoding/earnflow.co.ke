import connectDB from "@/lib/db";
import User from "@/models/User";
import { requireAuth } from "@/lib/auth/guards";
import { ok } from "@/lib/api";
import { loadReferralCommissionRules } from "@/lib/referrals/commission-config";

export async function GET() {
  const auth = await requireAuth(["user"]);
  if (auth.error) return auth.error;
  await connectDB();
  const rules = await loadReferralCommissionRules();
  const levels = {
    level1Enabled: Boolean(rules?.level1?.enabled),
    level2Enabled: Boolean(rules?.level2?.enabled),
  };

  const levelOneUsers = await User.find({ referredByUserId: auth.payload.sub })
    .select("_id username email phoneNumber isActivated isBlocked createdAt")
    .sort({ createdAt: -1 })
    .lean();

  const levelOneIds = levelOneUsers.map((user) => user._id);
  const levelTwoUsers = levelOneIds.length
    ? await User.find({ referredByUserId: { $in: levelOneIds } })
        .select("_id username email phoneNumber isActivated isBlocked createdAt")
        .sort({ createdAt: -1 })
        .lean()
    : [];

  const normalize = (users = []) =>
    users.map((user) => ({
      id: String(user._id),
      username: user.username || "",
      email: user.email || "",
      phoneNumber: user.phoneNumber || "",
      accountStatus: Boolean(user.isBlocked) ? "blocked" : Boolean(user.isActivated) ? "active" : "pending_activation",
      createdAt: user.createdAt || null,
    }));

  const summarizeStatus = (users = []) =>
    users.reduce(
      (acc, user) => {
        if (user.accountStatus === "active") acc.active += 1;
        else acc.inactive += 1;
        return acc;
      },
      { active: 0, inactive: 0 }
    );

  const level1 = normalize(levelOneUsers);
  const level2 = normalize(levelTwoUsers);
  const level1Status = summarizeStatus(level1);
  const level2Status = summarizeStatus(level2);

  return ok({
    data: {
      level1,
      level2,
      counts: {
        level1: level1.length,
        level2: level2.length,
        level1Active: level1Status.active,
        level1Inactive: level1Status.inactive,
        level2Active: level2Status.active,
        level2Inactive: level2Status.inactive,
      },
      levels,
    },
  });
}
