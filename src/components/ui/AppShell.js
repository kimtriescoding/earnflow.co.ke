"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { HeaderProfileMenu } from "./HeaderProfileMenu";

export function AppShell({ title, navItems, children, rightSlot, compactSidebar = false, hideHeader = false }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="page-shell soft-gradient">
      <div className="blob left-0 top-0 h-64 w-64 bg-[color-mix(in_srgb,var(--brand)_38%,transparent)]" />
      <div className="blob bottom-4 right-8 h-72 w-72 bg-[color-mix(in_srgb,var(--accent)_36%,transparent)]" />

      <div className="content-container flex items-center justify-between pt-4 md:hidden">
        <Link href="/login" className="heading-display text-lg font-bold gradient-text">
          Earnflow Agencies
        </Link>
        <button
          className="secondary-btn inline-flex h-11 items-center justify-center px-3 text-sm"
          onClick={() => setOpen((p) => !p)}
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm md:hidden" onClick={() => setOpen(false)}>
          <div className="h-full w-[316px] p-3.5" onClick={(e) => e.stopPropagation()}>
            <aside className="card-strong neon-outline flex h-full min-h-0 flex-col rounded-[calc(var(--radius-panel)+0.2rem)] p-[1.125rem]">
              <div className="mb-6 px-2.5">
                <p className="eyebrow-label">Workspace</p>
                <Link href="/login" className="heading-display mt-1 block text-xl font-semibold tracking-tight gradient-text">
                  Earnflow Agencies
                </Link>
                <p className="mt-1 text-sm muted-text">Growth and earnings command center</p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1.5">
                <Sidebar items={navItems} onNavigate={() => setOpen(false)} />
              </div>
            </aside>
          </div>
        </div>
      ) : null}

      <div
        className={`content-container grid min-h-screen grid-cols-1 gap-[var(--space-section)] py-4 md:py-6 ${
          compactSidebar ? "md:grid-cols-[84px_1fr]" : "md:grid-cols-[292px_1fr]"
        }`}
      >
        <aside
          className={`card-strong neon-outline hidden rounded-[var(--radius-panel)] p-4 md:sticky md:top-5 md:flex md:h-[calc(100vh-2.5rem)] md:min-h-0 md:flex-col ${
            compactSidebar ? "md:px-2.5" : ""
          }`}
        >
          {compactSidebar ? null : (
            <div className="mb-6 px-2.5">
              <p className="eyebrow-label">Workspace</p>
              <Link href="/login" className="heading-display mt-1 block text-xl font-semibold tracking-tight gradient-text">
                Earnflow Agencies
              </Link>
              <p className="mt-1 text-sm muted-text">Growth and earnings command center</p>
            </div>
          )}
          <div className={`min-h-0 overflow-y-auto overscroll-contain ${compactSidebar ? "" : "pr-1.5 md:h-[calc(100%-5rem)]"}`}>
            <Sidebar items={navItems} collapsed={compactSidebar} />
          </div>
        </aside>
        <main className="flex flex-col gap-[var(--space-section)] pb-8">
          {hideHeader ? null : (
            <header className="glass-bar neon-outline relative z-30 flex min-h-0 flex-row items-center justify-between gap-2 rounded-2xl px-3 py-2.5 lg:rounded-[var(--radius-panel)] lg:gap-3 lg:px-5 lg:py-2.5 xl:px-6">
              <div className="min-w-0 flex-1 pr-2">
                <h1 className="heading-display m-0 max-w-full text-balance text-[0.95rem] font-semibold leading-snug tracking-tight gradient-text lg:text-lg xl:text-[1.22rem]">
                  {title}
                </h1>
              </div>
              <div className="flex shrink-0 items-center justify-end gap-2">
                {rightSlot}
                <HeaderProfileMenu compact />
              </div>
            </header>
          )}
          <section className="flex flex-col gap-3 sm:gap-[var(--space-section)]">{children}</section>
        </main>
      </div>
    </div>
  );
}
