import connectDB from "@/lib/db";
import User from "@/models/User";
import ActivationPayment from "@/models/ActivationPayment";
import ReferralCommission from "@/models/ReferralCommission";
import Withdrawal from "@/models/Withdrawal";
import { requireAuth } from "@/lib/auth/guards";
import { ok, fail } from "@/lib/api";
import { DASHBOARD_EARNINGS_TIMEZONE } from "@/lib/config/dashboard-timezone";
import {
  defaultRollingRangeYmd,
  enumerateInclusiveDays,
  inclusiveDayCount,
  isValidIsoCalendarDay,
  rangeBoundsUtc,
} from "@/lib/datetime/zoned-range";

const TZ = DASHBOARD_EARNINGS_TIMEZONE;

const DEFAULT_RANGE_DAYS = 14;
/** Hard cap so responses stay bounded and aggregations can use allowDiskUse without unbounded scans. */
const MAX_RANGE_DAYS = 120;

const aggOpts = { allowDiskUse: true, maxTimeMS: 120_000 };

function shortLabel(yyyyMmDd) {
  const parts = String(yyyyMmDd || "").split("-");
  if (parts.length !== 3) return yyyyMmDd;
  return `${parts[1]}-${parts[2]}`;
}

function resolveRangeFromRequest(url) {
  const fromQ = url.searchParams.get("from")?.trim() || "";
  const toQ = url.searchParams.get("to")?.trim() || "";

  if (!fromQ && !toQ) {
    const { fromYmd, toYmd } = defaultRollingRangeYmd({ days: DEFAULT_RANGE_DAYS, timeZone: TZ });
    return { ok: true, fromYmd, toYmd };
  }

  if (!fromQ || !toQ) {
    return { ok: false, error: "Provide both from and to (YYYY-MM-DD), or omit both for the default range." };
  }

  if (!isValidIsoCalendarDay(fromQ) || !isValidIsoCalendarDay(toQ)) {
    return { ok: false, error: "Invalid from or to date (use YYYY-MM-DD)." };
  }

  if (fromQ > toQ) {
    return { ok: false, error: "from must be on or before to." };
  }

  const span = inclusiveDayCount(fromQ, toQ);
  if (span > MAX_RANGE_DAYS) {
    return { ok: false, error: `Date range too large (max ${MAX_RANGE_DAYS} days).` };
  }

  return { ok: true, fromYmd: fromQ, toYmd: toQ };
}

export async function GET(request) {
  const auth = await requireAuth(["admin", "support"]);
  if (auth.error) return auth.error;

  const resolved = resolveRangeFromRequest(new URL(request.url));
  if (!resolved.ok) return fail(resolved.error, 400);

  const { fromYmd, toYmd } = resolved;
  await connectDB();

  const dayKeys = enumerateInclusiveDays(fromYmd, toYmd);
  const { start, endExclusive } = rangeBoundsUtc(fromYmd, toYmd, TZ);

  const [signupsAgg, activationAgg, commissionAgg, withdrawalAgg] = await Promise.all([
    User.aggregate([
      { $match: { createdAt: { $gte: start, $lt: endExclusive }, role: { $in: ["user", "client"] } } },
      {
        $project: {
          day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: TZ } },
        },
      },
      { $group: { _id: "$day", c: { $sum: 1 } } },
    ], aggOpts),
    ActivationPayment.aggregate([
      { $match: { status: "success", updatedAt: { $gte: start, $lt: endExclusive } } },
      {
        $project: {
          day: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt", timezone: TZ } },
          amount: 1,
        },
      },
      { $group: { _id: "$day", total: { $sum: "$amount" } } },
    ], aggOpts),
    ReferralCommission.aggregate([
      { $match: { createdAt: { $gte: start, $lt: endExclusive } } },
      {
        $project: {
          day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: TZ } },
          amount: 1,
        },
      },
      { $group: { _id: "$day", total: { $sum: "$amount" } } },
    ], aggOpts),
    Withdrawal.aggregate([
      {
        $match: {
          status: "completed",
          $or: [
            { processedAt: { $gte: start, $lt: endExclusive } },
            {
              $and: [
                { $or: [{ processedAt: null }, { processedAt: { $exists: false } }] },
                { updatedAt: { $gte: start, $lt: endExclusive } },
              ],
            },
          ],
        },
      },
      {
        $project: {
          day: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: { $ifNull: ["$processedAt", "$updatedAt"] },
              timezone: TZ,
            },
          },
          amount: 1,
          fee: 1,
        },
      },
      {
        $group: {
          _id: "$day",
          total: { $sum: { $add: [{ $ifNull: ["$amount", 0] }, { $ifNull: ["$fee", 0] }] } },
        },
      },
    ], aggOpts),
  ]);

  const signupMap = new Map(signupsAgg.map((r) => [r._id, r.c]));
  const actMap = new Map(activationAgg.map((r) => [r._id, Number(r.total || 0)]));
  const commMap = new Map(commissionAgg.map((r) => [r._id, Number(r.total || 0)]));
  const wdrMap = new Map(withdrawalAgg.map((r) => [r._id, Number(r.total || 0)]));

  const series = dayKeys.map((key) => {
    const signups = Number(signupMap.get(key) || 0);
    const inflow = Number(actMap.get(key) || 0);
    const commissions = Number(commMap.get(key) || 0);
    const withdrawals = Number(wdrMap.get(key) || 0);
    const outflow = Number((commissions + withdrawals).toFixed(2));
    const inf = Number(inflow.toFixed(2));
    return {
      label: shortLabel(key),
      fullDate: key,
      signups,
      inflow: inf,
      commissions,
      withdrawals,
      outflow,
      /** @deprecated use `inflow` — kept for older clients */
      earnings: inf,
      /** @deprecated use `outflow` — kept for older clients */
      payouts: outflow,
      net: Number((inf - outflow).toFixed(2)),
    };
  });

  const totalSignups = series.reduce((s, x) => s + x.signups, 0);
  const totalActivationRevenue = series.reduce((s, x) => s + x.inflow, 0);
  const totalCommissionsPaid = series.reduce((s, x) => s + x.commissions, 0);
  const totalWithdrawalsPaid = series.reduce((s, x) => s + x.withdrawals, 0);
  const totalOutflow = series.reduce((s, x) => s + x.outflow, 0);

  /** Pie: outflows only so slice % = share of money leaving (commissions vs withdrawals). */
  const sourceBreakdown = [
    { name: "Referral commissions", value: Number(totalCommissionsPaid.toFixed(2)) },
    { name: "Withdrawals (incl. fees)", value: Number(totalWithdrawalsPaid.toFixed(2)) },
  ];

  return ok({
    data: {
      series,
      sourceBreakdown,
      statsTimeZone: TZ,
      range: {
        from: fromYmd,
        to: toYmd,
        days: dayKeys.length,
        maxDays: MAX_RANGE_DAYS,
      },
      summary: {
        totalSignups,
        totalActivationRevenue: Number(totalActivationRevenue.toFixed(2)),
        totalCommissionsPaid: Number(totalCommissionsPaid.toFixed(2)),
        totalWithdrawalsPaid: Number(totalWithdrawalsPaid.toFixed(2)),
        totalOutflow: Number(totalOutflow.toFixed(2)),
        netFlow: Number((totalActivationRevenue - totalOutflow).toFixed(2)),
        netActivationsMinusCommissions: Number((totalActivationRevenue - totalCommissionsPaid).toFixed(2)),
      },
    },
  });
}
