import mongoose from "mongoose";
import EarningEvent from "@/models/EarningEvent";
import ReferralCommission from "@/models/ReferralCommission";
import { DASHBOARD_EARNINGS_TIMEZONE } from "@/lib/config/dashboard-timezone";

export { DASHBOARD_EARNINGS_TIMEZONE };

/**
 * Sum of wallet credits from approved earning events and referral commissions
 * whose credit timestamp falls on the current calendar day in DASHBOARD_EARNINGS_TIMEZONE.
 *
 * Events: credit time is approvedAt when set (admin approval), else createdAt (auto-approved).
 * Commissions: createdAt (credited immediately).
 */
export async function sumTodaysEarningsForUser(userId, { timeZone = DASHBOARD_EARNINGS_TIMEZONE } = {}) {
  const oid = typeof userId === "string" ? new mongoose.Types.ObjectId(userId) : userId;

  const [earningRows, commissionRows] = await Promise.all([
    EarningEvent.aggregate([
      { $match: { userId: oid, status: "approved", amount: { $gt: 0 } } },
      {
        $match: {
          $expr: {
            $eq: [
              { $dateTrunc: { date: { $ifNull: ["$approvedAt", "$createdAt"] }, unit: "day", timezone: timeZone } },
              { $dateTrunc: { date: "$$NOW", unit: "day", timezone: timeZone } },
            ],
          },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    ReferralCommission.aggregate([
      { $match: { beneficiaryUserId: oid } },
      {
        $match: {
          $expr: {
            $eq: [
              { $dateTrunc: { date: "$createdAt", unit: "day", timezone: timeZone } },
              { $dateTrunc: { date: "$$NOW", unit: "day", timezone: timeZone } },
            ],
          },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);

  const fromEvents = Number(earningRows[0]?.total || 0);
  const fromCommissions = Number(commissionRows[0]?.total || 0);
  return Number((fromEvents + fromCommissions).toFixed(2));
}
