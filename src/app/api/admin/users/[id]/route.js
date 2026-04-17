import connectDB from "@/lib/db";
import User from "@/models/User";
import EarningEvent from "@/models/EarningEvent";
import Wallet from "@/models/Wallet";
import ReferralCommission from "@/models/ReferralCommission";
import Transaction from "@/models/Transaction";
import { requireAuth } from "@/lib/auth/guards";
import { ok, fail } from "@/lib/api";
import Withdrawal from "@/models/Withdrawal";

export async function GET(request, { params }) {
  const auth = await requireAuth(["admin", "support"]);
  if (auth.error) return auth.error;
  await connectDB();
  const { id: userId } = await params;
  const [user, wallet, earnings, commissions, transactions, withdrawals, referralChildrenCount] = await Promise.all([
    User.findById(userId).select("-passwordHash").lean(),
    Wallet.findOne({ userId }).lean(),
    EarningEvent.find({ userId }).sort({ createdAt: -1 }).limit(50).lean(),
    ReferralCommission.find({ beneficiaryUserId: userId }).sort({ createdAt: -1 }).limit(50).lean(),
    Transaction.find({ userId }).sort({ createdAt: -1 }).limit(50).lean(),
    Withdrawal.find({ userId }).sort({ createdAt: -1 }).limit(50).lean(),
    User.countDocuments({ referredByUserId: userId }),
  ]);
  if (!user) return fail("User not found", 404);
  const [referrer, l1, l2, l3] = await Promise.all([
    user.referredByUserId ? User.findById(user.referredByUserId).select("username email").lean() : null,
    user.uplineL1UserId ? User.findById(user.uplineL1UserId).select("username email").lean() : null,
    user.uplineL2UserId ? User.findById(user.uplineL2UserId).select("username email").lean() : null,
    user.uplineL3UserId ? User.findById(user.uplineL3UserId).select("username email").lean() : null,
  ]);

  const totalWithdrawals = Math.abs(
    withdrawals.filter((item) => item.status === "completed").reduce((sum, item) => sum + Number(item.amount || 0), 0)
  );

  const withdrawalTransactionIds = new Set(
    transactions
      .map((tx) => String(tx?.metadata?.withdrawalId || "").trim())
      .filter(Boolean)
  );

  const pendingOrUnmatchedWithdrawals = withdrawals
    .filter((withdrawal) => !withdrawalTransactionIds.has(String(withdrawal._id)))
    .map((withdrawal) => {
      const total = Number(withdrawal.amount || 0) + Number(withdrawal.fee || 0);
      return {
        _id: `withdrawal:${withdrawal._id}`,
        type: "withdrawal",
        amount: -Math.abs(total),
        status: withdrawal.status,
        createdAt: withdrawal.createdAt,
        metadata: {
          ...(withdrawal.metadata || {}),
          source: "withdrawal",
          withdrawalId: withdrawal._id,
          transactionId: withdrawal.transactionId || null,
        },
      };
    });

  const latestTransactions = [...transactions, ...pendingOrUnmatchedWithdrawals]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 50);

  return ok({
    data: {
      user,
      wallet,
      earnings,
      commissions,
      transactions,
      latestTransactions,
      withdrawals,
      referral: {
        referrer,
        uplineL1: l1,
        uplineL2: l2,
        uplineL3: l3,
        directReferrals: referralChildrenCount,
      },
      totals: {
        totalWithdrawals,
      },
    },
  });
}

export async function PATCH(request, { params }) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;
  await connectDB();
  const { id: userId } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return fail("Invalid payload", 400);
  const updates = {};
  if (body.role) updates.role = body.role;
  if (typeof body.isBlocked === "boolean") updates.isBlocked = body.isBlocked;
  if (typeof body.isActivated === "boolean") updates.isActivated = body.isActivated;
  if (body.email) updates.email = String(body.email).trim().toLowerCase();
  if (body.phoneNumber !== undefined) updates.phoneNumber = String(body.phoneNumber || "").trim();
  if (body.username) {
    updates.username = String(body.username).trim().toLowerCase();
    updates.referralCode = String(body.username).trim().toLowerCase();
  }
  await User.findByIdAndUpdate(userId, updates);
  return ok({ message: "User updated" });
}

export async function DELETE(request, { params }) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;
  await connectDB();
  const { id: userId } = await params;
  await User.findByIdAndDelete(userId);
  return ok({ message: "User deleted" });
}
