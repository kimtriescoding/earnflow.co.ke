import { requireAuth } from "@/lib/auth/guards";
import connectDB from "@/lib/db";
import ModuleConfig from "@/models/ModuleConfig";
import AviatorLedger from "@/models/AviatorLedger";
import { getSetting } from "@/models/Settings";
import { isModuleEnabled } from "@/lib/modules/module-access";
import { submitEarningEvent } from "@/lib/ledger/earnings";
import { logModuleInteraction } from "@/lib/modules/interactions";
import { ok, fail } from "@/lib/api";
import { creditAviatorWallet, debitAviatorWallet, getOrCreateAviatorWallet } from "@/lib/aviator/wallet";
import {
  buildBetId,
  canSettleBet,
  deriveBetBustAt,
  getBetLiveMultiplier,
  getRoundState,
  resolveAviatorSettings,
} from "@/lib/aviator/engine";
import { getAviatorGetPayload, invalidateAviatorUserReadCache } from "@/lib/aviator/read-cache";
import { createGetTimer, withPrivateCacheControl } from "@/lib/observability/get-timing";
import { invalidateDashboardUserCaches } from "@/lib/cache/get-cache-invalidation";

export async function GET() {
  const timer = createGetTimer("api_aviator");
  const auth = await requireAuth(["user", "admin"]);
  if (auth.error) return auth.error;
  await connectDB();
  const moduleStatus = await getSetting("module_status", {});
  if (!isModuleEnabled(moduleStatus, "aviator")) return fail("Aviator is disabled", 403);

  const { payload, cacheHit } = await getAviatorGetPayload(auth.payload.sub);
  if (cacheHit) timer.markCacheHit();
  const response = withPrivateCacheControl(ok({ data: payload }), 1);
  return timer.finish(response);
}

export async function POST(request) {
  const auth = await requireAuth(["user", "admin"]);
  if (auth.error) return auth.error;
  await connectDB();
  const moduleStatus = await getSetting("module_status", {});
  if (!isModuleEnabled(moduleStatus, "aviator")) return fail("Aviator is disabled", 403);
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "place").trim().toLowerCase();
  const defaults = await getSetting("module_aviator_default", {});
  const config = await ModuleConfig.findOne({ key: "game:aviator" }).lean();
  const settings = resolveAviatorSettings(defaults, config?.value);
  const nowMs = Date.now();
  const state = getRoundState(nowMs, settings);

  const bustCache = () => {
    invalidateAviatorUserReadCache(auth.payload.sub);
    invalidateDashboardUserCaches(auth.payload.sub);
  };

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
    bustCache();
    return ok(
      {
        data: {
          betId,
          roundId,
          betAmount,
          bustAt: betBustAt,
          walletBalance: Number(debit.wallet?.balance || 0),
        },
      },
      201
    );
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
    bustCache();
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

    if (!canSettleBet(nowMs, bet.roundId, bet.bustAt)) return fail("Round still running");

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
    bustCache();
    return ok({ data: { betId, ...bet, reward: 0, outcome: "lost", walletBalance: Number(wallet.balance || 0) } });
  }

  return fail("Unsupported action");
}
