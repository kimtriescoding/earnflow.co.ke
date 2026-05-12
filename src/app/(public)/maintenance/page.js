export const metadata = {
  title: "Maintenance | Earnflow Agencies",
  description: "We are performing scheduled maintenance. Please check back soon.",
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return (
    <div className="page-shell soft-gradient flex min-h-full flex-1 flex-col items-center justify-center p-6 md:p-10">
      <div className="blob left-8 top-16 h-52 w-52 bg-[color-mix(in_srgb,var(--accent)_74%,transparent)]" />
      <div className="blob bottom-12 right-10 h-56 w-56 bg-[color-mix(in_srgb,var(--brand)_78%,transparent)]" />
      <div className="relative mx-auto w-full max-w-lg text-center">
        <div className="card-strong neon-outline rounded-[var(--radius-panel)] p-8 md:p-10">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-[color-mix(in_srgb,var(--brand)_88%,var(--foreground))]">
            Earnflow Agencies
          </p>
          <h1 className="font-display mt-3 text-2xl font-semibold tracking-tight text-[var(--foreground)] md:text-3xl">
            We will be right back
          </h1>
          <p className="mt-4 text-pretty text-[var(--muted)]">
            The site is temporarily unavailable while we perform maintenance. Thank you for your patience.
          </p>
        </div>
      </div>
    </div>
  );
}
