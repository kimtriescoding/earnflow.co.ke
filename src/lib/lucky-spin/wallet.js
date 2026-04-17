import connectDB from "@/lib/db";
import LuckySpinWallet from "@/models/LuckySpinWallet";
import LuckySpinLedger from "@/models/LuckySpinLedger";

export async function getOrCreateLuckySpinWallet(userId) {
  await connectDB();
  return LuckySpinWallet.findOneAndUpdate({ userId }, { $setOnInsert: { userId } }, { upsert: true, new: true, setDefaultsOnInsert: true });
}

export async function creditLuckySpinWallet({ userId, amount, type, metadata = {} }) {
  await connectDB();
  const amt = Number(Number(amount || 0).toFixed(2));
  const topInc = type === "topup_transfer" || type === "topup_checkout" ? amt : 0;
  const payoutInc = type === "spin_payout" ? amt : 0;
  const wallet = await LuckySpinWallet.findOneAndUpdate(
    { userId },
    {
      $inc: {
        balance: amt,
        totalTopups: topInc,
        totalPayouts: payoutInc,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await LuckySpinLedger.create({
    userId,
    type,
    amount: amt,
    balanceAfter: Number(Number(wallet.balance || 0).toFixed(2)),
    metadata,
  });
  return wallet;
}

export async function debitLuckySpinWallet({ userId, amount, type, metadata = {} }) {
  await connectDB();
  const amt = Number(Number(amount || 0).toFixed(2));
  const wagerInc = type === "spin_bet" ? amt : 0;
  const wallet = await LuckySpinWallet.findOneAndUpdate(
    {
      userId,
      $expr: { $gte: [{ $subtract: [{ $ifNull: ["$balance", 0] }, amt] }, 0] },
    },
    {
      $inc: {
        balance: -amt,
        totalWagered: wagerInc,
      },
    },
    { new: true }
  );
  if (!wallet) {
    const w = await LuckySpinWallet.findOne({ userId }).lean();
    return { error: "INSUFFICIENT_BALANCE", wallet: w };
  }

  await LuckySpinLedger.create({
    userId,
    type,
    amount: Number(-Math.abs(amt)),
    balanceAfter: Number(Number(wallet.balance || 0).toFixed(2)),
    metadata,
  });
  return { wallet };
}
