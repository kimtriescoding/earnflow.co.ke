"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListTodo,
  PlayCircle,
  MessageCircle,
  Gamepad2,
  CircleDot,
  Rocket,
  GraduationCap,
  Wallet,
  UserCircle,
  Users,
  Settings,
  Shield,
  BarChart3,
  Network,
  Boxes,
  CreditCard,
  ArrowLeftRight,
} from "lucide-react";

const iconMap = {
  dashboard: LayoutDashboard,
  transactions: ArrowLeftRight,
  tasks: ListTodo,
  videos: PlayCircle,
  chat: MessageCircle,
  games: Gamepad2,
  luckySpin: CircleDot,
  aviator: Rocket,
  academic: GraduationCap,
  withdrawals: Wallet,
  profile: UserCircle,
  users: Users,
  config: Settings,
  admin: Shield,
  analytics: BarChart3,
  referrals: Network,
  modules: Boxes,
  payments: CreditCard,
};

export function Sidebar({ items = [], onNavigate, collapsed = false }) {
  const pathname = usePathname();
  const normalizedPath = (pathname || "/").replace(/\/+$/, "") || "/";
  const activeHref =
    items
      .filter((item) => {
        const href = (item.href || "/").replace(/\/+$/, "") || "/";
        return normalizedPath === href || normalizedPath.startsWith(`${href}/`);
      })
      .sort((a, b) => b.href.length - a.href.length)[0]?.href || null;

  return (
    <nav className="space-y-1.5">
      {items.map((item) => {
        const active = item.href === activeHref;
        const Icon = iconMap[item.icon] || LayoutDashboard;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => onNavigate?.()}
            title={collapsed ? item.label : undefined}
            aria-label={collapsed ? item.label : undefined}
            className={`group flex min-h-12 items-center rounded-2xl px-3 py-2.5 text-sm transition-all duration-200 ${
              active
                ? "neon-chip font-semibold text-[var(--foreground)] shadow-[0_8px_20px_rgba(15,118,110,0.14)]"
                : "text-[var(--muted)] hover:bg-[color-mix(in_srgb,var(--brand)_16%,transparent)] hover:text-[var(--foreground)]"
            }`}
          >
            <span className={`flex min-w-0 items-center gap-3 ${collapsed ? "w-full justify-center" : ""}`}>
              <span
                className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border transition duration-200 ${
                  active
                    ? "border-[color-mix(in_srgb,var(--brand)_52%,var(--border))] bg-[color-mix(in_srgb,var(--brand)_24%,transparent)] text-[var(--accent)] shadow-[0_0_16px_color-mix(in_srgb,var(--brand)_35%,transparent)]"
                    : "border-[var(--border)] bg-[color-mix(in_srgb,var(--surface-soft)_90%,transparent)] group-hover:border-[color-mix(in_srgb,var(--brand)_36%,var(--border))] group-hover:text-[var(--accent)]"
                }`}
              >
                <Icon size={17} />
              </span>
              {collapsed ? null : <span className="truncate">{item.label}</span>}
            </span>
            {!collapsed && item.badge ? (
              <span className="rounded-full bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] px-2.5 py-1 text-xs font-semibold text-[var(--brand)]">
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
