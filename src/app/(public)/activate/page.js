import { Suspense } from "react";
import ActivatePageClient from "./ActivatePageClient";

function ActivateFallback() {
  return (
    <div className="page-shell soft-gradient relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden p-6">
      <div
        className="pointer-events-none absolute left-1/2 top-[38%] h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[color-mix(in_srgb,var(--brand)_18%,transparent)] blur-3xl"
        aria-hidden
      />
      <div className="card-strong neon-outline relative w-full max-w-sm animate-pulse rounded-[var(--radius-panel)] px-8 py-10 text-center shadow-[var(--shadow-strong)]">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-[color-mix(in_srgb,var(--border)_70%,transparent)]" />
        <div className="mx-auto mt-5 h-4 w-40 rounded bg-[color-mix(in_srgb,var(--border)_65%,transparent)]" />
        <div className="mx-auto mt-2 h-3 w-52 rounded bg-[color-mix(in_srgb,var(--border)_60%,transparent)]" />
        <div className="mt-8 h-1.5 w-full rounded-full bg-[color-mix(in_srgb,var(--brand)_10%,var(--border))]" />
      </div>
    </div>
  );
}

export default function ActivatePage() {
  return (
    <Suspense fallback={<ActivateFallback />}>
      <ActivatePageClient />
    </Suspense>
  );
}
