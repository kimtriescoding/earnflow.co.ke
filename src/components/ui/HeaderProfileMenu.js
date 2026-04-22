"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, LogOut, UserRound, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { ROLE } from "@/lib/auth/roles";

export function HeaderProfileMenu({ compact = false }) {
  const [profile, setProfile] = useState({ username: "User", role: "user", impersonatedBy: null });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (data.success) {
          setProfile({
            username: data.data?.username || "User",
            role: data.data?.role || "user",
            impersonatedBy: data.data?.impersonatedBy || null,
          });
        }
      } catch {}
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const initials = useMemo(() => {
    const name = String(profile.username || "U");
    return name.slice(0, 2).toUpperCase();
  }, [profile.username]);

  async function logout() {
    const res = await fetch("/api/auth/logout", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!data.success) {
      toast.error("Unable to log out.");
      return;
    }
    window.location.href = "/login";
  }

  async function endImpersonation() {
    const res = await fetch("/api/auth/impersonation/end", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!data.success) {
      toast.error(data.message || "Unable to end impersonation.");
      return;
    }
    toast.success("Impersonation ended.");
    window.location.href = "/admin/users";
  }

  const profileHref = [ROLE.ADMIN, ROLE.SUPPORT, ROLE.SUPERADMIN].includes(String(profile.role || ""))
    ? "/admin/profile"
    : profile.role === "client"
      ? "/client/profile"
      : "/profile";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-label={compact ? `Account menu (${profile.username})` : undefined}
        className={
          compact
            ? "inline-flex min-h-[2.35rem] items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface-soft)_90%,transparent)] px-1.5 py-1 text-left transition hover:border-[color-mix(in_srgb,var(--brand)_44%,var(--border))] hover:shadow-[0_0_18px_color-mix(in_srgb,var(--brand)_22%,transparent)] sm:min-h-[2.45rem] sm:gap-2 sm:px-2.5 sm:py-1.5"
            : "interactive-control inline-flex min-h-[2.8rem] items-center gap-2 rounded-2xl px-2.5 py-1 text-left sm:px-3 sm:py-1.5"
        }
      >
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--brand)_32%,var(--border))] bg-[color-mix(in_srgb,var(--brand)_14%,var(--surface-soft))] text-[10px] font-semibold text-[var(--foreground)] shadow-[0_0_12px_color-mix(in_srgb,var(--brand)_12%,transparent)] sm:h-8 sm:w-8 sm:text-xs">
          {initials}
        </span>
        <span className={`min-w-0 ${compact ? "max-sm:sr-only" : ""}`}>
          <span className="block max-w-[72px] truncate text-[11px] font-semibold leading-tight sm:max-w-[120px] sm:text-sm sm:leading-normal">
            {profile.username}
          </span>
        </span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform sm:h-4 sm:w-4 ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="card-strong neon-outline absolute right-0 z-50 mt-2 w-56 rounded-2xl p-2 shadow-xl">
          <Link
            href={profileHref}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition hover:bg-[var(--surface-soft)]"
          >
            <UserRound size={16} />
            Profile
          </Link>
          {profile.impersonatedBy ? (
            <button
              type="button"
              onClick={endImpersonation}
              className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition hover:bg-[var(--surface-soft)]"
            >
              <Undo2 size={16} />
              End impersonation
            </button>
          ) : null}
          <button
            type="button"
            onClick={logout}
            className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition hover:bg-[var(--surface-soft)]"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      ) : null}
    </div>
  );
}
