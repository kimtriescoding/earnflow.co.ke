import User from "@/models/User";
import { buildCommissionPlan } from "./commission-plan";
import ReferralCommission from "@/models/ReferralCommission";
import Transaction from "@/models/Transaction";
import Wallet from "@/models/Wallet";
import mongoose from "mongoose";
import { loadReferralCommissionRules } from "@/lib/referrals/commission-config";
import { isStandaloneMongoTransactionError } from "@/lib/db/mongo-transaction-support";
import { logInfo } from "@/lib/observability/logger";

function toUserObjectId(value) {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (typeof value === "object" && value._id) return toUserObjectId(value._id);
  const s = String(value);
  if (s.length === 24 && mongoose.Types.ObjectId.isValid(s)) return new mongoose.Types.ObjectId(s);
  return null;
}

/** Maps a signup referral code to upstream upline fields stored on the new user (L1 = inviter, L2/L3 = inviter’s sponsors). */
export async function resolveReferralHierarchy(referralCode) {
  if (!referralCode) return {};
  const referrer = await User.findOne({ referralCode }).select("_id uplineL1UserId uplineL2UserId referredByUserId").lean();
  if (!referrer) return {};
  const l2 = referrer.uplineL1UserId || referrer.referredByUserId || null;
  let l3 = referrer.uplineL2UserId || null;
  if (!l3 && l2) {
    const sponsor = await User.findById(l2).select("uplineL1UserId uplineL2UserId referredByUserId").lean();
    if (sponsor) {
      l3 = sponsor.uplineL2UserId || sponsor.uplineL1UserId || sponsor.referredByUserId || null;
    }
  }
  return {
    referredByUserId: referrer._id,
    uplineL1UserId: referrer._id,
    uplineL2UserId: l2,
    uplineL3UserId: l3,
  };
}

export { buildCommissionPlan };

/**
 * Rebuilds L1–L3 for activation payouts: live inviter chain plus fallbacks from the referred user’s stored
 * signup snapshot (`uplineL*UserId`). Prefer stored values when set — signup already resolved the chain
 * from the referral code; the inviter row may still have null uplines (legacy / incomplete data), which
 * would otherwise drop L2/L3 from the commission plan.
 */
export async function resolveUplineHierarchyForActivation(newUser) {
  const stored = {
    uplineL1UserId: toUserObjectId(newUser.uplineL1UserId),
    uplineL2UserId: toUserObjectId(newUser.uplineL2UserId),
    uplineL3UserId: toUserObjectId(newUser.uplineL3UserId),
  };

  const inviterId = toUserObjectId(newUser.referredByUserId) || stored.uplineL1UserId;
  if (!inviterId) {
    return stored;
  }
  const inviter = await User.findById(inviterId).select("_id uplineL1UserId uplineL2UserId referredByUserId").lean();
  if (!inviter) {
    return {
      uplineL1UserId: stored.uplineL1UserId || inviterId,
      uplineL2UserId: stored.uplineL2UserId,
      uplineL3UserId: stored.uplineL3UserId,
    };
  }
  const l2 = toUserObjectId(inviter.uplineL1UserId) || toUserObjectId(inviter.referredByUserId);
  let l3 = toUserObjectId(inviter.uplineL2UserId);
  if (!l3 && l2) {
    const sponsorOfInviter = await User.findById(l2).select("uplineL1UserId uplineL2UserId referredByUserId").lean();
    if (sponsorOfInviter) {
      l3 =
        toUserObjectId(sponsorOfInviter.uplineL2UserId) ||
        toUserObjectId(sponsorOfInviter.uplineL1UserId) ||
        toUserObjectId(sponsorOfInviter.referredByUserId) ||
        null;
    }
  }
  const live = {
    uplineL1UserId: inviter._id,
    uplineL2UserId: l2,
    uplineL3UserId: l3,
  };
  return {
    uplineL1UserId: stored.uplineL1UserId || live.uplineL1UserId,
    uplineL2UserId: stored.uplineL2UserId || live.uplineL2UserId,
    uplineL3UserId: stored.uplineL3UserId || live.uplineL3UserId,
  };
}

/** Skip if this payout is already finalized (ledger tx and/or commission row with ledger link). */
async function shouldSkipWalletPayout({ referredUserId, beneficiaryUserId, level }) {
  const lev = Number(level);
  const refStr = String(referredUserId);
  if (
    await ReferralCommission.exists({
      userId: referredUserId,
      beneficiaryUserId,
      level: lev,
      ledgerTransactionId: { $exists: true, $ne: null },
    })
  ) {
    return true;
  }
  const tx = await Transaction.findOne({
    type: "referral_signup_bonus",
    status: "completed",
    userId: beneficiaryUserId,
    $and: [
      {
        $or: [{ "metadata.referredUserId": referredUserId }, { "metadata.referredUserId": refStr }],
      },
      { $or: [{ "metadata.level": lev }, { "metadata.level": String(lev) }] },
    ],
  })
    .select("_id")
    .lean();
  return Boolean(tx);
}

/** If a completed bonus tx exists but no ReferralCommission row, attach RC (no wallet movement). */
async function backfillReferralCommissionFromExistingTx({ referredUserId, beneficiaryUserId, level }) {
  const lev = Number(level);
  const tx = await Transaction.findOne({
    type: "referral_signup_bonus",
    status: "completed",
    userId: beneficiaryUserId,
    $and: [
      {
        $or: [
          { "metadata.referredUserId": referredUserId },
          { "metadata.referredUserId": String(referredUserId) },
        ],
      },
      { $or: [{ "metadata.level": lev }, { "metadata.level": String(lev) }] },
    ],
  })
    .sort({ createdAt: 1 })
    .lean();
  if (!tx) return false;
  const linked = await ReferralCommission.exists({ ledgerTransactionId: tx._id });
  if (linked) return false;
  const hasRow = await ReferralCommission.exists({ userId: referredUserId, beneficiaryUserId, level: lev });
  if (hasRow) return false;
  await ReferralCommission.create([
    {
      userId: referredUserId,
      beneficiaryUserId,
      ledgerTransactionId: tx._id,
      level: lev,
      amount: Number(tx.amount || 0),
    },
  ]);
  logInfo("referral.grant.rc_backfilled", {
    referredUserId: String(referredUserId),
    beneficiaryUserId: String(beneficiaryUserId),
    level: lev,
    ledgerTransactionId: String(tx._id),
  });
  return true;
}

/**
 * Lines that still need wallet + tx + rc. Rows with only a missing RC but an existing tx are backfilled (no wallet).
 */
async function buildPendingSignupCommissionLines(fullPlan, referredUserId) {
  const pending = [];
  for (const c of fullPlan) {
    const beneficiaryUserId = toUserObjectId(c.beneficiaryUserId);
    if (!beneficiaryUserId) continue;
    const level = Number(c.level);
    const hasFinalRc = await ReferralCommission.exists({
      userId: referredUserId,
      beneficiaryUserId,
      level,
      ledgerTransactionId: { $exists: true, $ne: null },
    });
    if (hasFinalRc) continue;
    await backfillReferralCommissionFromExistingTx({ referredUserId, beneficiaryUserId, level });
    const hasFinalAfter = await ReferralCommission.exists({
      userId: referredUserId,
      beneficiaryUserId,
      level,
      ledgerTransactionId: { $exists: true, $ne: null },
    });
    if (hasFinalAfter) continue;
    pending.push(c);
  }
  return pending;
}

function logSkippedUplineLevels(rules, hierarchy, referredUserId) {
  for (let level = 1; level <= 3; level += 1) {
    const key = `level${level}`;
    const row = rules[key];
    if (!row?.enabled || !(Number(row.amount || 0) > 0)) continue;
    const uplineKey = `uplineL${level}UserId`;
    const hasUpline = Boolean(hierarchy[uplineKey]);
    if (!hasUpline) {
      logInfo("referral.grant.level_skipped", {
        reason: "missing_upline",
        level,
        referredUserId: String(referredUserId),
        enabledLevels: { l1: Boolean(rules.level1?.enabled), l2: Boolean(rules.level2?.enabled), l3: Boolean(rules.level3?.enabled) },
        hasUplineL1: Boolean(hierarchy.uplineL1UserId),
        hasUplineL2: Boolean(hierarchy.uplineL2UserId),
        hasUplineL3: Boolean(hierarchy.uplineL3UserId),
      });
    }
  }
}

export async function grantReferralSignupBonuses(newUser, context = {}) {
  if (!context.verifiedActivation) return;
  const hierarchy = await resolveUplineHierarchyForActivation(newUser);
  if (!hierarchy.uplineL1UserId && !hierarchy.uplineL2UserId && !hierarchy.uplineL3UserId) return;

  const rules = await loadReferralCommissionRules();
  const referredUserId = toUserObjectId(newUser._id) || newUser._id;
  logSkippedUplineLevels(rules, hierarchy, referredUserId);

  const fullPlan = buildCommissionPlan({ hierarchy, rules });
  if (!fullPlan.length) return;

  const commissions = await buildPendingSignupCommissionLines(fullPlan, referredUserId);
  if (!commissions.length) return;

  async function runGrant(session) {
    const sessionOpts = session ? { session } : null;
    const walletUpdateOpts = {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
      ...(sessionOpts || {}),
    };
    for (const commission of commissions) {
      const beneficiaryUserId = toUserObjectId(commission.beneficiaryUserId);
      if (!beneficiaryUserId) {
        throw new Error(`Invalid referral beneficiary user id (level ${commission.level})`);
      }
      if (
        await shouldSkipWalletPayout({
          referredUserId,
          beneficiaryUserId,
          level: commission.level,
        })
      ) {
        continue;
      }
      const lev = Number(commission.level);
      const refKey = String(referredUserId);
      const txDoc = {
        userId: beneficiaryUserId,
        type: "referral_signup_bonus",
        amount: commission.amount,
        description: `Referral bonus — activation (level ${lev})`,
        status: "completed",
        metadata: {
          level: lev,
          referredUserId: refKey,
          activationPaymentId: context.activationPaymentId != null ? String(context.activationPaymentId) : null,
        },
      };
      const commissionDoc = {
        userId: referredUserId,
        beneficiaryUserId,
        level: lev,
        amount: commission.amount,
      };

      async function rollbackWallet() {
        await Wallet.findOneAndUpdate(
          { userId: beneficiaryUserId },
          {
            $inc: {
              availableBalance: -commission.amount,
              lifetimeEarnings: -commission.amount,
            },
          },
          walletUpdateOpts
        );
        if (sessionOpts) {
          await User.findByIdAndUpdate(beneficiaryUserId, { $inc: { balance: -commission.amount } }, sessionOpts);
        } else {
          await User.findByIdAndUpdate(beneficiaryUserId, { $inc: { balance: -commission.amount } });
        }
      }

      await Wallet.findOneAndUpdate(
        { userId: beneficiaryUserId },
        {
          $inc: {
            availableBalance: commission.amount,
            lifetimeEarnings: commission.amount,
          },
        },
        walletUpdateOpts
      );
      if (sessionOpts) {
        await User.findByIdAndUpdate(beneficiaryUserId, { $inc: { balance: commission.amount } }, sessionOpts);
      } else {
        await User.findByIdAndUpdate(beneficiaryUserId, { $inc: { balance: commission.amount } });
      }

      let ledgerTx;
      try {
        const created = sessionOpts ? await Transaction.create([txDoc], sessionOpts) : await Transaction.create([txDoc]);
        ledgerTx = created[0];
      } catch (e) {
        if (e?.code === 11000) {
          await rollbackWallet();
          continue;
        }
        await rollbackWallet();
        throw e;
      }

      try {
        if (sessionOpts) {
          await ReferralCommission.create([{ ...commissionDoc, ledgerTransactionId: ledgerTx._id }], sessionOpts);
        } else {
          await ReferralCommission.create([{ ...commissionDoc, ledgerTransactionId: ledgerTx._id }]);
        }
      } catch (e) {
        if (e?.code === 11000) {
          await Transaction.deleteOne({ _id: ledgerTx._id }, sessionOpts || undefined);
          await rollbackWallet();
          continue;
        }
        throw e;
      }
    }
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await runGrant(session);
    });
  } catch (err) {
    if (!isStandaloneMongoTransactionError(err)) throw err;
    await runGrant(null);
  } finally {
    session.endSession();
  }
}

/**
 * Runs `grantReferralSignupBonuses` for every activated user who lists this account as a direct referrer
 * or upline (L1–L3), so missing L2/L3 (or L1) lines are applied once each without double-paying settled rows.
 */
export async function reconcileReferralSignupBonusesForBeneficiary(beneficiaryUserId) {
  const bid = toUserObjectId(beneficiaryUserId);
  if (!bid) return { ok: false, processed: 0, error: "invalid_beneficiary_id" };
  const candidates = await User.find({
    isActivated: true,
    $or: [{ referredByUserId: bid }, { uplineL1UserId: bid }, { uplineL2UserId: bid }, { uplineL3UserId: bid }],
  })
    .select("_id")
    .lean();
  const uniqueIds = [...new Set(candidates.map((c) => String(c._id)))];
  let processed = 0;
  for (const idStr of uniqueIds) {
    const u = await User.findById(idStr);
    if (!u) continue;
    await grantReferralSignupBonuses(u, {
      verifiedActivation: true,
      activationPaymentId: `admin_reconcile_upline:${String(bid)}:${idStr}:${Date.now()}`,
    });
    processed += 1;
  }
  return { ok: true, processed };
}
