"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UserAppShell } from "@/components/user/UserAppShell";
import { toast } from "sonner";

const REDIRECT_SECONDS = 4;

function wholeKesFromInput(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return 0;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function withdrawalFeeForMpesaAmount(amount, feeMode, feeValue) {
  const a = Math.max(0, Number(amount) || 0);
  if (String(feeMode || "").toLowerCase() === "percentage") {
    return Number(((a * Math.max(0, Number(feeValue || 0))) / 100).toFixed(2));
  }
  return Number(Math.max(0, Number(feeValue || 0)).toFixed(2));
}

function maxMpesaPayoutContinuous(balance, feeMode, feeValue) {
  const B = Math.max(0, Number(balance) || 0);
  if (B <= 0) return 0;
  const mode = String(feeMode || "fixed").toLowerCase() === "percentage" ? "percentage" : "fixed";
  if (mode === "fixed") {
    const F = withdrawalFeeForMpesaAmount(0, "fixed", feeValue);
    return Math.max(0, Number((B - F).toFixed(2)));
  }
  let lo = 0;
  let hi = B;
  for (let i = 0; i < 45; i++) {
    const mid = Number(((lo + hi) / 2).toFixed(2));
    const total = Number((mid + withdrawalFeeForMpesaAmount(mid, "percentage", feeValue)).toFixed(2));
    if (total <= B + 0.0001) lo = mid;
    else hi = mid;
  }
  return Number(lo.toFixed(2));
}

function maxMpesaPayoutForWallet(balance, feeMode, feeValue) {
  const B = Math.max(0, Number(balance) || 0);
  let p = Math.floor(maxMpesaPayoutContinuous(B, feeMode, feeValue));
  while (p > 0) {
    const total = Number((p + withdrawalFeeForMpesaAmount(p, feeMode, feeValue)).toFixed(2));
    if (total <= B + 0.0001) break;
    p -= 1;
  }
  return Math.max(0, p);
}

export default function WithdrawalsPage() {
  const router = useRouter();
  const withdrawalRedirectRef = useRef(false);
  const [form, setForm] = useState({ amount: "", phoneNumber: "" });
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [successFlow, setSuccessFlow] = useState(null);
  const [payoutMeta, setPayoutMeta] = useState({
    availableBalance: 0,
    minWithdrawal: 0,
    feeMode: "fixed",
    feeValue: 0,
  });

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const [meRes, payoutRes] = await Promise.all([fetch("/api/auth/me"), fetch("/api/payments/wavepay/payout")]);
      const data = await meRes.json().catch(() => ({}));
      const payoutData = await payoutRes.json().catch(() => ({}));
      if (data.success) setForm((prev) => ({ ...prev, phoneNumber: String(data.data?.phoneNumber || "") }));
      if (payoutData.success && payoutData.data) {
        setPayoutMeta({
          availableBalance: Number(payoutData.data.availableBalance || 0),
          minWithdrawal: Number(payoutData.data.minWithdrawal || 0),
          feeMode: String(payoutData.data.feeMode || "fixed"),
          feeValue: Number(payoutData.data.feeValue || 0),
        });
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function refreshPayoutMeta() {
    const payoutRes = await fetch("/api/payments/wavepay/payout");
    const payoutData = await payoutRes.json().catch(() => ({}));
    if (payoutData.success && payoutData.data) {
      setPayoutMeta({
        availableBalance: Number(payoutData.data.availableBalance || 0),
        minWithdrawal: Number(payoutData.data.minWithdrawal || 0),
        feeMode: String(payoutData.data.feeMode || "fixed"),
        feeValue: Number(payoutData.data.feeValue || 0),
      });
    }
  }

  useEffect(() => {
    if (!successFlow) return;
    if (successFlow.seconds <= 0) {
      if (!withdrawalRedirectRef.current) {
        withdrawalRedirectRef.current = true;
        router.push("/dashboard/withdrawals/history");
      }
      return;
    }
    const id = window.setTimeout(() => {
      setSuccessFlow((prev) => (prev ? { ...prev, seconds: prev.seconds - 1 } : null));
    }, 1000);
    return () => window.clearTimeout(id);
  }, [successFlow, router]);

  const amountNum = wholeKesFromInput(form.amount);
  const balance = Number(payoutMeta.availableBalance || 0);
  const estimatedFee = withdrawalFeeForMpesaAmount(amountNum, payoutMeta.feeMode, payoutMeta.feeValue);
  const maxMpesaForBalance = maxMpesaPayoutForWallet(balance, payoutMeta.feeMode, payoutMeta.feeValue);
  const minW = Number(payoutMeta.minWithdrawal || 0);
  const maxMeetsMinimum = minW <= 0 || maxMpesaForBalance >= minW - 0.0001;
  const mpesaPayout = amountNum;
  const totalWalletDebit = Number((amountNum + estimatedFee).toFixed(2));
  const belowMin = payoutMeta.minWithdrawal > 0 && amountNum > 0 && amountNum < payoutMeta.minWithdrawal;
  const insufficientFunds = amountNum > 0 && totalWalletDebit > balance + 0.0001;

  async function submit(e) {
    e.preventDefault();
    setErrorMessage("");
    setSuccess(null);
    setSuccessFlow(null);
    if (!form.phoneNumber) {
      toast.error("Add your phone number in profile/admin first.");
      return;
    }
    const requestedAmount = wholeKesFromInput(form.amount);
    const feePreview = withdrawalFeeForMpesaAmount(requestedAmount, payoutMeta.feeMode, payoutMeta.feeValue);
    const needFromWallet = Number((requestedAmount + feePreview).toFixed(2));
    if (requestedAmount <= 0) {
      toast.error("Enter a valid amount.");
      setIsSubmitting(false);
      return;
    }
    if (payoutMeta.minWithdrawal > 0 && requestedAmount < payoutMeta.minWithdrawal) {
      toast.error(`Minimum withdrawal to M-Pesa is KES ${Number(payoutMeta.minWithdrawal).toFixed(2)}.`);
      setIsSubmitting(false);
      return;
    }
    if (needFromWallet > balance + 0.0001) {
      const msg = `Need KES ${needFromWallet.toFixed(2)} (payout + fee). Available: KES ${balance.toFixed(2)}.`;
      setErrorMessage(msg);
      toast.error(msg);
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/payments/wavepay/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: requestedAmount }),
      });
      const data = await res.json();
      if (data.success) {
        withdrawalRedirectRef.current = false;
        const fee = Number(data.fee ?? 0);
        const walletDebit = Number(data.totalDeduction ?? (requestedAmount + fee).toFixed(2));
        setSuccess({
          headline: "Submitted",
          detail: "Payout queued to M-Pesa.",
        });
        setSuccessFlow({
          mpesaAmount: requestedAmount,
          fee,
          walletDebit,
          phone: String(form.phoneNumber || ""),
          seconds: REDIRECT_SECONDS,
        });
        setForm((p) => ({ ...p, amount: "" }));
        toast.success("Withdrawal submitted.");
        await refreshPayoutMeta();
      } else {
        const msg = data.message || "Could not start withdrawal.";
        setErrorMessage(msg);
        toast.error(msg);
      }
    } catch {
      const msg = "Something went wrong. Try again.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <UserAppShell title="Withdraw">
      <div className="w-full">
        <div className="card-surface rounded-3xl p-6 md:p-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="heading-display text-lg font-semibold">Withdraw</h2>
              <p className="mt-1 text-sm muted-text">Whole KES only. M-Pesa amount plus fee comes from your balance.</p>
            </div>
            <Link href="/dashboard/withdrawals/history" className="secondary-btn inline-flex items-center px-3 text-sm">
              History
            </Link>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border bg-[color-mix(in_srgb,var(--surface-soft)_74%,var(--muted)_8%)] p-3.5">
              <p className="text-xs uppercase tracking-[0.12em] muted-text">Withdrawable balance</p>
              <p className="heading-display mt-2 text-xl font-semibold">KES {Number(payoutMeta.availableBalance || 0).toFixed(2)}</p>
            </div>
            <div className="rounded-2xl border bg-[color-mix(in_srgb,var(--surface-soft)_74%,var(--muted)_8%)] p-3.5">
              <p className="text-xs uppercase tracking-[0.12em] muted-text">Max payout</p>
              <p className="heading-display mt-2 text-xl font-semibold">KES {maxMpesaForBalance.toLocaleString()}</p>
              {minW > 0 && maxMpesaForBalance > 0 && !maxMeetsMinimum ? (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">Under min KES {minW.toFixed(2)}</p>
              ) : null}
            </div>
            <div className="rounded-2xl border bg-[color-mix(in_srgb,var(--surface-soft)_74%,var(--muted)_8%)] p-3.5">
              <p className="text-xs uppercase tracking-[0.12em] muted-text">Fee</p>
              <p className="heading-display mt-2 text-xl font-semibold">
                {payoutMeta.feeMode === "percentage"
                  ? `${Number(payoutMeta.feeValue || 0).toFixed(2)}%`
                  : `KES ${Number(payoutMeta.feeValue || 0).toFixed(2)}`}
              </p>
            </div>
            <div className="rounded-2xl border bg-[color-mix(in_srgb,var(--surface-soft)_74%,var(--muted)_8%)] p-3.5">
              <p className="text-xs uppercase tracking-[0.12em] muted-text">Minimum</p>
              <p className="heading-display mt-2 text-xl font-semibold">KES {Number(payoutMeta.minWithdrawal || 0).toFixed(2)}</p>
            </div>
          </div>

          {success ? (
            <div
              className="mt-6 rounded-2xl border p-5 md:p-6"
              style={{
                borderColor: "color-mix(in srgb, var(--success) 45%, var(--border))",
                background: "color-mix(in srgb, var(--success) 8%, var(--surface-soft))",
              }}
              role="status"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white"
                    style={{ background: "var(--success)" }}
                    aria-hidden
                  >
                    ✓
                  </span>
                  <div>
                    <h3 className="heading-display text-base font-semibold text-[var(--foreground)]">{success.headline}</h3>
                    <p className="mt-0.5 text-sm muted-text">{success.detail}</p>
                    {successFlow ? (
                      <p className="mt-2 font-mono text-sm text-[var(--foreground)]">
                        M-Pesa KES {successFlow.mpesaAmount.toLocaleString()} · fee {successFlow.fee.toFixed(2)} · wallet −
                        {successFlow.walletDebit.toFixed(2)} · {successFlow.phone}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
              <p className="mt-3 text-sm font-medium" style={{ color: "var(--success)" }}>
                History in {successFlow?.seconds ?? 0}s ·{" "}
                <Link href="/dashboard/withdrawals/history" className="underline underline-offset-2">
                  Go
                </Link>
              </p>
            </div>
          ) : null}

          {!success ? (
            <>
              <form onSubmit={submit} className="mt-6 grid gap-4">
                <label className="block">
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">Amount (KES)</span>
                    {maxMpesaForBalance > 0 ? (
                      <button
                        type="button"
                        className="text-sm font-semibold underline decoration-[var(--border)] underline-offset-2 hover:opacity-90 disabled:opacity-50"
                        disabled={isSubmitting}
                        onClick={() => setForm((p) => ({ ...p, amount: String(maxMpesaForBalance) }))}
                      >
                        Max
                      </button>
                    ) : null}
                  </div>
                  <input
                    className="interactive-control focus-ring w-full px-3.5 py-2.5 text-sm"
                    value={form.amount}
                    onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value.replace(/\D/g, "") }))}
                    placeholder="1000"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    disabled={isSubmitting}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Destination Phone</span>
                  <input
                    className="interactive-control focus-ring w-full px-3.5 py-2.5 text-sm"
                    value={form.phoneNumber}
                    readOnly
                    placeholder="2547XXXXXXXX"
                    disabled={isSubmitting}
                  />
                </label>
                <button
                  type="submit"
                  className="primary-btn w-full px-4 py-2.5 text-sm md:w-fit disabled:opacity-60"
                  disabled={
                    isSubmitting ||
                    amountNum <= 0 ||
                    insufficientFunds ||
                    belowMin
                  }
                >
                  {isSubmitting ? "Submitting…" : "Request withdrawal"}
                </button>
              </form>
              <div className="mt-4 rounded-2xl border bg-[color-mix(in_srgb,var(--surface-soft)_74%,var(--muted)_8%)] px-3.5 py-2.5 text-sm">
                <p className="muted-text">
                  M-Pesa <span className="font-semibold text-[var(--foreground)]">KES {mpesaPayout.toLocaleString()}</span>
                  {" · "}
                  fee <span className="font-semibold text-[var(--foreground)]">KES {estimatedFee.toFixed(2)}</span>
                  {" · "}
                  total <span className="font-semibold text-[var(--foreground)]">KES {totalWalletDebit.toFixed(2)}</span>
                </p>
                {amountNum > 0 && insufficientFunds ? (
                  <p className="mt-1.5 text-sm font-medium text-red-600 dark:text-red-400">
                    Need KES {totalWalletDebit.toFixed(2)}, have {balance.toFixed(2)}.
                  </p>
                ) : null}
                {amountNum > 0 && belowMin ? (
                  <p className="mt-1.5 text-sm font-medium text-red-600 dark:text-red-400">
                    Min KES {Number(payoutMeta.minWithdrawal).toFixed(2)}.
                  </p>
                ) : null}
              </div>
            </>
          ) : null}
          {errorMessage ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{errorMessage}</p> : null}
        </div>
      </div>
    </UserAppShell>
  );
}
