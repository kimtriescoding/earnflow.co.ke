import connectDB from "@/lib/db";
import ModuleConfig from "@/models/ModuleConfig";
import AviatorLedger from "@/models/AviatorLedger";
import { getSetting } from "@/models/Settings";
import { getOrCreateAviatorWallet } from "@/lib/aviator/wallet";
import {
  applyPendingBetToState,
  buildRoundHistory,
  getRoundState,
  resolveAviatorSettings,
  ROUND_DURATION_MS,
  BETTING_OPEN_MS,
  BETTING_LOCK_MS,
  BETTING_MS,
  MAX_FLIGHT_MS,
} from "@/lib/aviator/engine";
import { createTtlCache } from "@/lib/cache/ttl-cache";

const GLOBAL_ENGINE_CACHE = createTtlCache("aviator-engine-global", 1_500);
const USER_READ_CACHE = createTtlCache("aviator-user-read", 400);

async function loadGlobalEngineSlice(nowMs) {
  await connectDB();
  const defaults = await getSetting("module_aviator_default", {});
  const config = await ModuleConfig.findOne({ key: "game:aviator" }).lean();
  const settings = resolveAviatorSettings(defaults, config?.value);
  const state = getRoundState(nowMs, settings);
  const history = buildRoundHistory(state.roundId, settings);
  return { settings, state, history, nowMs };
}

async function loadUserSlice(userId) {
  await connectDB();
  const wallet = await getOrCreateAviatorWallet(userId);
  const recentBets = await AviatorLedger.find({ userId, type: "aviator_bet" })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();
  const betIds = recentBets.map((item) => String(item.metadata?.betId || "")).filter(Boolean);
  const settled =
    betIds.length === 0
      ? []
      : await AviatorLedger.find({
          userId,
          type: { $in: ["aviator_payout", "aviator_loss"] },
          "metadata.betId": { $in: betIds },
        })
          .select("metadata.betId")
          .lean();
  const settledSet = new Set(settled.map((item) => String(item.metadata?.betId || "")));
  const pendingBet =
    recentBets
      .map((item) => ({
        betId: String(item.metadata?.betId || ""),
        status: "pending",
        roundId: Number(item.metadata?.roundId || 0),
        cashoutAt: Number(item.metadata?.cashoutAt || 0),
        betAmount: Number(item.metadata?.betAmount || 0),
        bustAt: Number(item.metadata?.bustAt || 0),
      }))
      .find((item) => item.betId && !settledSet.has(item.betId)) || null;

  return {
    walletBalance: Number(wallet.balance || 0),
    pendingBet,
  };
}

export async function getAviatorGetPayload(userId) {
  const nowMs = Date.now();
  const globalKey = String(Math.floor(nowMs / 500));
  let cacheHit = false;
  let global = GLOBAL_ENGINE_CACHE.get(globalKey);
  if (!global) {
    global = await loadGlobalEngineSlice(nowMs);
    GLOBAL_ENGINE_CACHE.set(globalKey, global);
  } else {
    cacheHit = true;
  }

  const userKey = String(userId);
  let userSlice = USER_READ_CACHE.get(userKey);
  if (!userSlice) {
    userSlice = await loadUserSlice(userId);
    USER_READ_CACHE.set(userKey, userSlice);
  } else {
    cacheHit = true;
  }

  const { settings, state, history } = global;
  const stateWithBet = applyPendingBetToState(state, userSlice.pendingBet, settings, nowMs);

  return {
    payload: {
      ...stateWithBet,
      nowMs,
      roundDurationMs: ROUND_DURATION_MS,
      bettingOpenMs: BETTING_OPEN_MS,
      bettingLockMs: BETTING_LOCK_MS,
      bettingMs: BETTING_MS,
      maxFlightMs: MAX_FLIGHT_MS,
      pendingBet: userSlice.pendingBet,
      history,
      minBetAmount: settings.minBetAmount,
      maxBurst: settings.maxBurst,
      walletBalance: userSlice.walletBalance,
    },
    cacheHit,
  };
}

export function invalidateAviatorUserReadCache(userId) {
  USER_READ_CACHE.delete(String(userId || ""));
}

export async function getAviatorWalletBalance(userId) {
  const userKey = String(userId);
  const cached = USER_READ_CACHE.get(userKey);
  if (cached) return cached.walletBalance;
  await connectDB();
  const wallet = await getOrCreateAviatorWallet(userId);
  return Number(wallet.balance || 0);
}
