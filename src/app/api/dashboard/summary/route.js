import connectDB from "@/lib/db";
import Wallet from "@/models/Wallet";
import EarningEvent from "@/models/EarningEvent";
import User from "@/models/User";
import ReferralCommission from "@/models/ReferralCommission";
import Transaction from "@/models/Transaction";
import { requireAuth } from "@/lib/auth/guards";
import { ok } from "@/lib/api";
import { DASHBOARD_EARNINGS_TIMEZONE } from "@/lib/config/dashboard-timezone";
import { sumTodaysEarningsForUser } from "@/lib/dashboard/todays-earnings";
import mongoose from "mongoose";
import { getSetting } from "@/models/Settings";
import {
  EARNING_MODULE_BUCKET_ADD_FIELDS,
  earningEventAccessMatch,
  normalizeModuleAccess,
  stripDisabledModuleStats,
} from "@/lib/modules/module-access";
import { MATCH_TRANSACTION_REAL_FOR_REVENUE } from "@/lib/payments/transaction-real";

export async function GET() {
  const auth = await requireAuth(["user", "admin"]);
  if (auth.error) return auth.error;
  await connectDB();
  const moduleStatusRaw = await getSetting("module_status", {});
  const moduleAccess = normalizeModuleAccess(moduleStatusRaw);

  const userIdStr = String(auth.payload.sub);
  const userObjectId = new mongoose.Types.ObjectId(userIdStr);

  const linkedReferralLedgerIds = await ReferralCommission.distinct("ledgerTransactionId", {
    beneficiaryUserId: userObjectId,
    ledgerTransactionId: { $ne: null },
  });

  const earningAccessMatch = earningEventAccessMatch(moduleAccess);

  const [
    wallet,
    events,
    commissions,
    approvedBySourceAgg,
    pendingBySourceAgg,
    referralCommissionAgg,
    referralOrphanTxAgg,
    referralFromEarningEventsAgg,
    referrals,
    withdrawalsTx,
    user,
    todaysEarnings,
  ] = await Promise.all([
    Wallet.findOne({ userId: userIdStr }).lean(),
    EarningEvent.find({ userId: userIdStr, ...earningAccessMatch }).sort({ createdAt: -1 }).limit(30).lean(),
    ReferralCommission.find({ beneficiaryUserId: userIdStr }).sort({ createdAt: -1 }).limit(30).lean(),
    EarningEvent.aggregate([
      { $match: { userId: userObjectId, status: "approved", amount: { $gt: 0 }, ...earningAccessMatch } },
      EARNING_MODULE_BUCKET_ADD_FIELDS,
      { $group: { _id: "$earningsBucket", total: { $sum: "$amount" } } },
    ]),
    EarningEvent.aggregate([
      { $match: { userId: userObjectId, status: "pending", ...earningAccessMatch } },
      EARNING_MODULE_BUCKET_ADD_FIELDS,
      { $group: { _id: "$earningsBucket", count: { $sum: 1 } } },
    ]),
    ReferralCommission.aggregate([
      { $match: { beneficiaryUserId: userObjectId } },
      { $group: { _id: null, total: { $sum: { $ifNull: ["$amount", 0] } } } },
    ]),
    Transaction.aggregate([
      {
        $match: {
          userId: userObjectId,
          type: "referral_signup_bonus",
          status: "completed",
          amount: { $gt: 0 },
          ...MATCH_TRANSACTION_REAL_FOR_REVENUE,
          ...(linkedReferralLedgerIds.length ? { _id: { $nin: linkedReferralLedgerIds } } : {}),
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    EarningEvent.aggregate([
      {
        $match: {
          userId: userObjectId,
          status: "approved",
          amount: { $gt: 0 },
          source: { $regex: /^referral/i },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    User.countDocuments({ referredByUserId: userIdStr }),
    Transaction.find({ userId: userIdStr, type: "withdrawal", status: "completed", ...MATCH_TRANSACTION_REAL_FOR_REVENUE })
      .select("amount")
      .lean(),
    User.findById(userIdStr).select("referralCode username").lean(),
    sumTodaysEarningsForUser(userIdStr, { moduleAccess }),
  ]);

  const fromCommissions = Number(referralCommissionAgg?.[0]?.total || 0);
  const fromOrphanReferralTx = Number(referralOrphanTxAgg?.[0]?.total || 0);
  const fromReferralEarningEvents = Number(referralFromEarningEventsAgg?.[0]?.total || 0);
  const referralEarned = Number((fromCommissions + fromOrphanReferralTx + fromReferralEarningEvents).toFixed(2));

  const withdrawals = {
    totalAmount: Math.abs(withdrawalsTx.reduce((sum, tx) => sum + Number(tx.amount || 0), 0)),
    totalCount: withdrawalsTx.length,
  };
  const approvedBySource = approvedBySourceAgg.reduce((acc, row) => {
    const src = String(row._id || "other");
    acc[src] = Number(row.total || 0);
    return acc;
  }, {});
  const pendingBySource = pendingBySourceAgg.reduce((acc, row) => {
    const src = String(row._id || "other");
    acc[src] = Number(row.count || 0);
    return acc;
  }, {});

  const moduleTotals = stripDisabledModuleStats(moduleAccess, approvedBySource);
  const pendingCounts = stripDisabledModuleStats(moduleAccess, pendingBySource);

  return ok({
    data: {
      wallet,
      events,
      commissions,
      referrals,
      referralCode: user?.referralCode || "",
      username: user?.username || "",
      moduleTotals,
      referralEarned,
      pendingCounts,
      withdrawals: {
        totalAmount: withdrawals.totalAmount,
        totalCount: withdrawals.totalCount,
      },
      todaysEarnings,
      todaysEarningsTimeZone: DASHBOARD_EARNINGS_TIMEZONE,
    },
  });
}
