import connectDB from "@/lib/db";
import User from "@/models/User";
import EarningEvent from "@/models/EarningEvent";
import Wallet from "@/models/Wallet";
import ReferralCommission from "@/models/ReferralCommission";
import Transaction from "@/models/Transaction";
import { requireAuth } from "@/lib/auth/guards";
import { ok, fail } from "@/lib/api";
import Withdrawal from "@/models/Withdrawal";
import { hashPassword } from "@/lib/auth/password";
import { ADMIN_MANAGEABLE_ROLES, INTERNAL_ONLY_ROLES, isSuperadminRole } from "@/lib/auth/roles";

function sanitizeTransactionLikeRow(row) {
  const next = { ...row };
  delete next.real;
  if (next.metadata && typeof next.metadata === "object") {
    const safeMeta = { ...next.metadata };
    delete safeMeta.real;
    next.metadata = safeMeta;
  }
  return next;
}

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
  if (!isSuperadminRole(auth.payload.role) && INTERNAL_ONLY_ROLES.includes(String(user.role || ""))) {
    return fail("User not found", 404);
  }
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

  const safeTransactions = transactions.map(sanitizeTransactionLikeRow);
  const latestTransactions = [...safeTransactions, ...pendingOrUnmatchedWithdrawals]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 50);

  return ok({
    data: {
      user,
      wallet,
      earnings,
      commissions,
      transactions: safeTransactions,
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
  if (!isSuperadminRole(auth.payload.role)) {
    const existing = await User.findById(userId).select("role").lean();
    if (!existing || INTERNAL_ONLY_ROLES.includes(String(existing.role || ""))) return fail("User not found", 404);
  }
  const body = await request.json().catch(() => null);
  if (!body) return fail("Invalid payload", 400);
  const updates = {};
  if (body.role) {
    const nextRole = String(body.role || "");
    if (!ADMIN_MANAGEABLE_ROLES.includes(nextRole)) return fail("Invalid role", 400);
    updates.role = nextRole;
  }
  if (typeof body.isBlocked === "boolean") updates.isBlocked = body.isBlocked;
  if (typeof body.isActivated === "boolean") updates.isActivated = body.isActivated;
  if (body.email) updates.email = String(body.email).trim().toLowerCase();
  if (body.phoneNumber !== undefined) updates.phoneNumber = String(body.phoneNumber || "").trim();
  if (body.username) {
    updates.username = String(body.username).trim().toLowerCase();
    updates.referralCode = String(body.username).trim().toLowerCase();
  }
  if (body.password !== undefined) {
    const password = String(body.password || "");
    if (password.length < 6) return fail("Password must be at least 6 characters.", 400);
    updates.passwordHash = await hashPassword(password);
  }
  await User.findByIdAndUpdate(userId, updates);
  return ok({ message: "User updated" });
}

export async function DELETE(request, { params }) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;
  await connectDB();
  const { id: userId } = await params;
  if (!isSuperadminRole(auth.payload.role)) {
    const existing = await User.findById(userId).select("role").lean();
    if (!existing || INTERNAL_ONLY_ROLES.includes(String(existing.role || ""))) return fail("User not found", 404);
  }
  await User.findByIdAndDelete(userId);
  return ok({ message: "User deleted" });
}
