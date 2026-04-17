"use client";

import { useMemo } from "react";

const AVIATOR_GROWTH_K = 0.0002;
const CHART_MAX_X = 94;
const END_REACH_BURST = 10;
const PLANE_NOSE_X_PERCENT = 93.6;
const PLANE_NOSE_Y_PERCENT = 45.8;
const PLANE_TIP_X_OFFSET = 5.5;
const PLANE_TIP_Y_OFFSET = -6;

export function AviatorRoundStage({ engine, renderNowMs, burstedFlashUntilMs, lastReward = 0 }) {
  const historyMultipliers = useMemo(
    () =>
      (engine.history || [])
        .map((item) => Number(item.bustAt || 0))
        .filter((value) => Number.isFinite(value) && value > 0)
        .slice(0, 14),
    [engine.history]
  );

  const animatedMultiplier = useMemo(() => {
    if (engine.phase === "betting" || engine.phase === "locked") return 1;
    if (engine.phase === "crashed") return Number(engine.bustAt || engine.multiplier || 1);

    const flightStartMs = Number(engine.flightStartMs || 0);
    if (!flightStartMs) return Number(engine.multiplier || 1);

    const elapsedFlightMs = Math.max(0, renderNowMs - flightStartMs);
    const live = Math.exp(AVIATOR_GROWTH_K * elapsedFlightMs);
    const cap = Number(engine.bustAt || live);
    return Math.min(live, cap);
  }, [engine.bustAt, engine.flightStartMs, engine.multiplier, engine.phase, renderNowMs]);

  const liveCountdownMs = useMemo(() => {
    if (engine.phase === "betting") {
      const roundStartMs = Number(engine.roundStartMs || 0);
      const bettingOpenMs = Number(engine.bettingOpenMs || 10000);
      if (roundStartMs > 0) return Math.max(0, roundStartMs + bettingOpenMs - renderNowMs);
    } else if (engine.phase === "locked") {
      const roundStartMs = Number(engine.roundStartMs || 0);
      const bettingMs = Number(engine.bettingMs || 15000);
      if (roundStartMs > 0) return Math.max(0, roundStartMs + bettingMs - renderNowMs);
    } else if (engine.phase === "flying") {
      const flightStartMs = Number(engine.flightStartMs || 0);
      const crashAtMs = Number(engine.crashAtMs || 0);
      if (flightStartMs > 0 && crashAtMs > 0) return Math.max(0, flightStartMs + crashAtMs - renderNowMs);
    } else {
      const roundStartMs = Number(engine.roundStartMs || 0);
      const roundDurationMs = Number(engine.roundDurationMs || 0);
      if (roundStartMs > 0 && roundDurationMs > 0) return Math.max(0, roundStartMs + roundDurationMs - renderNowMs);
    }
    return Math.max(0, Number(engine.timeToNextPhaseMs || 0));
  }, [engine.bettingMs, engine.crashAtMs, engine.phase, engine.roundDurationMs, engine.roundStartMs, engine.timeToNextPhaseMs, engine.flightStartMs, renderNowMs]);

  const chartSeries = useMemo(() => {
    const liveMultiplier = Number(animatedMultiplier || 1);
    const targetBust = Number(engine.bustAt || historyMultipliers[0] || 2);
    const graphEnd = engine.phase === "flying" ? liveMultiplier : targetBust;
    const curvature = 2.2;
    const points = [];
    for (let i = 0; i <= 24; i += 1) {
      const t = i / 24;
      const y = Math.min(1, (Math.exp(t * curvature) - 1) / (Math.exp(curvature) - 1));
      points.push({ x: t, y });
      points[i].multiplier = Number((1 + y * (graphEnd - 1)).toFixed(2));
    }
    return points;
  }, [animatedMultiplier, engine.bustAt, engine.phase, historyMultipliers]);

  const chartXScale = useMemo(() => {
    const burst = Math.max(1.01, Number(engine.bustAt || historyMultipliers[0] || 2));
    if (burst >= END_REACH_BURST) return 1;
    const ratio = Math.log(burst) / Math.log(END_REACH_BURST);
    const eased = Math.pow(Math.max(0, ratio), 0.75);
    return Math.max(0.5, Math.min(1, eased));
  }, [engine.bustAt, historyMultipliers]);

  const flightProgress = useMemo(() => {
    if (engine.phase === "crashed") return 1;
    if (engine.phase !== "flying") return 0;
    const flightStartMs = Number(engine.flightStartMs || 0);
    const crashAtMs = Number(engine.crashAtMs || 0);
    if (!flightStartMs || crashAtMs < 0) return 0;
    if (crashAtMs === 0) return 1;
    return Math.max(0, Math.min(1, (renderNowMs - flightStartMs) / crashAtMs));
  }, [engine.crashAtMs, engine.flightStartMs, engine.phase, renderNowMs]);

  const visibleChartPoints = useMemo(() => {
    if (!chartSeries.length) return [];
    if (engine.phase === "betting" || engine.phase === "locked") return [chartSeries[0]];

    const visibleCount = Math.max(2, Math.ceil(flightProgress * (chartSeries.length - 1)) + 1);
    const points = chartSeries.slice(0, visibleCount);
    if (flightProgress > 0 && flightProgress < 1) {
      const next = chartSeries[Math.min(chartSeries.length - 1, visibleCount)];
      const prev = chartSeries[visibleCount - 1];
      if (next && prev) {
        const localT = flightProgress * (chartSeries.length - 1) - (visibleCount - 2);
        points[points.length - 1] = {
          x: prev.x + (next.x - prev.x) * localT,
          y: prev.y + (next.y - prev.y) * localT,
        };
      }
    }
    return points;
  }, [chartSeries, engine.phase, flightProgress]);

  const chartPath = useMemo(() => {
    if (!visibleChartPoints.length) return "";
    return visibleChartPoints
      .map((p, idx) => {
        const x = Number((p.x * CHART_MAX_X * chartXScale).toFixed(2));
        const y = Number((92 - p.y * 78).toFixed(2));
        return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  }, [chartXScale, visibleChartPoints]);

  const chartFillPath = useMemo(() => {
    if (!visibleChartPoints.length) return "";
    const tip = visibleChartPoints[visibleChartPoints.length - 1];
    const tipX = Number((tip.x * CHART_MAX_X * chartXScale).toFixed(2));
    return `${chartPath} L ${tipX} 100 L 0 100 Z`;
  }, [chartPath, chartXScale, visibleChartPoints]);

  const planeTip = useMemo(() => {
    if (!visibleChartPoints.length) return null;
    const tip = visibleChartPoints[visibleChartPoints.length - 1];
    const prev = visibleChartPoints.length > 1 ? visibleChartPoints[visibleChartPoints.length - 2] : tip;
    const rawX = Number((tip.x * CHART_MAX_X * chartXScale).toFixed(2));
    const rawY = Number((92 - tip.y * 78).toFixed(2));
    const prevX = Number((prev.x * CHART_MAX_X * chartXScale).toFixed(2));
    const prevY = Number((92 - prev.y * 78).toFixed(2));

    const clampedX = Math.max(3, Math.min(95, rawX + PLANE_TIP_X_OFFSET));
    const clampedY = Math.max(8, Math.min(92, rawY + PLANE_TIP_Y_OFFSET));

    const rawAngle = Math.atan2(rawY - prevY, rawX - prevX) * (180 / Math.PI);
    const dampedAngle = rawAngle * 0.25;
    const angleDeg = Math.max(-4, Math.min(6, Number(dampedAngle.toFixed(2))));
    return {
      left: `${clampedX}%`,
      top: `${clampedY}%`,
      angleDeg,
    };
  }, [chartXScale, visibleChartPoints]);

  const currentMultiplier = Number(animatedMultiplier || 1).toFixed(2);
  const countdown = liveCountdownMs;
  const countdownSeconds = Math.max(0, countdown / 1000);
  const countdownDisplay =
    engine.phase === "betting" || engine.phase === "locked" || engine.phase === "crashed" ? Math.ceil(countdownSeconds) : countdownSeconds.toFixed(1);
  const countdownLabel =
    engine.phase === "betting" ? "PLACE BETS IN" : engine.phase === "locked" ? "ROUND STARTS IN" : engine.phase === "crashed" ? "PLACE BETS IN" : "";
  const showBursted = engine.phase === "crashed" || renderNowMs < burstedFlashUntilMs;
  const phaseText = showBursted ? "BURSTED!" : engine.phase === "flying" ? "IN FLIGHT" : engine.phase === "locked" ? "BETS LOCKED" : "PLACE YOUR BETS";
  const stageMultiplierClass = showBursted ? "text-rose-500" : "text-white";

  return (
    <div className="overflow-hidden rounded-[var(--radius-panel)] border border-slate-700/70 bg-[#06080f]">
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-800/90 px-3 py-2">
        {historyMultipliers.length ? (
          historyMultipliers.map((value, idx) => (
            <span key={`${value}-${idx}`} className={`shrink-0 px-1 text-xs font-semibold ${value >= 2 ? "text-fuchsia-400" : "text-sky-400"}`}>
              {value.toFixed(2)}x
            </span>
          ))
        ) : (
          <p className="text-sm text-slate-400">No rounds yet.</p>
        )}
      </div>
      <div className="relative border-b border-slate-900 bg-[repeating-linear-gradient(-22deg,rgba(255,255,255,0.03)_0px,rgba(255,255,255,0.03)_28px,transparent_28px,transparent_68px)] p-2">
        <p className={`pointer-events-none absolute left-0 right-0 top-4 text-center tracking-wide ${showBursted ? "animate-bounce text-5xl font-extrabold text-rose-500" : "text-3xl font-light text-white/85"}`}>
          {phaseText}
        </p>
        <div className="relative mt-12 h-[270px] rounded-2xl border border-slate-700/65 bg-[linear-gradient(180deg,#070b14,#05070f)]">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
            <defs>
              <linearGradient id="aviatorLineStrong" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%" stopColor="#ff305f" />
                <stop offset="100%" stopColor="#ff0e44" />
              </linearGradient>
            </defs>
            <path d={chartFillPath} fill="rgba(255,0,64,0.25)" />
            <path d={chartPath} fill="none" stroke="url(#aviatorLineStrong)" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          {planeTip ? (
            <div
              className="pointer-events-none absolute"
              style={{
                left: planeTip.left,
                top: planeTip.top,
              }}
            >
              <div
                className="relative h-10 w-[90px] drop-shadow-[0_0_10px_rgba(255,48,95,0.45)]"
                style={{
                  transform: `translate(-${PLANE_NOSE_X_PERCENT}%, -${PLANE_NOSE_Y_PERCENT}%) rotate(${planeTip.angleDeg - 1}deg)`,
                  transformOrigin: `${PLANE_NOSE_X_PERCENT}% ${PLANE_NOSE_Y_PERCENT}%`,
                }}
              >
                <img src="/aviator-plane.png" alt="" className="h-full w-full select-none object-contain" draggable={false} />
              </div>
            </div>
          ) : null}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className={`heading-display text-6xl font-bold ${stageMultiplierClass}`}>{currentMultiplier}x</p>
            <p className="mt-2 text-sm text-slate-300">Round #{engine.roundId}</p>
            {engine.phase === "betting" || engine.phase === "locked" || engine.phase === "crashed" ? (
              <p className="mt-1 text-base font-extrabold tracking-wide text-white">
                {countdownLabel}: {countdownDisplay}s
              </p>
            ) : null}
            <p className="text-xs text-slate-400">Last payout: KES {Number(lastReward || 0).toFixed(2)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
