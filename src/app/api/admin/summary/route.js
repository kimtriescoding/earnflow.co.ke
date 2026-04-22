import connectDB from "@/lib/db";
import User from "@/models/User";
import Withdrawal from "@/models/Withdrawal";
import Wallet from "@/models/Wallet";
import ActivationPayment from "@/models/ActivationPayment";
import ReferralCommission from "@/models/ReferralCommission";
import { requireAuth } from "@/lib/auth/guards";
import { ok } from "@/lib/api";
import { DASHBOARD_EARNINGS_TIMEZONE } from "@/lib/config/dashboard-timezone";
import { MATCH_METADATA_REAL_FOR_REVENUE } from "@/lib/payments/transaction-real";

const TZ = DASHBOARD_EARNINGS_TIMEZONE;

/** Match documents whose calendar day in TZ equals today's calendar day in TZ. */
function sameCalendarDay(fieldPath) {
  return {
    $match: {
      $expr: {
        $eq: [
          { $dateTrunc: { date: fieldPath, unit: "day", timezone: TZ } },
          { $dateTrunc: { date: "$$NOW", unit: "day", timezone: TZ } },
        ],
      },
    },
  };
}

export async function GET() {
  const auth = await requireAuth(["admin", "support"]);
  if (auth.error) return auth.error;
  await connectDB();

  const [
    totalUsers,
    totalActiveUsers,
    totalInactiveUsers,
    activatedTodayDistinct,
    activationPaymentsTodayAgg,
    commissionsPaidTodayAgg,
    totalCommissionsPaidAgg,
    walletAgg,
    pendingWithdrawals,
    completedWithdrawals,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ isActivated: true, isBlocked: false }),
    User.countDocuments({ $or: [{ isActivated: false }, { isBlocked: true }] }),
    ActivationPayment.aggregate([
      { $match: { status: "success", ...MATCH_METADATA_REAL_FOR_REVENUE } },
      sameCalendarDay("$updatedAt"),
      { $group: { _id: "$userId" } },
      { $count: "n" },
    ]),
    ActivationPayment.aggregate([
      { $match: { status: "success", ...MATCH_METADATA_REAL_FOR_REVENUE } },
      sameCalendarDay("$updatedAt"),
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    ReferralCommission.aggregate([
      sameCalendarDay("$createdAt"),
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    ReferralCommission.aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }]),
    Wallet.aggregate([
      {
        $group: {
          _id: null,
          totalWithdrawable: { $sum: "$availableBalance" },
        },
      },
    ]),
    Withdrawal.countDocuments({ status: "pending" }),
    Withdrawal.countDocuments({ status: "completed" }),
  ]);

  const activatedToday = Number(activatedTodayDistinct[0]?.n || 0);
  const activationPaymentsToday = Number(activationPaymentsTodayAgg[0]?.total || 0);
  const commissionsPaidToday = Number(commissionsPaidTodayAgg[0]?.total || 0);
  const totalCommissionsPaid = Number(totalCommissionsPaidAgg[0]?.total || 0);
  const totalWithdrawable = Number(Number(walletAgg[0]?.totalWithdrawable || 0).toFixed(2));
  const earningsToday = Number((activationPaymentsToday - commissionsPaidToday).toFixed(2));

  return ok({
    data: {
      totalUsers,
      totalActiveUsers,
      totalInactiveUsers,
      activatedToday,
      activationPaymentsToday: Number(activationPaymentsToday.toFixed(2)),
      commissionsPaidToday: Number(commissionsPaidToday.toFixed(2)),
      totalCommissionsPaid: Number(totalCommissionsPaid.toFixed(2)),
      earningsToday,
      totalWithdrawable,
      pendingWithdrawals,
      completedWithdrawals,
      /** IANA zone used for all “today” boundaries above. */
      statsTimeZone: TZ,
    },
  });
}
