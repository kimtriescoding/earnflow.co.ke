import { requireAuth } from "@/lib/auth/guards";
import connectDB from "@/lib/db";
import ModuleConfig from "@/models/ModuleConfig";
import AviatorLedger from "@/models/AviatorLedger";
import { getSetting } from "@/models/Settings";
import { submitEarningEvent } from "@/lib/ledger/earnings";
import { logModuleInteraction } from "@/lib/modules/interactions";
import { ok, fail } from "@/lib/api";
import { creditAviatorWallet, debitAviatorWallet, getOrCreateAviatorWallet } from "@/lib/aviator/wallet";

const BETTING_OPEN_MS = 10000;
const BETTING_LOCK_MS = 5000;
const BETTING_MS = BETTING_OPEN_MS + BETTING_LOCK_MS;
const MAX_FLIGHT_MS = 12000;
const CRASH_BUFFER_MS = 2500;
const ROUND_DURATION_MS = BETTING_MS + MAX_FLIGHT_MS + CRASH_BUFFER_MS;
const GROWTH_K = 0.0002;

function pseudoRandom(seed) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453123;
  return x - Math.floor(x);
}

function clampBurst(value, min = 1.01, max = 100) {
  return Math.min(max, Math.max(min, Number(value || 0)));
}

function userSeed(userId = "") {
  return String(userId || "")
    .split("")
    .reduce((acc, ch, index) => acc + ch.charCodeAt(0) * (index + 1), 0);
}

function deriveRoundBustAt(roundId, aviatorConfig = {}) {
  const fixedBustAt = Number(aviatorConfig.fixedBustAt || 0);
  const maxBurst = Math.min(100, Math.max(2, Number(aviatorConfig.maxBurst || 12)));
  if (fixedBustAt > 1) return Number(clampBurst(fixedBustAt, 1.01, maxBurst).toFixed(2));

  const r = pseudoRandom(roundId);
  let rawBustAt = 1.1 + r * 5.9;
  if (r < 0.03) rawBustAt = 1.01 + r * 0.45;
  if (r > 0.985) rawBustAt = 10 + r * 35;
  return Number(clampBurst(rawBustAt, 1.01, maxBurst).toFixed(2));
}

function deriveBetBustAt({ roundId, userId, cashoutAt, aviatorConfig = {} }) {
  const fixedBustAt = Number(aviatorConfig.fixedBustAt || 0);
  const maxBurst = Math.min(100, Math.max(2, Number(aviatorConfig.maxBurst || 12)));
  if (fixedBustAt > 1) return Number(clampBurst(fixedBustAt, 1.01, maxBurst).toFixed(2));

  const probability = Math.min(0.95, Math.max(0, Number(aviatorConfig.winProbability ?? 60) / 100));
  if (probability === 0) return 1.0;
  const uidSeed = userSeed(userId);
  const outcomeRoll = pseudoRandom(roundId * 1.07 + uidSeed * 0.017 + 11);
  const jitterRoll = pseudoRandom(roundId * 1.73 + uidSeed * 0.021 + 29);
  const targetCashout = clampBurst(Number(cashoutAt || 1.1), 1.1, maxBurst);

  if (outcomeRoll <= probability) {
    const minWinBust = targetCashout;
    const maxWinBust = maxBurst;
    const winBustAt = minWinBust + jitterRoll * Math.max(0, maxWinBust - minWinBust);
    return Number(clampBurst(winBustAt, 1.01, maxBurst).toFixed(2));
  }

  const maxLoseBust = Math.max(1.01, Math.min(maxBurst, targetCashout - 0.01));
  const loseBustAt = 1.01 + jitterRoll * Math.max(0, maxLoseBust - 1.01);
  return Number(clampBurst(loseBustAt, 1.01, maxBurst).toFixed(2));
}

function getRoundState(nowMs, aviatorConfig = {}) {
  const roundId = Math.floor(nowMs / ROUND_DURATION_MS);
  const roundStartMs = roundId * ROUND_DURATION_MS;
  const elapsedMs = nowMs - roundStartMs;
  const bustAt = deriveRoundBustAt(roundId, aviatorConfig);
  const crashAtMs = Math.min(MAX_FLIGHT_MS, Math.max(1, Math.round(Math.log(bustAt) / GROWTH_K)));

  if (elapsedMs < BETTING_MS) {
    const isOpen = elapsedMs < BETTING_OPEN_MS;
    return {
      roundId,
      phase: isOpen ? "betting" : "locked",
      canPlaceBet: isOpen,
      bustAt,
      multiplier: 1,
      timeToNextPhaseMs: isOpen ? BETTING_OPEN_MS - elapsedMs : BETTING_MS - elapsedMs,
      elapsedInPhaseMs: elapsedMs,
      crashAtMs,
      roundStartMs,
      flightStartMs: roundStartMs + BETTING_MS,
    };
  }

  const flightElapsed = elapsedMs - BETTING_MS;
  if (flightElapsed < crashAtMs) {
    return {
      roundId,
      phase: "flying",
      canPlaceBet: false,
      bustAt,
      multiplier: Number(Math.exp(GROWTH_K * flightElapsed).toFixed(2)),
      timeToNextPhaseMs: crashAtMs - flightElapsed,
      elapsedInPhaseMs: flightElapsed,
      crashAtMs,
      roundStartMs,
      flightStartMs: roundStartMs + BETTING_MS,
    };
  }

  return {
    roundId,
    phase: "crashed",
    canPlaceBet: false,
    bustAt,
    multiplier: bustAt,
    timeToNextPhaseMs: ROUND_DURATION_MS - elapsedMs,
    elapsedInPhaseMs: Math.min(flightElapsed, MAX_FLIGHT_MS),
    crashAtMs,
    roundStartMs,
    flightStartMs: roundStartMs + BETTING_MS,
  };
}

function buildBetId({ userId, roundId, cashoutAt, betAmount, placedAt }) {
  return `${String(userId)}:${roundId}:${Number(cashoutAt).toFixed(2)}:${Number(betAmount).toFixed(2)}:${placedAt}`;
}

function getRoundIdAndElapsed(nowMs) {
  const roundId = Math.floor(nowMs / ROUND_DURATION_MS);
  const roundStartMs = roundId * ROUND_DURATION_MS;
  return {
    roundId,
    roundStartMs,
    elapsedMs: Math.max(0, nowMs - roundStartMs),
  };
}

function canSettleBet(nowMs, betRoundId, betBustAt) {
  const { roundId, elapsedMs } = getRoundIdAndElapsed(nowMs);
  if (betRoundId < roundId) return true;
  if (betRoundId > roundId) return false;
  const flightElapsedMs = Math.max(0, elapsedMs - BETTING_MS);
  const betCrashAtMs = getCrashAtMsForBust(betBustAt);
  return elapsedMs >= BETTING_MS && flightElapsedMs >= betCrashAtMs;
}

function getBetLiveMultiplier(nowMs, betRoundId, betBustAt) {
  const { roundId, elapsedMs } = getRoundIdAndElapsed(nowMs);
  if (betRoundId !== roundId) return null;
  if (elapsedMs < BETTING_MS) return null;
  const flightElapsedMs = Math.max(0, elapsedMs - BETTING_MS);
  const betCrashAtMs = getCrashAtMsForBust(betBustAt);
  if (flightElapsedMs >= betCrashAtMs) return null;
  const live = Math.exp(GROWTH_K * flightElapsedMs);
  return Number(Math.min(live, Number(betBustAt || live)).toFixed(2));
}

function getCrashAtMsForBust(bustAt) {
  const safeBust = Number(bustAt || 0);
  if (safeBust <= 1) return 0;
  return Math.min(MAX_FLIGHT_MS, Math.max(1, Math.round(Math.log(safeBust) / GROWTH_K)));
}

function resolveAviatorSettings(defaults, runtimeConfig) {
  const merged = {
    ...(defaults && typeof defaults === "object" ? defaults : {}),
    ...(runtimeConfig && typeof runtimeConfig === "object" ? runtimeConfig : {}),
  };
  const fixedBustAt = Number(merged.fixedBustAt || 0);
  return {
    fixedBustAt: Number.isFinite(fixedBustAt) ? fixedBustAt : 0,
    minBetAmount: Math.max(1, Number(Number(merged.minBetAmount ?? 10).toFixed(2))),
    winProbability: Math.min(95, Math.max(0, Number(Number(merged.winProbability ?? 60).toFixed(2)))),
    maxBurst: Math.min(100, Math.max(2, Number(Number(merged.maxBurst ?? 12).toFixed(2)))),
  };
}

export async function GET() {
  const auth = await requireAuth(["user", "admin"]);
  if (auth.error) return auth.error;
  await connectDB();
  const moduleStatus = await getSetting("module_status", {});
  if (moduleStatus?.game === false) return fail("Game module disabled", 403);
  const defaults = await getSetting("module_aviator_default", {});
  const config = await ModuleConfig.findOne({ key: "game:aviator" }).lean();
  const settings = resolveAviatorSettings(defaults, config?.value);
  const wallet = await getOrCreateAviatorWallet(auth.payload.sub);
  const nowMs = Date.now();
  const state = getRoundState(nowMs, settings);

  const recentBets = await AviatorLedger.find({ userId: auth.payload.sub, type: "aviator_bet" })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();
  const betIds = recentBets.map((item) => String(item.metadata?.betId || "")).filter(Boolean);
  const settled = await AviatorLedger.find({
    userId: auth.payload.sub,
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

  const stateWithBet =
    pendingBet && pendingBet.roundId === state.roundId
      ? (() => {
          const scopedBustAt = Number(clampBurst(pendingBet.bustAt || state.bustAt, 1, settings.maxBurst).toFixed(2));
          const scopedCrashAtMs = getCrashAtMsForBust(scopedBustAt);
          const elapsedMs = Math.max(0, nowMs - (state.roundStartMs || 0));
          const flightElapsedMs = Math.max(0, elapsedMs - BETTING_MS);
          const scopedPhase =
            elapsedMs < BETTING_OPEN_MS
              ? "betting"
              : elapsedMs < BETTING_MS
                ? "locked"
                : flightElapsedMs < scopedCrashAtMs
                  ? "flying"
                  : "crashed";
          const scopedMultiplier =
            scopedPhase === "betting" || scopedPhase === "locked"
              ? 1
              : scopedPhase === "crashed"
                ? scopedBustAt
                : Number(Math.min(scopedBustAt, Math.exp(GROWTH_K * flightElapsedMs)).toFixed(2));
          const scopedTimeToNextPhaseMs =
            scopedPhase === "betting"
              ? Math.max(0, BETTING_OPEN_MS - elapsedMs)
              : scopedPhase === "locked"
                ? Math.max(0, BETTING_MS - elapsedMs)
              : scopedPhase === "flying"
                ? Math.max(0, scopedCrashAtMs - flightElapsedMs)
                : Math.max(0, ROUND_DURATION_MS - elapsedMs);
          return {
            ...state,
            phase: scopedPhase,
            canPlaceBet: scopedPhase === "betting",
            bustAt: scopedBustAt,
            crashAtMs: scopedCrashAtMs,
            multiplier: scopedMultiplier,
            timeToNextPhaseMs: scopedTimeToNextPhaseMs,
          };
        })()
      : state;

  const history = [];
  for (let i = 1; i <= 14; i += 1) {
    const rid = state.roundId - i;
    if (rid < 0) continue;
    history.push({ roundId: rid, bustAt: deriveRoundBustAt(rid, settings) });
  }

  return ok({
    data: {
      ...stateWithBet,
      nowMs,
      roundDurationMs: ROUND_DURATION_MS,
      bettingOpenMs: BETTING_OPEN_MS,
      bettingLockMs: BETTING_LOCK_MS,
      bettingMs: BETTING_MS,
      maxFlightMs: MAX_FLIGHT_MS,
      pendingBet,
      history,
      minBetAmount: settings.minBetAmount,
      maxBurst: settings.maxBurst,
      walletBalance: Number(wallet.balance || 0),
    },
  });
}

export async function POST(request) {
  const auth = await requireAuth(["user", "admin"]);
  if (auth.error) return auth.error;
  await connectDB();
  const moduleStatus = await getSetting("module_status", {});
  if (moduleStatus?.game === false) return fail("Game module disabled", 403);
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "place").trim().toLowerCase();
  const defaults = await getSetting("module_aviator_default", {});
  const config = await ModuleConfig.findOne({ key: "game:aviator" }).lean();
  const settings = resolveAviatorSettings(defaults, config?.value);
  const nowMs = Date.now();
  const state = getRoundState(nowMs, settings);

  if (action === "place") {
    const roundId = Number(body.roundId);
    const betAmount = Number(body.betAmount || 0);
    if (!Number.isFinite(roundId)) return fail("roundId required");
    if (!Number.isFinite(betAmount) || betAmount < settings.minBetAmount) {
      return fail(`Minimum aviator bet is KES ${settings.minBetAmount.toFixed(2)}`);
    }
    if (roundId !== state.roundId) return fail("Round expired. Use current round.");
    if (!state.canPlaceBet) {
      const waitSeconds = Math.max(0.1, Number((Number(state.timeToNextPhaseMs || 0) / 1000).toFixed(1)));
      return fail(`Betting opens in ${waitSeconds}s`);
    }

    const existing = await AviatorLedger.findOne({
      userId: auth.payload.sub,
      type: "aviator_bet",
      "metadata.roundId": roundId,
    }).lean();
    if (existing) return fail("You already placed a bet for this round");

    const wallet = await getOrCreateAviatorWallet(auth.payload.sub);
    if (Number(wallet.balance || 0) < betAmount) {
      return fail("Insufficient Aviator balance");
    }

    const placedAt = Date.now();
    const betId = buildBetId({
      userId: auth.payload.sub,
      roundId,
      cashoutAt: settings.maxBurst,
      betAmount,
      placedAt,
    });
    const betBustAt = deriveBetBustAt({
      roundId,
      userId: auth.payload.sub,
      cashoutAt: settings.maxBurst,
      aviatorConfig: settings,
    });

    const debit = await debitAviatorWallet({
      userId: auth.payload.sub,
      amount: betAmount,
      type: "aviator_bet",
      metadata: { betId, roundId, bustAt: betBustAt, betAmount, placedAt },
    });
    if (debit.error === "INSUFFICIENT_BALANCE") return fail("Insufficient Aviator balance");
    return ok({
      data: {
        betId,
        roundId,
        betAmount,
        bustAt: betBustAt,
        walletBalance: Number(debit.wallet?.balance || 0),
      },
    }, 201);
  }

  if (action === "cashout") {
    const betId = String(body.betId || "").trim();
    if (!betId) return fail("betId required");
    const betEntry = await AviatorLedger.findOne({
      userId: auth.payload.sub,
      type: "aviator_bet",
      "metadata.betId": betId,
    }).lean();
    if (!betEntry) return fail("Bet not found", 404);
    const settled = await AviatorLedger.findOne({
      userId: auth.payload.sub,
      type: { $in: ["aviator_payout", "aviator_loss"] },
      "metadata.betId": betId,
    }).lean();
    if (settled) return fail("Bet already settled");

    const bet = {
      roundId: Number(betEntry.metadata?.roundId || 0),
      betAmount: Number(betEntry.metadata?.betAmount || 0),
      bustAt: Number(betEntry.metadata?.bustAt || 0),
    };
    if (bet.bustAt <= 1) return fail("Cashout unavailable for this bet");
    const multiplier = getBetLiveMultiplier(nowMs, bet.roundId, bet.bustAt);
    if (!multiplier) return fail("Cashout unavailable now");

    const reward = Number((multiplier * Number(bet.betAmount || 0)).toFixed(2));
    const credited = await creditAviatorWallet({
      userId: auth.payload.sub,
      amount: reward,
      type: "aviator_payout",
      metadata: { roundId: bet.roundId, betId, cashoutMultiplier: multiplier, bustAt: bet.bustAt },
    });
    /** Main-wallet EarningEvents only for real game credit; Aviator ledger still records the cashout. */
    const event =
      reward > 0
        ? await submitEarningEvent({
            userId: auth.payload.sub,
            amount: reward,
            source: "game",
            metadata: {
              gameType: "aviator",
              roundId: bet.roundId,
              betAmount: bet.betAmount,
              cashoutMultiplier: multiplier,
              bustAt: bet.bustAt,
            },
            status: "approved",
          })
        : null;
    await logModuleInteraction({
      module: "aviator",
      action: "aviator_round",
      status: "approved",
      amount: reward,
      userId: auth.payload.sub,
      earningEventId: event?._id || null,
      metadata: { betId, roundId: bet.roundId, betAmount: bet.betAmount, cashoutMultiplier: multiplier, bustAt: bet.bustAt },
    });
    return ok({
      data: {
        betId,
        roundId: bet.roundId,
        betAmount: bet.betAmount,
        bustAt: bet.bustAt,
        cashoutMultiplier: multiplier,
        reward,
        outcome: "won",
        eventId: event?._id || null,
        walletBalance: Number(credited.balance || 0),
      },
    });
  }

  if (action === "settle") {
    const betId = String(body.betId || "").trim();
    if (!betId) return fail("betId required");
    const betEntry = await AviatorLedger.findOne({
      userId: auth.payload.sub,
      type: "aviator_bet",
      "metadata.betId": betId,
    }).lean();
    if (!betEntry) return fail("Bet not found", 404);
    const settled = await AviatorLedger.findOne({
      userId: auth.payload.sub,
      type: { $in: ["aviator_payout", "aviator_loss"] },
      "metadata.betId": betId,
    }).lean();
    if (settled) return ok({ data: { betId, alreadySettled: true } });

    const bet = {
      roundId: Number(betEntry.metadata?.roundId || 0),
      betAmount: Number(betEntry.metadata?.betAmount || 0),
      bustAt: Number(betEntry.metadata?.bustAt || 0),
    };

    const canSettle = canSettleBet(nowMs, bet.roundId, bet.bustAt);
    if (!canSettle) return fail("Round still running");

    const wallet = await getOrCreateAviatorWallet(auth.payload.sub);
    await AviatorLedger.create({
      userId: auth.payload.sub,
      type: "aviator_loss",
      amount: 0,
      balanceAfter: Number(wallet.balance || 0),
      metadata: { betId, roundId: bet.roundId, betAmount: bet.betAmount, bustAt: bet.bustAt },
    });
    await logModuleInteraction({
      module: "aviator",
      action: "aviator_round",
      status: "failed",
      amount: 0,
      userId: auth.payload.sub,
      metadata: { betId, roundId: bet.roundId, betAmount: bet.betAmount, bustAt: bet.bustAt },
    });
    return ok({ data: { betId, ...bet, reward: 0, outcome: "lost", walletBalance: Number(wallet.balance || 0) } });
  }

  return fail("Unsupported action");
}
