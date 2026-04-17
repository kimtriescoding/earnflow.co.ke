"use client";

import { useEffect, useRef, useState } from "react";
import { UserAppShell } from "@/components/user/UserAppShell";
import { toast } from "sonner";
import { AviatorTopupCard } from "./components/AviatorTopupCard";
import { AviatorRoundStage } from "./components/AviatorRoundStage";
import { AviatorBetPanel } from "./components/AviatorBetPanel";

export default function AviatorPage() {
  const [betAmount, setBetAmount] = useState("10");
  const [topupAmount, setTopupAmount] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [cashingOut, setCashingOut] = useState(false);
  const [toppingUp, setToppingUp] = useState(false);
  const [result, setResult] = useState(null);
  const [renderNowMs, setRenderNowMs] = useState(Date.now());
  const [burstedFlashUntilMs, setBurstedFlashUntilMs] = useState(0);
  const [engine, setEngine] = useState({
    roundId: 0,
    phase: "betting",
    multiplier: 1,
    bustAt: 1.2,
    timeToNextPhaseMs: 0,
    minBetAmount: 10,
    walletBalance: 0,
    history: [],
    pendingBet: null,
  });
  const settleInFlight = useRef(false);
  const enginePhaseRef = useRef("betting");

  async function loadProfilePhone() {
    const res = await fetch("/api/auth/me");
    const data = await res.json();
    if (!data.success) return;
    const profilePhone = String(data.data?.phoneNumber || "").trim();
    if (!profilePhone) return;
    setPhoneNumber((prev) => (String(prev || "").trim() ? prev : profilePhone));
  }

  async function loadEngine() {
    const engineRes = await fetch(`/api/modules/games/aviator?t=${Date.now()}`, { cache: "no-store" });
    const engineData = await engineRes.json();
    if (engineData.success) setEngine((prev) => ({ ...prev, ...(engineData.data || {}) }));
  }

  async function settlePendingBet(betId) {
    if (!betId || settleInFlight.current) return;
    settleInFlight.current = true;
    try {
      const res = await fetch("/api/modules/games/aviator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "settle", betId }),
      });
      const data = await res.json();
      if (!data.success) return;
      if (data.data?.outcome === "won") {
        toast.success(`Won! Payout KES ${Number(data.data?.reward || 0).toFixed(2)}`);
        setResult({ bustAt: Number(data.data?.bustAt || 0), reward: Number(data.data?.reward || 0) });
      } else {
        toast.error("Lost! Plane bursted before your cashout.");
        setResult({ bustAt: Number(data.data?.bustAt || 0), reward: 0 });
        setBurstedFlashUntilMs(Date.now() + 1800);
      }
      if (data.data?.walletBalance !== undefined) {
        setEngine((prev) => ({ ...prev, walletBalance: Number(data.data.walletBalance || 0) }));
      }
      await loadEngine();
    } finally {
      settleInFlight.current = false;
    }
  }

  useEffect(() => {
    enginePhaseRef.current = engine.phase;
  }, [engine.phase]);

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    async function poll() {
      if (cancelled) return;
      await loadEngine().catch(() => {});
      if (cancelled) return;
      const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
      const phase = enginePhaseRef.current;
      const delay = hidden ? 1500 : phase === "flying" ? 180 : phase === "betting" ? 150 : phase === "locked" ? 150 : 500;
      timer = window.setTimeout(poll, delay);
    }

    loadProfilePhone().catch(() => {});
    poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    let rafId = null;
    let timer = null;
    if (engine.phase === "flying") {
      const tick = () => {
        setRenderNowMs(Date.now());
        rafId = window.requestAnimationFrame(tick);
      };
      rafId = window.requestAnimationFrame(tick);
    } else if (engine.phase === "betting" || engine.phase === "locked") {
      timer = window.setInterval(() => setRenderNowMs(Date.now()), 60);
    } else {
      timer = window.setInterval(() => setRenderNowMs(Date.now()), 200);
    }
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      if (timer) window.clearInterval(timer);
    };
  }, [engine.phase]);

  useEffect(() => {
    const pending = engine.pendingBet;
    if (!pending || pending.status !== "pending") return;
    const shouldSettle = pending.roundId < engine.roundId || (pending.roundId === engine.roundId && engine.phase === "crashed");
    if (!shouldSettle) return;
    settlePendingBet(pending.betId).catch(() => {});
  }, [engine.pendingBet, engine.phase, engine.roundId]);

  async function placeBet(e) {
    e.preventDefault();
    const amount = Number(betAmount || 0);
    if (!Number.isFinite(amount) || amount < Number(engine.minBetAmount || 10)) {
      toast.error(`Minimum Aviator bet is KES ${Number(engine.minBetAmount || 10).toFixed(2)}`);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/modules/games/aviator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "place", betAmount: amount, roundId: engine.roundId }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.message || "Bet failed.");
        return;
      }
      toast.success("Bet accepted. Waiting for crash...");
      if (data.data?.walletBalance !== undefined) {
        setEngine((prev) => ({ ...prev, walletBalance: Number(data.data.walletBalance || 0) }));
      }
      await loadEngine();
    } catch {
      toast.error("Unable to place bet right now.");
    } finally {
      setLoading(false);
    }
  }

  async function cashoutBet() {
    const betId = String(engine.pendingBet?.betId || "");
    if (!betId) return;
    setCashingOut(true);
    try {
      const res = await fetch("/api/modules/games/aviator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cashout", betId }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.message || "Cashout failed.");
        return;
      }
      toast.success(`Cashed out! Payout KES ${Number(data.data?.reward || 0).toFixed(2)}`);
      if (data.data?.walletBalance !== undefined) {
        setEngine((prev) => ({ ...prev, walletBalance: Number(data.data.walletBalance || 0) }));
      }
      setResult({ bustAt: Number(data.data?.bustAt || 0), reward: Number(data.data?.reward || 0) });
      await loadEngine();
    } catch {
      toast.error("Unable to cash out right now.");
    } finally {
      setCashingOut(false);
    }
  }

  async function topupWithCheckout() {
    const amount = Number(topupAmount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid top-up amount.");
      return;
    }
    setToppingUp(true);
    const res = await fetch("/api/modules/games/aviator/topup-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        phoneNumber,
        redirectUrl: `${window.location.origin}/dashboard/aviator`,
      }),
    });
    const data = await res.json();
    setToppingUp(false);
    if (!data.success) return toast.error(data.message || "Checkout top-up failed.");
    const checkoutUrl = data.data?.checkoutUrl;
    if (checkoutUrl) window.location.href = checkoutUrl;
  }

  const lastReward = Number(result?.reward || 0);
  const hasActivePendingBet = Boolean(engine.pendingBet?.status === "pending");
  const cashoutAllowed = hasActivePendingBet && engine.phase === "flying" && Number(engine.pendingBet?.bustAt || 0) > 1;

  return (
    <UserAppShell title="Aviator">
      <AviatorTopupCard
        walletBalance={engine.walletBalance}
        topupAmount={topupAmount}
        onTopupAmountChange={setTopupAmount}
        phoneNumber={phoneNumber}
        onPhoneNumberChange={setPhoneNumber}
        onTopup={topupWithCheckout}
        toppingUp={toppingUp}
      />

      <div className="overflow-hidden rounded-[var(--radius-panel)] border border-[color-mix(in_srgb,var(--brand)_22%,#1e293b)] bg-[linear-gradient(180deg,#070b16,#040710)] shadow-[0_22px_62px_rgba(2,6,23,0.55)]">
        <AviatorRoundStage engine={engine} renderNowMs={renderNowMs} burstedFlashUntilMs={burstedFlashUntilMs} lastReward={lastReward} />
        <AviatorBetPanel
          betAmount={betAmount}
          setBetAmount={setBetAmount}
          minBetAmount={engine.minBetAmount}
          onPlaceBet={placeBet}
          placeDisabled={!engine.canPlaceBet || hasActivePendingBet}
          onCashout={cashoutBet}
          cashoutDisabled={!cashoutAllowed}
          placing={loading}
          cashingOut={cashingOut}
        />
      </div>

    </UserAppShell>
  );
}
