import connectDB from "@/lib/db";
import Withdrawal from "@/models/Withdrawal";
import Wallet from "@/models/Wallet";
import User from "@/models/User";
import { getSetting, getZetupayCredentials } from "@/models/Settings";
import { requireAuth } from "@/lib/auth/guards";
import { initiatePayout } from "@/lib/payments/wavepay";
import { ok, fail } from "@/lib/api";
import {
  DEFAULT_WITHDRAWAL_FEE_TIERS,
  computeWithdrawalFee,
  normalizeWithdrawalFeeMode,
  sanitizeWithdrawalFeeTiers,
} from "@/lib/payments/withdrawal-fees";

export async function GET() {
  const auth = await requireAuth(["user", "admin"]);
  if (auth.error) return auth.error;
  await connectDB();
  const [wallet, minWithdrawal, feeMode, feeValue, feeTiers] = await Promise.all([
    Wallet.findOne({ userId: auth.payload.sub }).select("availableBalance").lean(),
    getSetting("min_withdrawal_amount", 0),
    getSetting("withdrawal_fee_mode", "fixed"),
    getSetting("withdrawal_fee_value", 0),
    getSetting("withdrawal_fee_tiers", DEFAULT_WITHDRAWAL_FEE_TIERS),
  ]);
  const normalizedFeeMode = normalizeWithdrawalFeeMode(feeMode);
  const normalizedFeeTiers = sanitizeWithdrawalFeeTiers(feeTiers);
  return ok({
    data: {
      availableBalance: Number(wallet?.availableBalance || 0),
      minWithdrawal: Number(minWithdrawal || 0),
      feeMode: normalizedFeeMode,
      feeValue: Math.max(0, Number(feeValue || 0)),
      feeTiers: normalizedFeeTiers,
    },
  });
}

export async function POST(request) {
  const auth = await requireAuth(["user", "admin"]);
  if (auth.error) return auth.error;
  await connectDB();
  const body = await request.json().catch(() => ({}));
  const user = await User.findById(auth.payload.sub).select("phoneNumber").lean();
  const phoneNumber = String(user?.phoneNumber || "").trim();
  if (!phoneNumber) return fail("Phone number required");
  const amount = Number(body.amount || 0);
  if (!Number.isFinite(amount) || amount <= 0) return fail("Invalid amount");
  if (!Number.isInteger(amount)) {
    return fail("Withdrawal amount must be a whole number of KES (no decimals).");
  }
  const pendingWithdrawal = await Withdrawal.findOne({ userId: auth.payload.sub, status: "pending" })
    .select("_id")
    .lean();
  if (pendingWithdrawal) {
    return fail("You already have a pending withdrawal. Wait until it finishes before starting another.", 409);
  }
  const [minWithdrawal, feeMode, feeValue, feeTiers] = await Promise.all([
    getSetting("min_withdrawal_amount", 0),
    getSetting("withdrawal_fee_mode", "fixed"),
    getSetting("withdrawal_fee_value", 0),
    getSetting("withdrawal_fee_tiers", DEFAULT_WITHDRAWAL_FEE_TIERS),
  ]);
  const minAmount = Number(minWithdrawal || 0);
  if (minAmount > 0 && amount < minAmount) {
    return fail(`Minimum withdrawal is KES ${minAmount.toFixed(2)}`);
  }
  const normalizedFeeMode = normalizeWithdrawalFeeMode(feeMode);
  const feeValueNum = Math.max(0, Number(feeValue || 0));
  const normalizedFeeTiers = sanitizeWithdrawalFeeTiers(feeTiers);
  const computedFee = computeWithdrawalFee(amount, normalizedFeeMode, feeValueNum, normalizedFeeTiers);
  const totalDeduction = Number((amount + computedFee).toFixed(2));
  const walletBefore = await Wallet.findOne({ userId: auth.payload.sub }).select("availableBalance").lean();
  const available = Number(walletBefore?.availableBalance || 0);
  if (totalDeduction > available) {
    return fail(
      `Insufficient balance. M-Pesa payout KES ${amount} plus fee KES ${computedFee.toFixed(2)} requires KES ${totalDeduction.toFixed(2)}. Available: KES ${available.toFixed(2)}.`
    );
  }
  const wallet = await Wallet.findOneAndUpdate(
    { userId: auth.payload.sub, availableBalance: { $gte: totalDeduction } },
    { $inc: { availableBalance: -totalDeduction } },
    { new: true }
  );
  if (!wallet) return fail("Insufficient withdrawable balance");
  await User.findByIdAndUpdate(auth.payload.sub, { $set: { balance: Number(wallet.availableBalance || 0) } });
  let withdrawal = null;
  try {
    withdrawal = await Withdrawal.create({
      userId: auth.payload.sub,
      amount,
      fee: computedFee,
      method: "wavepay",
      phoneNumber,
      status: "pending",
      metadata: {
        feeMode: normalizedFeeMode,
        feeValue: feeValueNum,
        feeTiers: normalizedFeeTiers,
        totalDeduction,
        balanceReserved: true,
        balanceReservedAt: new Date(),
      },
    });
  } catch (e) {
    const rolledBackWallet = await Wallet.findOneAndUpdate(
      { userId: auth.payload.sub },
      { $inc: { availableBalance: totalDeduction } },
      { new: true }
    );
    await User.findByIdAndUpdate(auth.payload.sub, { $set: { balance: Number(rolledBackWallet?.availableBalance || 0) } });
    if (e?.code === 11000) {
      return fail("You already have a pending withdrawal. Wait until it finishes before starting another.", 409);
    }
    return fail("Unable to create withdrawal request", 500);
  }
  const creds = await getZetupayCredentials(false);
  if (creds?.error) {
    const rolledBackWallet = await Wallet.findOneAndUpdate(
      { userId: auth.payload.sub },
      { $inc: { availableBalance: totalDeduction } },
      { new: true }
    );
    await User.findByIdAndUpdate(auth.payload.sub, { $set: { balance: Number(rolledBackWallet?.availableBalance || 0) } });
    await Withdrawal.findByIdAndUpdate(withdrawal._id, {
      status: "failed",
      processedAt: new Date(),
      notes: "Payout gateway credentials missing",
      metadata: {
        ...(withdrawal.metadata || {}),
        balanceReserved: true,
        balanceRefunded: true,
        balanceRefundedAt: new Date(),
      },
    });
    return fail("Zetupay credentials missing", 500);
  }
  const result = await initiatePayout({
    publicKey: creds.publicKey,
    privateKey: creds.privateKey,
    walletId: creds.walletId,
    amount,
    identifier: withdrawal._id.toString(),
    phoneNumber,
  });
  if (!result.success) {
    const rolledBackWallet = await Wallet.findOneAndUpdate(
      { userId: auth.payload.sub },
      { $inc: { availableBalance: totalDeduction } },
      { new: true }
    );
    await User.findByIdAndUpdate(auth.payload.sub, { $set: { balance: Number(rolledBackWallet?.availableBalance || 0) } });
    await Withdrawal.findByIdAndUpdate(withdrawal._id, {
      status: "failed",
      processedAt: new Date(),
      notes: result.error || "Payout request failed",
      metadata: {
        ...(withdrawal.metadata || {}),
        balanceReserved: true,
        balanceRefunded: true,
        balanceRefundedAt: new Date(),
      },
    });
    return fail(result.error || "Payout request failed", 400);
  }
  return ok({
    message: "Payout initiated",
    withdrawalId: withdrawal._id.toString(),
    fee: computedFee,
    totalDeduction,
  });
}
