import connectDB from "@/lib/db";
import { requireAuth } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/api";
import Wallet from "@/models/Wallet";
import User from "@/models/User";
import Transaction from "@/models/Transaction";
import AviatorTopup from "@/models/AviatorTopup";
import { creditAviatorWallet } from "@/lib/aviator/wallet";

export async function POST(request) {
  const auth = await requireAuth(["user", "admin"]);
  if (auth.error) return auth.error;
  await connectDB();

  const body = await request.json().catch(() => ({}));
  const amount = Number(body.amount || 0);
  if (!Number.isFinite(amount) || amount <= 0) return fail("Invalid top-up amount");

  const wallet = await Wallet.findOne({ userId: auth.payload.sub });
  if (!wallet || Number(wallet.availableBalance || 0) < amount) {
    return fail("Insufficient main wallet balance");
  }

  wallet.availableBalance = Number((Number(wallet.availableBalance || 0) - amount).toFixed(2));
  await wallet.save();
  await User.findByIdAndUpdate(auth.payload.sub, { $set: { balance: Number(wallet.availableBalance || 0) } });

  const topup = await AviatorTopup.create({
    userId: auth.payload.sub,
    amount,
    method: "wallet_transfer",
    status: "completed",
    reference: `AVTR-${Date.now()}`,
    processedAt: new Date(),
  });

  await creditAviatorWallet({
    userId: auth.payload.sub,
    amount,
    type: "topup_transfer",
    metadata: { topupId: topup._id, source: "main_wallet" },
  });

  await Transaction.create({
    userId: auth.payload.sub,
    type: "aviator_topup_transfer",
    amount: -amount,
    description: "Transfer to Aviator wallet",
    status: "completed",
    metadata: { topupId: topup._id },
  });

  return ok({ message: "Aviator balance topped up", data: { topupId: topup._id, amount } });
}
