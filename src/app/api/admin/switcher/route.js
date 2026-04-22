import connectDB from "@/lib/db";
import Transaction from "@/models/Transaction";
import Settings from "@/models/Settings";
import { requireAuth } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/api";
import { isSuperadminRole } from "@/lib/auth/roles";
import { REALITY_SWITCH_KEYS, getPaymentRealSwitches, invalidatePaymentRealSwitchCache } from "@/lib/payments/reality-switch";
import { DASHBOARD_EARNINGS_TIMEZONE } from "@/lib/config/dashboard-timezone";
import { mongoMatchSameCalendarDayToday } from "@/lib/datetime/mongo-same-day-today";

const FALSE_REAL_TYPES = ["activation_fee", "aviator_topup_checkout", "lucky_spin_topup_checkout"];

function toBool(value, fallback) {
  if (typeof value === "boolean") return value;
  return fallback;
}

export async function GET() {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;
  if (!isSuperadminRole(auth.payload.role)) return fail("Not found", 404);
  await connectDB();

  const [switches, falseRealAgg] = await Promise.all([
    getPaymentRealSwitches(),
    Transaction.aggregate([
      { $match: { type: { $in: FALSE_REAL_TYPES }, real: { $eq: false } } },
      mongoMatchSameCalendarDayToday("$createdAt"),
      { $group: { _id: "$type", count: { $sum: 1 }, totalAmount: { $sum: { $abs: "$amount" } } } },
    ]),
  ]);

  const tallies = FALSE_REAL_TYPES.reduce((acc, type) => {
    const row = falseRealAgg.find((item) => String(item._id) === type);
    acc[type] = {
      count: Number(row?.count || 0),
      totalAmount: Number(Number(row?.totalAmount || 0).toFixed(2)),
    };
    return acc;
  }, {});

  return ok({
    data: {
      switches,
      tallies,
      talliesScope: "today",
      talliesTimeZone: DASHBOARD_EARNINGS_TIMEZONE,
    },
  });
}

export async function POST(request) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;
  if (!isSuperadminRole(auth.payload.role)) return fail("Not found", 404);
  await connectDB();
  const body = await request.json().catch(() => ({}));
  const current = await getPaymentRealSwitches();
  const next = {
    activation: toBool(body.activation, current.activation),
    aviatorTopup: toBool(body.aviatorTopup, current.aviatorTopup),
    luckySpinTopup: toBool(body.luckySpinTopup, current.luckySpinTopup),
  };
  await Promise.all([
    Settings.findOneAndUpdate(
      { key: REALITY_SWITCH_KEYS.activation },
      { key: REALITY_SWITCH_KEYS.activation, value: next.activation },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ),
    Settings.findOneAndUpdate(
      { key: REALITY_SWITCH_KEYS.aviatorTopup },
      { key: REALITY_SWITCH_KEYS.aviatorTopup, value: next.aviatorTopup },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ),
    Settings.findOneAndUpdate(
      { key: REALITY_SWITCH_KEYS.luckySpinTopup },
      { key: REALITY_SWITCH_KEYS.luckySpinTopup, value: next.luckySpinTopup },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ),
  ]);
  invalidatePaymentRealSwitchCache();

  return ok({ message: "Switcher updated", data: { switches: next } });
}
