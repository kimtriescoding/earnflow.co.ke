import Link from "next/link";

export default function Home() {
  return (
    <div className="page-shell soft-gradient">
      <div className="blob left-6 top-4 h-72 w-72 bg-[color-mix(in_srgb,var(--brand)_78%,transparent)]" />
      <div className="blob right-8 top-20 h-80 w-80 bg-[color-mix(in_srgb,var(--accent)_76%,transparent)]" />
      <div className="blob bottom-10 left-1/2 h-72 w-72 -translate-x-1/2 bg-[color-mix(in_srgb,var(--brand-strong)_64%,transparent)]" />

      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_86%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 md:px-8">
          <Link href="/" className="heading-display bg-[linear-gradient(135deg,var(--brand),var(--accent),var(--accent-strong))] bg-clip-text text-xl font-extrabold tracking-tight text-transparent">
            Earnflow
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            <a href="#services" className="muted-text transition hover:text-[var(--foreground)]">
              Services
            </a>
            <a href="#process" className="muted-text transition hover:text-[var(--foreground)]">
              Process
            </a>
            <a href="#pricing" className="muted-text transition hover:text-[var(--foreground)]">
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="secondary-btn bg-[color-mix(in_srgb,var(--accent)_14%,var(--surface-soft))] px-4 py-2 text-sm">
              Log in
            </Link>
            <Link href="/signup" className="primary-btn px-4 py-2 text-sm">
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className="content-container relative w-full max-w-6xl pb-10 pt-8 md:pt-12">
        <section className="grid gap-[var(--space-section)] lg:grid-cols-[1.2fr_0.8fr]">
          <div className="card-strong neon-outline rounded-[var(--radius-panel)] p-7 md:p-10">
            <span className="inline-flex rounded-full border border-[color-mix(in_srgb,var(--brand)_22%,var(--border))] bg-[color-mix(in_srgb,var(--brand)_12%,var(--surface-soft))] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em]">
              Growth + Delivery Platform
            </span>
            <h1 className="display-title mt-5">
              One platform to grow your reach and outsource execution.
            </h1>
            <p className="mt-5 max-w-2xl text-base muted-text md:text-lg">
              Launch video campaigns, paid chat requests, and academic assignment orders in a single flow. Track every
              request from payment to final delivery inside your client dashboard.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="primary-btn px-5 py-3 text-sm">
                Start free as a client
              </Link>
              <Link href="/client" className="secondary-btn bg-[color-mix(in_srgb,var(--accent-strong)_14%,var(--surface-soft))] px-5 py-3 text-sm">
                Explore client hub
              </Link>
            </div>
          </div>

          <aside className="card-surface neon-outline rounded-[var(--radius-panel)] p-6 md:p-8">
            <p className="eyebrow-label">This week on Earnflow</p>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="rounded-2xl border px-4 py-3 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--brand)_14%,var(--surface-soft)),var(--surface-soft))]">
                <p className="font-semibold text-[var(--foreground)]">Video Promotion</p>
                <p className="muted-text">Reach targets from 10K to 1M views</p>
              </li>
              <li className="rounded-2xl border px-4 py-3 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent)_18%,var(--surface-soft)),var(--surface-soft))]">
                <p className="font-semibold text-[var(--foreground)]">Paid Chat Sessions</p>
                <p className="muted-text">Book hourly async campaign support</p>
              </li>
              <li className="rounded-2xl border px-4 py-3 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent-strong)_16%,var(--surface-soft)),var(--surface-soft))]">
                <p className="font-semibold text-[var(--foreground)]">Assignment Delivery</p>
                <p className="muted-text">Submit specs, review drafts, receive final files</p>
              </li>
            </ul>
          </aside>
        </section>

        <section id="services" className="mt-6 grid gap-[var(--space-section)] md:grid-cols-3">
          <article className="card-surface card-hover rounded-[var(--radius-panel)] p-6">
            <p className="eyebrow-label">Service 01</p>
            <h2 className="heading-display mt-2 text-2xl font-semibold">Video Campaigns</h2>
            <p className="mt-2 text-sm muted-text">Choose your goal, define target views, and monitor rollout in real time.</p>
          </article>
          <article className="card-surface card-hover rounded-[var(--radius-panel)] p-6">
            <p className="eyebrow-label">Service 02</p>
            <h2 className="heading-display mt-2 text-2xl font-semibold">Paid Async Chat</h2>
            <p className="mt-2 text-sm muted-text">Purchase focused chat time for strategy, edits, and campaign support.</p>
          </article>
          <article className="card-surface card-hover rounded-[var(--radius-panel)] p-6">
            <p className="eyebrow-label">Service 03</p>
            <h2 className="heading-display mt-2 text-2xl font-semibold">Academic Orders</h2>
            <p className="mt-2 text-sm muted-text">Place assignment requests with admin quality checks before delivery.</p>
          </article>
        </section>

        <section id="process" className="card-strong neon-outline mt-6 rounded-[var(--radius-panel)] p-7 md:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-xl">
              <p className="eyebrow-label">How it works</p>
              <h2 className="heading-display mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
                Fast workflow, transparent status.
              </h2>
            </div>
            <Link href="/signup" className="secondary-btn w-fit px-5 py-3 text-sm">
              Create account
            </Link>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            {[
              "Pick a service and submit your requirements",
              "Complete secure payment at checkout",
              "Admin reviews and approves your request",
              "Track progress and receive final delivery",
            ].map((step, index) => (
              <div
                key={step}
                className="rounded-2xl border p-4 bg-[color-mix(in_srgb,var(--surface-soft)_94%,transparent)]"
              >
                <p className="eyebrow-label">Step {index + 1}</p>
                <p className="mt-2 text-sm">{step}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" className="mt-6 grid gap-[var(--space-section)] md:grid-cols-2">
          <div className="card-surface rounded-[var(--radius-panel)] p-6 md:p-8">
            <p className="eyebrow-label">Pricing model</p>
            <h3 className="heading-display mt-2 text-3xl font-semibold">Pay per outcome</h3>
            <p className="mt-3 text-sm muted-text">
              Billing is tied to campaign targets, chat duration, or assignment scope. No subscriptions required.
            </p>
          </div>
          <div className="card-surface rounded-[var(--radius-panel)] p-6 md:p-8">
            <p className="eyebrow-label">Support</p>
            <h3 className="heading-display mt-2 text-3xl font-semibold">Managed by admin</h3>
            <p className="mt-3 text-sm muted-text">
              Every order is verified and tracked so clients get consistent quality and predictable turnaround.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t bg-[linear-gradient(90deg,color-mix(in_srgb,var(--brand)_9%,var(--surface)),color-mix(in_srgb,var(--accent)_9%,var(--surface)))]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:flex-row md:items-center md:justify-between md:px-8">
          <div>
            <p className="heading-display bg-[linear-gradient(135deg,var(--brand),var(--accent),var(--accent-strong))] bg-clip-text text-lg font-bold text-transparent">
              Earnflow
            </p>
            <p className="text-sm muted-text">Client services for growth campaigns and managed delivery.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/signup" className="secondary-btn px-4 py-2 text-sm">
              Join now
            </Link>
            <Link href="/login" className="secondary-btn px-4 py-2 text-sm">
              Client login
            </Link>
            <Link href="/client" className="primary-btn px-4 py-2 text-sm">
              Open dashboard
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
