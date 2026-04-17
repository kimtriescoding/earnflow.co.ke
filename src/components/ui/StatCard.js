import { AlertTriangle, Sparkles, Sun, TrendingUp } from "lucide-react";

export function StatCard({ label, value, hint, tone = "default", compact = false }) {
  const toneClass = tone === "danger" ? "text-rose-50" : "text-white";
  const Icon =
    tone === "amber"
      ? Sun
      : tone === "success"
        ? TrendingUp
        : tone === "danger"
          ? AlertTriangle
          : Sparkles;
  const toneSurface =
    tone === "amber"
      ? "bg-[linear-gradient(155deg,#b45309_0%,#d97706_100%)]"
      : tone === "success"
        ? "bg-[linear-gradient(155deg,#0d9488_0%,#14b8a6_100%)]"
        : tone === "danger"
          ? "bg-[linear-gradient(155deg,#be123c_0%,#e11d48_100%)]"
          : "bg-[linear-gradient(165deg,#0f766e_0%,#115e59_100%)]";

  const shell = compact
    ? `card-hover relative min-h-[88px] overflow-hidden rounded-xl border border-white/24 p-3 py-2.5 shadow-md sm:min-h-[118px] sm:rounded-[var(--radius-panel)] sm:p-4 sm:py-3.5 sm:shadow-xl md:min-h-[124px] md:p-[1.05rem] md:py-4 ${toneSurface}`
    : `card-hover relative min-h-[104px] overflow-hidden rounded-2xl border border-white/24 p-3.5 py-3 shadow-lg sm:min-h-[118px] sm:rounded-[var(--radius-panel)] sm:p-4 sm:py-3.5 sm:shadow-xl md:min-h-[124px] md:p-[1.05rem] md:py-4 ${toneSurface}`;

  const valueClass = compact
    ? `mt-1.5 break-words heading-display text-base font-semibold leading-tight tracking-tight sm:mt-2.5 sm:text-xl sm:leading-none md:text-[1.65rem] ${toneClass}`
    : `mt-2 break-words heading-display text-lg font-semibold leading-tight tracking-tight sm:mt-2.5 sm:text-xl sm:leading-none md:text-[1.65rem] ${toneClass}`;

  const hintClass = compact
    ? "mt-1 line-clamp-3 text-[10px] leading-snug text-white/78 sm:mt-2 sm:text-xs sm:leading-relaxed sm:text-white/85"
    : "mt-1.5 line-clamp-3 text-[11px] leading-snug text-white/78 sm:mt-2 sm:text-xs sm:leading-relaxed sm:text-white/85";

  const iconWrap = compact
    ? `inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/30 bg-white/18 sm:h-8 sm:w-8 sm:rounded-xl ${toneClass}`
    : `inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/30 bg-white/18 sm:h-8 sm:w-8 sm:rounded-xl ${toneClass}`;

  const iconSize = compact ? 14 : 15;

  return (
    <article className={shell}>
      <div className="pointer-events-none absolute -right-7 -top-6 h-[4.25rem] w-[4.25rem] rounded-full bg-white/20 blur-2xl sm:h-24 sm:w-24 sm:blur-3xl" />
      <div className="pointer-events-none absolute -left-9 bottom-0 h-[3.75rem] w-[3.75rem] rounded-full bg-cyan-300/14 blur-2xl sm:h-[4.25rem] sm:w-[4.25rem]" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-14 w-full bg-[linear-gradient(0deg,rgba(255,255,255,0.1),transparent_68%)] sm:h-[4.5rem]" />
      <div className="flex items-start justify-between gap-2 sm:items-center">
        <p
          className={`min-w-0 flex-1 uppercase leading-snug text-white/80 sm:tracking-[0.14em] ${compact ? "text-[9px] tracking-[0.11em] sm:text-[11px]" : "text-[10px] tracking-[0.13em] sm:text-[11px]"}`}
        >
          {label}
        </p>
        <span className={iconWrap}>
          <Icon size={iconSize} />
        </span>
      </div>
      <p className={valueClass}>{value}</p>
      {hint ? <p className={hintClass}>{hint}</p> : null}
    </article>
  );
}
