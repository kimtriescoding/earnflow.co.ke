"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";

/** Rich jewel tones — each segment uses a light → dark pair for depth */
const SEGMENT_PAIRS = [
  ["#34d399", "#059669"],
  ["#60a5fa", "#2563eb"],
  ["#5eead4", "#0f766e"],
  ["#fb7185", "#db2777"],
  ["#fb923c", "#ea580c"],
  ["#22d3ee", "#0891b2"],
  ["#a3e635", "#65a30d"],
  ["#f472b6", "#be185d"],
  ["#fbbf24", "#d97706"],
  ["#2dd4bf", "#0d9488"],
  ["#99f6e4", "#115e59"],
  ["#f87171", "#b91c1c"],
];

const DEFAULT_WHEEL_PX = 300;
const BEZEL_PX = 11;
const DIVIDER_DEG = 0.85;

function buildWheelBackground(sliceCount) {
  const step = 360 / sliceCount;
  const slices = Array.from({ length: sliceCount }, (_, idx) => {
    const start = idx * step;
    const mid = start + step * 0.42;
    const divStart = start + step - DIVIDER_DEG;
    const end = (idx + 1) * step;
    const [light, dark] =
      idx === 0 ? ["#cbd5e1", "#475569"] : SEGMENT_PAIRS[(idx - 1) % SEGMENT_PAIRS.length];
    return `${light} ${start}deg ${mid}deg, ${dark} ${mid}deg ${divStart}deg, rgba(255, 250, 220, 0.92) ${divStart}deg ${end}deg`;
  });
  return `conic-gradient(from 0deg at 50% 50%, ${slices.join(", ")})`;
}

export function LuckySpinWheel({ segmentCount, wheelRotation, loading, onActivate, disabled }) {
  const containerRef = useRef(null);
  const [wheelPx, setWheelPx] = useState(DEFAULT_WHEEL_PX);
  const innerPx = wheelPx - BEZEL_PX * 2;
  const sliceCount = segmentCount + 1;
  const labelValues = useMemo(() => Array.from({ length: sliceCount }, (_, idx) => idx), [sliceCount]);
  const labelRadius = (innerPx / 2) * 0.62;
  const rivetAngles = useMemo(() => Array.from({ length: 12 }, (_, i) => i * 30), []);
  const interactive = Boolean(onActivate);
  const spinBlocked = Boolean(loading || disabled);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setWheelPx(Math.round(w));
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  function handleActivate() {
    if (!onActivate || spinBlocked) return;
    onActivate();
  }

  function handleKeyDown(e) {
    if (!interactive || spinBlocked) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleActivate();
    }
  }

  return (
    <div
      ref={containerRef}
      className={`relative mx-auto flex w-full max-w-[min(300px,calc(100vw-2rem))] flex-col items-center aspect-square touch-manipulation outline-none transition-[box-shadow] focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] ${interactive && !spinBlocked ? "cursor-pointer active:opacity-95" : ""} ${interactive ? "" : "cursor-default"}`}
      style={{ width: "100%" }}
      role={interactive ? "button" : "img"}
      tabIndex={interactive && !spinBlocked ? 0 : undefined}
      aria-label={
        interactive
          ? `Spin the lucky wheel. Segments 0× through ${segmentCount}×. Tap, or press Enter or Space, to spin.`
          : `Lucky spin wheel with 0× through ${segmentCount}×`
      }
      aria-busy={loading}
      aria-disabled={interactive ? spinBlocked : undefined}
      onClick={interactive ? handleActivate : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
    >
      {/* Ambient glow */}
      <div
        className={`pointer-events-none absolute inset-0 scale-[1.12] rounded-full bg-[conic-gradient(from_210deg,var(--brand),var(--brand-strong),var(--brand))] opacity-[0.14] blur-3xl transition-opacity duration-500 ${loading ? "opacity-[0.22] motion-safe:animate-pulse" : ""}`}
        aria-hidden
      />

      {/* Gold / chrome outer bezel */}
      <div
        className="absolute inset-0 rounded-full p-[11px] shadow-[0_22px_50px_-12px_rgba(0,0,0,0.45),inset_0_2px_0_rgba(255,255,255,0.45),inset_0_-3px_8px_rgba(0,0,0,0.35)]"
        style={{
          background: "linear-gradient(145deg, #fef9c3 0%, #eab308 45%, #713f12 100%)",
        }}
        aria-hidden
      >
        <div
          className="relative h-full w-full rounded-full"
          style={{
            boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.25), inset 0 4px 12px rgba(255,255,255,0.15), inset 0 -6px 16px rgba(0,0,0,0.4)",
          }}
        >
          {/* Rivets */}
          {rivetAngles.map((deg) => (
            <span
              key={deg}
              className="pointer-events-none absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-amber-100 to-amber-900 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),0_1px_2px_rgba(0,0,0,0.5)]"
              style={{
                transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(calc(-${wheelPx / 2 - 4}px))`,
              }}
              aria-hidden
            />
          ))}

          {/* Rotating face */}
          <div
            className={`absolute left-1/2 top-1/2 overflow-hidden rounded-full shadow-[inset_0_0_50px_rgba(0,0,0,0.28),inset_0_-12px_30px_rgba(0,0,0,0.18),inset_0_10px_24px_rgba(255,255,255,0.12)] ${loading ? "ease-out" : "ease-in-out"}`}
            style={{
              width: innerPx,
              height: innerPx,
              marginLeft: -innerPx / 2,
              marginTop: -innerPx / 2,
              background: buildWheelBackground(sliceCount),
              transform: `rotate(${wheelRotation}deg)`,
              transitionDuration: loading ? "3600ms" : "500ms",
              transitionTimingFunction: loading ? "cubic-bezier(0.15, 0.8, 0.2, 1)" : "ease",
            }}
          >
            {/* Specular highlight arc */}
            <div
              className="pointer-events-none absolute inset-0 rounded-full opacity-35"
              style={{
                background:
                  "linear-gradient(125deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.08) 35%, transparent 55%, transparent 100%)",
              }}
              aria-hidden
            />

            {labelValues.map((value, idx) => {
              const angle = (360 / sliceCount) * idx;
              return (
                <span
                  key={`${value}-${idx}`}
                  className={`absolute left-1/2 top-1/2 select-none text-[13px] font-extrabold tracking-tight ${value === 0 ? "text-slate-900" : "text-white"}`}
                  style={{
                    textShadow:
                      value === 0
                        ? "0 1px 0 rgba(255,255,255,0.5), 0 0 10px rgba(255,255,255,0.35)"
                        : "0 1px 0 rgba(0,0,0,0.45), 0 0 12px rgba(0,0,0,0.35)",
                    transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-${labelRadius}px) rotate(${-angle}deg)`,
                  }}
                >
                  {value}×
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pointer — high contrast above bezel; must sit above hub (z-40) */}
      <div className="pointer-events-none absolute left-1/2 z-40 -translate-x-1/2" style={{ top: -6 }} aria-hidden>
        <div className="relative flex max-sm:scale-110 flex-col items-center drop-shadow-[0_4px_0_rgba(0,0,0,0.35),0_10px_18px_rgba(0,0,0,0.55)]">
          <div
            className="h-0 w-0 border-l-[18px] border-r-[18px] border-t-[34px] border-l-transparent border-r-transparent"
            style={{ borderTopColor: "#0f172a" }}
          />
          <div
            className="absolute left-1/2 top-[3px] h-0 w-0 -translate-x-1/2 border-l-[12px] border-r-[12px] border-t-[24px] border-l-transparent border-r-transparent"
            style={{ borderTopColor: "#e11d48" }}
          />
          <div
            className="absolute left-1/2 top-[6px] h-0 w-0 -translate-x-1/2 border-l-[8px] border-r-[8px] border-t-[16px] border-l-transparent border-r-transparent"
            style={{ borderTopColor: "#fecdd3" }}
          />
        </div>
      </div>

      {/* Center hub */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 h-[52px] w-[52px] -translate-x-1/2 -translate-y-1/2" aria-hidden>
        <div
          className="flex h-full w-full items-center justify-center rounded-full border-2 border-amber-200/90 shadow-[0_8px_24px_rgba(0,0,0,0.35),inset_0_2px_6px_rgba(255,255,255,0.55),inset_0_-4px_10px_rgba(0,0,0,0.25)]"
          style={{
            background:
              "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.95) 0%, rgba(250,204,21,0.35) 18%, var(--brand) 45%, var(--brand-strong) 100%)",
          }}
        >
          <span className="text-lg leading-none text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.55)]" aria-hidden>
            ★
          </span>
        </div>
      </div>
    </div>
  );
}
