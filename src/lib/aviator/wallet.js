import connectDB from "@/lib/db";
import AviatorWallet from "@/models/AviatorWallet";
import AviatorLedger from "@/models/AviatorLedger";

export async function getOrCreateAviatorWallet(userId) {
  await connectDB();
  return AviatorWallet.findOneAndUpdate({ userId }, { $setOnInsert: { userId } }, { upsert: true, new: true, setDefaultsOnInsert: true });
}

export async function creditAviatorWallet({ userId, amount, type, metadata = {} }) {
  await connectDB();
  const amt = Number(Number(amount || 0).toFixed(2));
  const topInc = type === "topup_transfer" || type === "topup_checkout" ? amt : 0;
  const payoutInc = type === "aviator_payout" ? amt : 0;
  const wallet = await AviatorWallet.findOneAndUpdate(
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

  await AviatorLedger.create({
    userId,
    type,
    amount: amt,
    balanceAfter: Number(Number(wallet.balance || 0).toFixed(2)),
    metadata,
  });
  return wallet;
}

export async function debitAviatorWallet({ userId, amount, type, metadata = {} }) {
  await connectDB();
  const amt = Number(Number(amount || 0).toFixed(2));
  const wagerInc = type === "aviator_bet" ? amt : 0;
  const wallet = await AviatorWallet.findOneAndUpdate(
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
    const w = await AviatorWallet.findOne({ userId }).lean();
    return { error: "INSUFFICIENT_BALANCE", wallet: w };
  }

  await AviatorLedger.create({
    userId,
    type,
    amount: Number(-Math.abs(amt)),
    balanceAfter: Number(Number(wallet.balance || 0).toFixed(2)),
    metadata,
  });
  return { wallet };
}
