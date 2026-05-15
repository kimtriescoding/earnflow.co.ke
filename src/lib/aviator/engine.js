export const BETTING_OPEN_MS = 10000;
export const BETTING_LOCK_MS = 5000;
export const BETTING_MS = BETTING_OPEN_MS + BETTING_LOCK_MS;
export const MAX_FLIGHT_MS = 12000;
export const CRASH_BUFFER_MS = 2500;
export const ROUND_DURATION_MS = BETTING_MS + MAX_FLIGHT_MS + CRASH_BUFFER_MS;
const GROWTH_K = 0.0002;

function pseudoRandom(seed) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453123;
  return x - Math.floor(x);
}

export function clampBurst(value, min = 1.01, max = 100) {
  return Math.min(max, Math.max(min, Number(value || 0)));
}

function userSeed(userId = "") {
  return String(userId || "")
    .split("")
    .reduce((acc, ch, index) => acc + ch.charCodeAt(0) * (index + 1), 0);
}

export function deriveRoundBustAt(roundId, aviatorConfig = {}) {
  const fixedBustAt = Number(aviatorConfig.fixedBustAt || 0);
  const maxBurst = Math.min(100, Math.max(2, Number(aviatorConfig.maxBurst || 12)));
  if (fixedBustAt > 1) return Number(clampBurst(fixedBustAt, 1.01, maxBurst).toFixed(2));

  const r = pseudoRandom(roundId);
  let rawBustAt = 1.1 + r * 5.9;
  if (r < 0.03) rawBustAt = 1.01 + r * 0.45;
  if (r > 0.985) rawBustAt = 10 + r * 35;
  return Number(clampBurst(rawBustAt, 1.01, maxBurst).toFixed(2));
}

export function deriveBetBustAt({ roundId, userId, cashoutAt, aviatorConfig = {} }) {
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

export function getRoundState(nowMs, aviatorConfig = {}) {
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

export function getCrashAtMsForBust(bustAt) {
  const safeBust = Number(bustAt || 0);
  if (safeBust <= 1) return 0;
  return Math.min(MAX_FLIGHT_MS, Math.max(1, Math.round(Math.log(safeBust) / GROWTH_K)));
}

export function buildBetId({ userId, roundId, cashoutAt, betAmount, placedAt }) {
  return `${String(userId)}:${roundId}:${Number(cashoutAt).toFixed(2)}:${Number(betAmount).toFixed(2)}:${placedAt}`;
}

export function getRoundIdAndElapsed(nowMs) {
  const roundId = Math.floor(nowMs / ROUND_DURATION_MS);
  const roundStartMs = roundId * ROUND_DURATION_MS;
  return {
    roundId,
    roundStartMs,
    elapsedMs: Math.max(0, nowMs - roundStartMs),
  };
}

export function canSettleBet(nowMs, betRoundId, betBustAt) {
  const { roundId, elapsedMs } = getRoundIdAndElapsed(nowMs);
  if (betRoundId < roundId) return true;
  if (betRoundId > roundId) return false;
  const flightElapsedMs = Math.max(0, elapsedMs - BETTING_MS);
  const betCrashAtMs = getCrashAtMsForBust(betBustAt);
  return elapsedMs >= BETTING_MS && flightElapsedMs >= betCrashAtMs;
}

export function getBetLiveMultiplier(nowMs, betRoundId, betBustAt) {
  const { roundId, elapsedMs } = getRoundIdAndElapsed(nowMs);
  if (betRoundId !== roundId) return null;
  if (elapsedMs < BETTING_MS) return null;
  const flightElapsedMs = Math.max(0, elapsedMs - BETTING_MS);
  const betCrashAtMs = getCrashAtMsForBust(betBustAt);
  if (flightElapsedMs >= betCrashAtMs) return null;
  const live = Math.exp(GROWTH_K * flightElapsedMs);
  return Number(Math.min(live, Number(betBustAt || live)).toFixed(2));
}

export function resolveAviatorSettings(defaults, runtimeConfig) {
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

export function buildRoundHistory(roundId, settings, count = 14) {
  const history = [];
  for (let i = 1; i <= count; i += 1) {
    const rid = roundId - i;
    if (rid < 0) continue;
    history.push({ roundId: rid, bustAt: deriveRoundBustAt(rid, settings) });
  }
  return history;
}

export function applyPendingBetToState(state, pendingBet, settings, nowMs) {
  if (!pendingBet || pendingBet.roundId !== state.roundId) return state;
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
}
