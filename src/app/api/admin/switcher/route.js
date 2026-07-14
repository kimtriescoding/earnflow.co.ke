import connectDB from "@/lib/db";
import Transaction from "@/models/Transaction";
import Settings from "@/models/Settings";
import { requireAuth } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/api";
import { isSuperadminRole } from "@/lib/auth/roles";
import { REALITY_SWITCH_KEYS, getPaymentRealSwitches, invalidatePaymentRealSwitchCache } from "@/lib/payments/reality-switch";
import { DASHBOARD_EARNINGS_TIMEZONE } from "@/lib/config/dashboard-timezone";
import { mongoMatchSameCalendarDayToday } from "@/lib/datetime/mongo-same-day-today";
import { ADMIN_SWITCHER_CACHE, invalidateAdminCaches } from "@/lib/cache/get-cache-invalidation";
import { createGetTimer, withPrivateCacheControl } from "@/lib/observability/get-timing";

const FALSE_REAL_TYPES = ["activation_fee", "aviator_topup_checkout", "lucky_spin_topup_checkout"];

function toBool(value, fallback) {
  if (typeof value === "boolean") return value;
  return fallback;
}

export async function GET() {
  const timer = createGetTimer("api_admin_switcher");
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;
  if (!isSuperadminRole(auth.payload.role)) return fail("Not found", 404);
  const cached = ADMIN_SWITCHER_CACHE.get("global");
  if (cached) {
    timer.markCacheHit();
    return timer.finish(withPrivateCacheControl(ok({ data: cached }), 8));
  }
  await connectDB();

  const [switches, falseRealAgg, moduleCredsRaw] = await Promise.all([
    getPaymentRealSwitches(),
    Transaction.aggregate([
      { $match: { type: { $in: FALSE_REAL_TYPES }, real: { $eq: false } } },
      mongoMatchSameCalendarDayToday("$createdAt"),
      { $group: { _id: "$type", count: { $sum: 1 }, totalAmount: { $sum: { $abs: "$amount" } } } },
    ]),
    Settings.findOne({ key: "zetupay_module_credentials" }).lean(),
  ]);

  const tallies = FALSE_REAL_TYPES.reduce((acc, type) => {
    const row = falseRealAgg.find((item) => String(item._id) === type);
    acc[type] = {
      count: Number(row?.count || 0),
      totalAmount: Number(Number(row?.totalAmount || 0).toFixed(2)),
    };
    return acc;
  }, {});

  const rawCreds = moduleCredsRaw?.value || {};
  const moduleCredentials = {};
  const modulesList = ["activation", "aviatorTopup", "luckySpinTopup", "video", "chat", "academic"];
  for (const mod of modulesList) {
    const cfg = rawCreds[mod] || {};
    moduleCredentials[mod] = {
      useCustom: Boolean(cfg.useCustom),
      publicKey: cfg.publicKey || "",
      walletId: cfg.walletId || "",
      privateKey: cfg.privateKey ? "••••••••" : "",
    };
  }

  const data = {
    switches,
    tallies,
    talliesScope: "today",
    talliesTimeZone: DASHBOARD_EARNINGS_TIMEZONE,
    moduleCredentials,
  };
  ADMIN_SWITCHER_CACHE.set("global", data);
  return timer.finish(withPrivateCacheControl(ok({ data }), 8));
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

  const incomingCreds = body.moduleCredentials || {};
  const currentCredsDoc = await Settings.findOne({ key: "zetupay_module_credentials" }).lean();
  const currentCreds = currentCredsDoc?.value || {};
  
  const nextCreds = {};
  const modulesList = ["activation", "aviatorTopup", "luckySpinTopup", "video", "chat", "academic"];
  let hasCredChanges = false;
  
  if (body.moduleCredentials) {
    hasCredChanges = true;
    for (const mod of modulesList) {
      const incomingCfg = incomingCreds[mod] || {};
      const currentCfg = currentCreds[mod] || {};
      
      let privateKey = incomingCfg.privateKey || "";
      if (privateKey === "••••••••") {
        privateKey = currentCfg.privateKey || "";
      }
      
      nextCreds[mod] = {
        useCustom: Boolean(incomingCfg.useCustom),
        publicKey: String(incomingCfg.publicKey || "").trim(),
        privateKey: String(privateKey).trim(),
        walletId: String(incomingCfg.walletId || "").trim(),
      };
    }
  }

  const promises = [
    Settings.findOneAndUpdate(
      { key: REALITY_SWITCH_KEYS.activation },
      { key: REALITY_SWITCH_KEYS.activation, value: next.activation },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    ),
    Settings.findOneAndUpdate(
      { key: REALITY_SWITCH_KEYS.aviatorTopup },
      { key: REALITY_SWITCH_KEYS.aviatorTopup, value: next.aviatorTopup },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    ),
    Settings.findOneAndUpdate(
      { key: REALITY_SWITCH_KEYS.luckySpinTopup },
      { key: REALITY_SWITCH_KEYS.luckySpinTopup, value: next.luckySpinTopup },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    ),
  ];

  if (hasCredChanges) {
    promises.push(
      Settings.findOneAndUpdate(
        { key: "zetupay_module_credentials" },
        { key: "zetupay_module_credentials", value: nextCreds },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      )
    );
  }

  await Promise.all(promises);

  if (hasCredChanges) {
    const { deleteCache } = await import("@/lib/cache/config-cache");
    deleteCache("settings:zetupay_module_credentials");
  }

  invalidatePaymentRealSwitchCache();
  invalidateAdminCaches();
  ADMIN_SWITCHER_CACHE.delete("global");

  return ok({ message: "Switcher updated", data: { switches: next } });
}
