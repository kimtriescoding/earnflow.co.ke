import EarningEvent from "@/models/EarningEvent";
import ReferralCommission from "@/models/ReferralCommission";
import Transaction from "@/models/Transaction";
import { referralSignupBonusLabel, referralUplineSourceSlug } from "@/lib/dashboard/referral-feed-naming";
import Withdrawal from "@/models/Withdrawal";
import LuckySpinLedger from "@/models/LuckySpinLedger";
import AviatorLedger from "@/models/AviatorLedger";
import Wallet from "@/models/Wallet";
import LuckySpinWallet from "@/models/LuckySpinWallet";
import AviatorWallet from "@/models/AviatorWallet";
import { isTransactionAreaEnabled, normalizeModuleAccess } from "@/lib/modules/module-access";
import { isMetadataRealFlagForRevenue, isTransactionRealForRevenue } from "@/lib/payments/transaction-real";

const FETCH_LIMIT = 300;

const EARNING_LABELS = {
  video: "Video earning",
  academic: "Academic earning",
  chat: "Chat earning",
  task: "Task earning",
  referral: "Referral earning",
  lucky_spin: "Lucky Spin earning",
  aviator: "Aviator earning",
};

function earningLabel(source) {
  const s = String(source || "").trim();
  return EARNING_LABELS[s] || (s ? `Earning (${s})` : "Earning");
}

function transactionMainLabel(type, description) {
  const t = String(type || "");
  if (t === "lucky_spin_topup_transfer") return "Transfer to Lucky Spin wallet";
  if (t === "aviator_topup_transfer") return "Transfer to Aviator wallet";
  if (t === "activation_fee") return "Account activation fee";
  if (t === "referral_signup_bonus") return String(description || "").trim() || "Referral bonus";
  return String(description || "").trim() || t || "Wallet movement";
}

const SPIN_LEDGER_LABELS = {
  spin_bet: "Lucky Spin — bet",
  spin_payout: "Lucky Spin — win",
  topup_transfer: "Lucky Spin — from main wallet",
  topup_checkout: "Lucky Spin — top-up (checkout)",
};

const AVIATOR_LEDGER_LABELS = {
  aviator_bet: "Aviator — bet",
  aviator_payout: "Aviator — cash-out win",
  topup_transfer: "Aviator — from main wallet",
  topup_checkout: "Aviator — top-up (checkout)",
};

function summarizeRows(rows) {
  const byArea = {
    main: { in: 0, out: 0 },
    lucky_spin: { in: 0, out: 0 },
    aviator: { in: 0, out: 0 },
  };
  let grandIn = 0;
  let grandOut = 0;
  for (const r of rows) {
    if (r.includeInTotals === false) continue;
    const a = Number(r.amount || 0);
    if (!Number.isFinite(a) || a <= 0) continue;
    const area = r.area;
    if (!byArea[area]) continue;
    if (r.direction === "in") {
      byArea[area].in += a;
      grandIn += a;
    } else {
      byArea[area].out += a;
      grandOut += a;
    }
  }
  return { byArea, grandIn, grandOut };
}

/**
 * Unified money-in / money-out feed across main wallet, Lucky Spin, and Aviator.
 * @param {{ moduleStatus?: Record<string, unknown> }} [options]
 */
export async function getUserTransactionFeed(userId, options = {}) {
  const uid = userId;
  const [
    wallet,
    spinWalletRow,
    aviatorWalletRow,
    earnings,
    commissions,
    transactions,
    withdrawals,
    spinLedger,
    aviatorLedger,
  ] = await Promise.all([
    Wallet.findOne({ userId: uid }).lean(),
    LuckySpinWallet.findOne({ userId: uid }).lean(),
    AviatorWallet.findOne({ userId: uid }).lean(),
    EarningEvent.find({ userId: uid }).sort({ createdAt: -1 }).limit(FETCH_LIMIT).lean(),
    ReferralCommission.find({ beneficiaryUserId: uid }).sort({ createdAt: -1 }).limit(FETCH_LIMIT).lean(),
    Transaction.find({ userId: uid }).sort({ createdAt: -1 }).limit(FETCH_LIMIT).lean(),
    Withdrawal.find({ userId: uid }).sort({ createdAt: -1 }).limit(FETCH_LIMIT).lean(),
    LuckySpinLedger.find({ userId: uid }).sort({ createdAt: -1 }).limit(FETCH_LIMIT).lean(),
    AviatorLedger.find({ userId: uid }).sort({ createdAt: -1 }).limit(FETCH_LIMIT).lean(),
  ]);

  const rows = [];

  for (const e of earnings) {
    // Legacy signup flow attached a zero-amount referral EarningEvent to the referred user; skip in feed.
    if (String(e.source || "") === "referral" && Number(e.amount || 0) <= 0) continue;
    // Game losses used to create approved EarningEvent rows at amount 0; those are not main-wallet credits.
    if (String(e.source || "") === "game" && Number(e.amount || 0) <= 0) continue;
    rows.push({
      id: `earning:${e._id}`,
      area: "main",
      direction: "in",
      amount: Math.abs(Number(e.amount || 0)),
      label: earningLabel(e.source),
      status: String(e.status || ""),
      kind: `earning:${e.source || "other"}`,
      createdAt: e.createdAt,
      detail: e.status === "pending" ? "Pending review" : e.status === "rejected" ? "Not paid" : "",
    });
  }

  for (const c of commissions) {
    if (c.ledgerTransactionId) continue;
    const level = Number(c.level) || 1;
    rows.push({
      id: `commission:${c._id}`,
      area: "main",
      direction: "in",
      amount: Math.abs(Number(c.amount || 0)),
      label: referralSignupBonusLabel(level, ""),
      status: "completed",
      kind: referralUplineSourceSlug(level),
      createdAt: c.createdAt,
      detail: "",
    });
  }

  for (const t of transactions) {
    if (t.type === "withdrawal") {
      continue;
    }
    const amt = Number(t.amount || 0);
    if (t.type === "referral_signup_bonus") {
      const level = Number(t.metadata?.level ?? 1) || 1;
      rows.push({
        id: `tx:${t._id}`,
        area: "main",
        direction: amt >= 0 ? "in" : "out",
        amount: Math.abs(amt),
        label: referralSignupBonusLabel(level, t.description),
        status: String(t.status || "completed"),
        kind: referralUplineSourceSlug(level),
        createdAt: t.createdAt,
        detail: String(t.description || "").trim(),
      });
      continue;
    }
    rows.push({
      id: `tx:${t._id}`,
      area: "main",
      direction: amt >= 0 ? "in" : "out",
      amount: Math.abs(amt),
      label: transactionMainLabel(t.type, t.description),
      status: String(t.status || "completed"),
      kind: String(t.type || "transaction"),
      createdAt: t.createdAt,
      detail: String(t.description || "").trim(),
      includeInTotals: isTransactionRealForRevenue(t),
    });
  }

  for (const w of withdrawals) {
    const gross = Number((Number(w.amount || 0) + Number(w.fee || 0)).toFixed(2));
    rows.push({
      id: `withdrawal:${w._id}`,
      area: "main",
      direction: "out",
      amount: gross,
      label: "Withdrawal (M-Pesa)",
      status: String(w.status || ""),
      kind: "withdrawal",
      createdAt: w.createdAt,
      detail: `M-Pesa ${Number(w.amount || 0).toFixed(2)} KES · Fee ${Number(w.fee || 0).toFixed(2)} KES`,
    });
  }

  for (const L of spinLedger) {
    const amt = Number(L.amount || 0);
    if (amt === 0) continue;
    rows.push({
      id: `spin:${L._id}`,
      area: "lucky_spin",
      direction: amt > 0 ? "in" : "out",
      amount: Math.abs(amt),
      label: SPIN_LEDGER_LABELS[L.type] || `Lucky Spin (${L.type})`,
      status: "completed",
      kind: String(L.type),
      createdAt: L.createdAt,
      detail: `Play balance after: ${Number(L.balanceAfter || 0).toFixed(2)} KES`,
      includeInTotals: isMetadataRealFlagForRevenue(L.metadata),
    });
  }

  for (const L of aviatorLedger) {
    const amt = Number(L.amount || 0);
    if (amt === 0) continue;
    rows.push({
      id: `aviator:${L._id}`,
      area: "aviator",
      direction: amt > 0 ? "in" : "out",
      amount: Math.abs(amt),
      label: AVIATOR_LEDGER_LABELS[L.type] || `Aviator (${L.type})`,
      status: "completed",
      kind: String(L.type),
      createdAt: L.createdAt,
      detail: `Play balance after: ${Number(L.balanceAfter || 0).toFixed(2)} KES`,
      includeInTotals: isMetadataRealFlagForRevenue(L.metadata),
    });
  }

  rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const access = normalizeModuleAccess(options.moduleStatus ?? {});
  const visibleRows = rows.filter((r) => isTransactionAreaEnabled(access, r.area));
  const summary = summarizeRows(visibleRows);

  return {
    rows: visibleRows,
    summary,
    balances: {
      mainAvailable: Number(wallet?.availableBalance || 0),
      mainPending: Number(wallet?.pendingBalance || 0),
      luckySpin: Number(spinWalletRow?.balance || 0),
      aviator: Number(aviatorWalletRow?.balance || 0),
    },
  };
}
