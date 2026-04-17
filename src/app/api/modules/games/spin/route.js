import { requireAuth } from "@/lib/auth/guards";
import { getSetting } from "@/models/Settings";
import { submitEarningEvent } from "@/lib/ledger/earnings";
import { logModuleInteraction } from "@/lib/modules/interactions";
import { fail, ok } from "@/lib/api";
import { creditLuckySpinWallet, debitLuckySpinWallet, getOrCreateLuckySpinWallet } from "@/lib/lucky-spin/wallet";

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function GET() {
  const auth = await requireAuth(["user", "admin"]);
  if (auth.error) return auth.error;
  const moduleStatus = await getSetting("module_status", {});
  const defaults = await getSetting("module_lucky_spin_default", {});
  const wallet = await getOrCreateLuckySpinWallet(auth.payload.sub);
  return ok({
    data: {
      enabled: moduleStatus?.game !== false,
      segmentCount: Number(defaults?.segmentCount || 6),
      minBetAmount: Number(defaults?.minBetAmount || 10),
      balance: Number(wallet.balance || 0),
    },
  });
}

export async function POST(request) {
  const auth = await requireAuth(["user", "admin"]);
  if (auth.error) return auth.error;
  const moduleStatus = await getSetting("module_status", {});
  if (moduleStatus?.game === false) return fail("Game module disabled", 403);
  const defaults = await getSetting("module_lucky_spin_default", {});
  const segmentCount = Math.min(12, Math.max(2, Number(defaults?.segmentCount || 6)));
  const minBetAmount = Math.max(1, Number(defaults?.minBetAmount || 10));
  const winProbability = Math.min(95, Math.max(1, Number(defaults?.winProbability || 65)));

  const body = await request.json().catch(() => ({}));
  const betAmount = Number(body.betAmount || 0);
  if (!Number.isFinite(betAmount) || betAmount < minBetAmount) {
    return fail(`Minimum spin bet is KES ${minBetAmount.toFixed(2)}`);
  }
  const debit = await debitLuckySpinWallet({
    userId: auth.payload.sub,
    amount: betAmount,
    type: "spin_bet",
    metadata: { reason: "lucky_spin_bet" },
  });
  if (debit.error === "INSUFFICIENT_BALANCE") return fail("Insufficient Lucky Spin balance");

  const isWin = Math.random() * 100 <= winProbability;
  const landedSegment = isWin ? randomInt(1, segmentCount) : 0;
  const multiplier = isWin ? landedSegment : 0;
  const payout = Number((betAmount * multiplier).toFixed(2));
  if (payout > 0) {
    await creditLuckySpinWallet({
      userId: auth.payload.sub,
      amount: payout,
      type: "spin_payout",
      metadata: { multiplier, betAmount },
    });
  }

  /** Main-wallet EarningEvents are for real credits only; losses stay in ModuleInteraction + Lucky Spin ledger. */
  const event =
    payout > 0
      ? await submitEarningEvent({
          userId: auth.payload.sub,
          amount: payout,
          source: "game",
          metadata: {
            gameType: "lucky_spin",
            betAmount,
            multiplier,
            landedSegment,
            payout,
            segmentCount,
            result: "win",
          },
          status: "approved",
        })
      : null;
  await logModuleInteraction({
    module: "lucky-spin",
    action: "spin",
    status: isWin ? "approved" : "failed",
    amount: payout,
    userId: auth.payload.sub,
    earningEventId: event?._id || null,
    metadata: { multiplier, landedSegment, betAmount, payout, segmentCount, result: isWin ? "win" : "loss" },
  });
  const wallet = await getOrCreateLuckySpinWallet(auth.payload.sub);
  return ok({
    data: {
      eventId: event?._id || null,
      outcome: {
        label: isWin ? `${multiplier}x` : "0x",
        multiplier,
        landedSegment,
        reward: payout,
      },
      betAmount,
      payout,
      balance: Number(wallet.balance || 0),
      segmentCount,
    },
  });
}
