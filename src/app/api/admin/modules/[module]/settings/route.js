import connectDB from "@/lib/db";
import { requireAuth } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/api";
import Settings from "@/models/Settings";
import { isSupportedModule, moduleSettingsKey, moduleStatusKey, normalizeModuleKey } from "@/lib/modules/constants";

function clampNumber(value, fallback, min = 0, max = Number.POSITIVE_INFINITY) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeModuleConfig(slug, raw) {
  const config = raw && typeof raw === "object" ? raw : {};
  if (slug === "lucky-spin") {
    return {
      ...config,
      segmentCount: Math.min(12, Math.max(2, Math.floor(Number(config.segmentCount ?? 6)))),
      minBetAmount: Math.max(1, Number(Number(config.minBetAmount ?? 10).toFixed(2))),
      winProbability: Math.min(95, Math.max(1, Number(Number(config.winProbability ?? 65).toFixed(2)))),
    };
  }
  if (slug === "aviator") {
    return {
      ...config,
      minBetAmount: Math.max(1, Number(Number(config.minBetAmount ?? 10).toFixed(2))),
      winProbability: Math.min(95, Math.max(0, Number(Number(config.winProbability ?? 60).toFixed(2)))),
      maxBurst: Math.min(100, Math.max(2, Number(Number(config.maxBurst ?? 12).toFixed(2)))),
    };
  }
  if (slug === "video") {
    return {
      ...config,
      thresholdSeconds: clampNumber(config.thresholdSeconds, 30, 1),
      reward: clampNumber(config.reward, 2, 0),
      clientPricePerView: clampNumber(config.clientPricePerView, 0.25, 0.01),
      minTargetViews: Math.floor(clampNumber(config.minTargetViews, 200, 10)),
    };
  }
  if (slug === "academic") {
    return {
      ...config,
      baseReward: clampNumber(config.baseReward, 20, 0),
      autoApprove: Boolean(config.autoApprove),
      clientBasePrice: clampNumber(config.clientBasePrice, 350, 0),
      clientPricePer100Words: clampNumber(config.clientPricePer100Words, 120, 0),
      urgentMultiplier: clampNumber(config.urgentMultiplier, 1.5, 1, 10),
    };
  }
  return config;
}

export async function GET(_request, { params }) {
  const auth = await requireAuth(["admin", "support"]);
  if (auth.error) return auth.error;
  const slug = normalizeModuleKey((await params).module);
  if (!isSupportedModule(slug)) return fail("Unsupported module", 404);
  await connectDB();

  const [statusDoc, cfgDoc] = await Promise.all([
    Settings.findOne({ key: "module_status" }).lean(),
    Settings.findOne({ key: moduleSettingsKey(slug) }).lean(),
  ]);
  const statusKey = moduleStatusKey(slug);
  return ok({
    data: {
      enabled: Boolean(statusDoc?.value?.[statusKey]),
      config: cfgDoc?.value || {},
    },
  });
}

export async function POST(request, { params }) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;
  const slug = normalizeModuleKey((await params).module);
  if (!isSupportedModule(slug)) return fail("Unsupported module", 404);
  await connectDB();

  const body = await request.json().catch(() => ({}));
  const statusKey = moduleStatusKey(slug);
  const [statusDoc] = await Promise.all([Settings.findOne({ key: "module_status" })]);
  const mergedStatus = { ...(statusDoc?.value || {}) };
  if (body.enabled !== undefined) mergedStatus[statusKey] = Boolean(body.enabled);
  const normalizedConfig = normalizeModuleConfig(slug, body.config);

  await Promise.all([
    Settings.findOneAndUpdate(
      { key: "module_status" },
      { key: "module_status", value: mergedStatus },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ),
    Settings.findOneAndUpdate(
      { key: moduleSettingsKey(slug) },
      { key: moduleSettingsKey(slug), value: normalizedConfig },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ),
  ]);
  return ok({ message: "Module settings updated" });
}
