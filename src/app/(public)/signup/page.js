import { Suspense } from "react";
import SignupPageClient from "./SignupPageClient";

function SignupFallback() {
  return (
    <div className="page-shell soft-gradient p-4 md:p-8">
      <div className="blob left-10 top-16 h-56 w-56 bg-[color-mix(in_srgb,var(--brand)_76%,transparent)]" />
      <div className="blob bottom-14 right-8 h-60 w-60 bg-[color-mix(in_srgb,var(--accent)_72%,transparent)]" />
      <div className="relative mx-auto max-w-xl pt-3 md:pt-8">
        <div className="card-strong neon-outline mx-auto w-full max-w-[480px] animate-pulse rounded-[var(--radius-panel)] p-6 md:p-8 lg:max-w-[500px]">
          <div className="mx-auto h-3 w-28 rounded bg-[color-mix(in_srgb,var(--border)_80%,transparent)]" />
          <div className="mx-auto mt-4 h-8 w-64 max-w-full rounded bg-[color-mix(in_srgb,var(--border)_70%,transparent)]" />
          <div className="mx-auto mt-3 h-3 w-full max-w-[280px] rounded bg-[color-mix(in_srgb,var(--border)_65%,transparent)]" />
          <div className="mt-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-10 w-full rounded-xl bg-[color-mix(in_srgb,var(--surface-soft)_95%,var(--border))]"
              />
            ))}
          </div>
          <div className="mx-auto mt-6 h-10 w-full rounded-xl bg-[color-mix(in_srgb,var(--brand)_18%,transparent)]" />
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupFallback />}>
      <SignupPageClient />
    </Suspense>
  );
}
