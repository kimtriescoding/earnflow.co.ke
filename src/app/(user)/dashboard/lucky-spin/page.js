"use client";

import { useEffect, useRef, useState } from "react";
import { UserAppShell } from "@/components/user/UserAppShell";
import { toast } from "sonner";
import { LuckySpinWheel } from "./LuckySpinWheel";

const LUCKY_SPIN_CHECKOUT_POLL_KEY = "lucky_spin_checkout_topup";

export default function LuckySpinPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [landedLabel, setLandedLabel] = useState("");
  const [betAmount, setBetAmount] = useState("30");
  const [topupAmount, setTopupAmount] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [walletBalance, setWalletBalance] = useState(0);
  const [segmentCount, setSegmentCount] = useState(6);
  const [minBetAmount, setMinBetAmount] = useState(30);

  async function loadLuckySpinState() {
    const t = Date.now();
    const [configRes, walletRes] = await Promise.all([
      fetch(`/api/modules/games/spin?t=${t}`, { cache: "no-store" }),
      fetch(`/api/modules/games/spin/wallet?t=${t}`, { cache: "no-store" }),
    ]);
    const [configData, walletData] = await Promise.all([configRes.json(), walletRes.json()]);

    let nextBalance = 0;
    if (configData?.success) {
      setSegmentCount(Number(configData.data?.segmentCount || 6));
      setMinBetAmount(Number(configData.data?.minBetAmount || 30));
      nextBalance = Number(configData.data?.balance || 0);
      setWalletBalance(nextBalance);
      setBetAmount((prev) => (prev ? prev : String(configData.data?.minBetAmount || 30)));
    }
    if (walletData?.success) {
      const wallet = walletData.data?.wallet || {};
      nextBalance = Number(wallet.balance || 0);
      setWalletBalance(nextBalance);
    }
    return nextBalance;
  }

  const checkoutPollTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const clearCheckoutPoll = () => {
      if (checkoutPollTimer.current) {
        window.clearTimeout(checkoutPollTimer.current);
        checkoutPollTimer.current = null;
      }
    };

    function startCheckoutCompletionPoll(prevBalance, startedAt) {
      const credited = (b) => b > Number(prevBalance || 0) + 1e-6;
      const maxWaitMs = 60_000;

      const step = async () => {
        if (cancelled) return;
        const b = await loadLuckySpinState().catch(() => null);
        if (cancelled || b === null) return;
        if (credited(b)) {
          clearCheckoutPoll();
          try {
            sessionStorage.removeItem(LUCKY_SPIN_CHECKOUT_POLL_KEY);
          } catch {
            /* ignore */
          }
          toast.success("Lucky Spin balance updated.");
          return;
        }
        if (Date.now() - startedAt > maxWaitMs) {
          clearCheckoutPoll();
          try {
            sessionStorage.removeItem(LUCKY_SPIN_CHECKOUT_POLL_KEY);
          } catch {
            /* ignore */
          }
          return;
        }
        checkoutPollTimer.current = window.setTimeout(step, 900);
      };

      checkoutPollTimer.current = window.setTimeout(step, 400);
    }

    (async () => {
      await loadLuckySpinState().catch(() => {});
      if (cancelled) return;

      fetch("/api/auth/me")
        .then((res) => res.json())
        .then((data) => {
          if (!data?.success) return;
          const userPhone = String(data.data?.phoneNumber || "").trim();
          if (!userPhone) return;
          setPhoneNumber((prev) => (String(prev || "").trim() ? prev : userPhone));
        })
        .catch(() => {});

      let raw = null;
      try {
        raw = sessionStorage.getItem(LUCKY_SPIN_CHECKOUT_POLL_KEY);
      } catch {
        /* ignore */
      }
      if (!raw || cancelled) return;
      try {
        const parsed = JSON.parse(raw);
        const prevBalance = Number(parsed.prevBalance ?? 0);
        const startedAt = Number(parsed.startedAt ?? Date.now());
        startCheckoutCompletionPoll(prevBalance, startedAt);
      } catch {
        try {
          sessionStorage.removeItem(LUCKY_SPIN_CHECKOUT_POLL_KEY);
        } catch {
          /* ignore */
        }
      }
    })();

    return () => {
      cancelled = true;
      clearCheckoutPoll();
    };
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      loadLuckySpinState().catch(() => {});
    };
    const onPageShow = (e) => {
      if (e.persisted) loadLuckySpinState().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  async function spinNow() {
    if (loading) return;
    const numericBet = Number(betAmount || 0);
    if (!Number.isFinite(numericBet) || numericBet < minBetAmount) {
      toast.error(`Minimum bet is KES ${Number(minBetAmount).toFixed(2)}.`);
      return;
    }
    setLoading(true);
    setLandedLabel("");
    const spinDurationMs = 3600;
    try {
      const res = await fetch("/api/modules/games/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount: numericBet }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.message || "Spin failed.");
        setLoading(false);
        return;
      }

      const nextResult = data.data || null;
      const effectiveSegCount = Math.max(2, Math.min(12, Number(nextResult?.segmentCount || segmentCount)));
      setSegmentCount(effectiveSegCount);
      const sliceTotal = effectiveSegCount + 1;
      const multiplier = Number(nextResult?.outcome?.multiplier ?? 0);
      const segmentIndex = multiplier === 0 ? 0 : Math.max(1, Math.min(effectiveSegCount, multiplier));
      const segmentAngle = 360 / sliceTotal;
      const targetAngleCenter = segmentIndex * segmentAngle + segmentAngle / 2;
      const pointerAngle = 270;
      const landingOffset = pointerAngle - targetAngleCenter;
      const extraTurns = 6;
      const nextRotation = wheelRotation + extraTurns * 360 + landingOffset + Math.random() * 6 - 3;

      setWheelRotation(nextRotation);

      window.setTimeout(() => {
        setResult(nextResult);
        setLandedLabel(nextResult?.outcome?.multiplier > 0 ? `${nextResult?.outcome?.multiplier}x` : "0x");
        toast.success(`Spin complete: ${nextResult?.outcome?.label || "Result ready"}`);
        loadLuckySpinState().catch(() => {});
        setLoading(false);
      }, spinDurationMs);
    } catch {
      toast.error("Unable to spin right now.");
      setLoading(false);
    }
  }

  async function topupWithCheckout() {
    const amount = Number(topupAmount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    const res = await fetch("/api/modules/games/spin/topup-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        phoneNumber,
        redirectUrl: `${window.location.origin}/dashboard/lucky-spin`,
      }),
    });
    const data = await res.json();
    if (!data.success) return toast.error(data.message || "Checkout top-up failed.");
    const checkoutUrl = data.data?.checkoutUrl;
    if (checkoutUrl) {
      try {
        sessionStorage.setItem(
          LUCKY_SPIN_CHECKOUT_POLL_KEY,
          JSON.stringify({ startedAt: Date.now(), prevBalance: Number(walletBalance || 0) })
        );
      } catch {
        /* ignore */
      }
      window.location.href = checkoutUrl;
    }
  }

  return (
    <UserAppShell title="Lucky Spin">
      <section className="card-surface w-full rounded-3xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="heading-display text-base font-semibold">Top up Lucky Spin balance</h3>
          <p className="text-sm font-semibold text-[var(--brand)]">Lucky Spin balance: KES {Number(walletBalance).toFixed(2)}</p>
        </div>
        <p className="mt-1 text-sm muted-text">Top up your Lucky Spin balance via checkout.</p>
        <div className="mt-4 grid w-full gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <input
            type="number"
            min="1"
            step="0.01"
            value={topupAmount}
            onChange={(e) => setTopupAmount(e.target.value)}
            placeholder="Amount (KES)"
            className="interactive-control w-full rounded-2xl px-3 py-2.5 text-sm"
          />
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="Phone for checkout (optional)"
            className="interactive-control w-full rounded-2xl px-3 py-2.5 text-sm"
          />
          <div className="flex w-full flex-wrap gap-2 md:w-auto md:justify-end">
            <button type="button" onClick={topupWithCheckout} className="primary-btn w-full px-4 py-2 text-sm md:w-auto">
              Top Up
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="order-2 card-surface rounded-3xl p-6 xl:order-1">
          <h2 className="heading-display text-lg font-semibold">Bet and spin</h2>
          <p className="mt-1 text-sm muted-text">Bets use Lucky Spin balance only. Min bet: KES {Number(minBetAmount).toFixed(2)}.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block muted-text">Lucky Spin balance</span>
              <div className="interactive-control rounded-2xl px-3 py-2.5 font-semibold">KES {Number(walletBalance).toFixed(2)}</div>
            </label>
            <label className="text-sm">
              <span className="mb-1 block muted-text">Bet amount (KES)</span>
              <input
                type="number"
                min={minBetAmount}
                step="0.01"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                className="interactive-control w-full rounded-2xl px-3 py-2.5"
              />
            </label>
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-[linear-gradient(168deg,color-mix(in_srgb,var(--brand-strong)_14%,var(--brand))_0%,var(--brand)_55%,color-mix(in_srgb,var(--brand)_88%,#042f2e)_100%)] p-6 text-white shadow-[0_12px_32px_rgba(15,118,110,0.18)]">
            <p className="text-xs uppercase tracking-[0.13em] text-white/80">Latest outcome</p>
            <p className="heading-display mt-2 text-3xl font-semibold">{result?.outcome?.label || "Ready to spin"}</p>
            <p className="mt-1 text-sm text-white/85">
              Payout: KES {Number(result?.payout || 0).toFixed(2)} | Bet: KES {Number(result?.betAmount || 0).toFixed(2)}
            </p>
            <button
              type="button"
              onClick={spinNow}
              disabled={loading}
              className="mt-5 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 disabled:opacity-60"
            >
              {loading ? "Spinning..." : "Spin now"}
            </button>
          </div>
        </section>
        <aside className="order-1 card-strong relative overflow-hidden rounded-3xl p-6 xl:order-2">
          <div
            className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.14)_0%,transparent_70%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-20 -left-12 h-48 w-48 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--brand)_16%,transparent)_0%,transparent_68%)]"
            aria-hidden
          />
          <h3 className="heading-display relative text-base font-semibold">Lucky wheel</h3>
          <p className="relative mt-1 text-xs font-medium uppercase tracking-[0.12em] text-white/90">
            Pointer at the top shows where you land — tap the wheel or use Spin.
          </p>
          <div className="relative mt-6 flex flex-col items-center pb-2">
            <LuckySpinWheel
              segmentCount={segmentCount}
              wheelRotation={wheelRotation}
              loading={loading}
              onActivate={spinNow}
            />
            <button
              type="button"
              onClick={spinNow}
              disabled={loading}
              className="primary-btn mt-5 min-h-[48px] w-full max-w-[min(300px,calc(100vw-2rem))] px-4 py-3 text-base font-semibold shadow-lg disabled:opacity-60 sm:py-3.5"
            >
              {loading ? "Spinning…" : `Spin for KES ${Number(betAmount || minBetAmount).toFixed(2)}`}
            </button>
            <p className="mt-3 max-w-[min(300px,calc(100vw-2rem))] text-center text-sm text-white/80">
              {loading
                ? "Wheel is spinning…"
                : "You can also tap the wheel. Change the bet amount in the Bet and spin panel."}
            </p>
            {landedLabel ? (
              <p className="mt-1 text-sm font-semibold text-[var(--brand)]">
                Landed on: {landedLabel} (KES {Number(result?.outcome?.reward || 0).toFixed(2)})
              </p>
            ) : null}
          </div>
        </aside>
      </div>

    </UserAppShell>
  );
}
