"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/ui/AppShell";
import { adminNavItems } from "@/lib/nav/admin-nav";

export default function AdminProfilePage() {
  const [profile, setProfile] = useState({ username: "-", email: "-", role: "-" });

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const res = await fetch("/api/auth/me");
      const data = await res.json().catch(() => ({}));
      if (data.success) setProfile(data.data || {});
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <AppShell title="Profile" navItems={adminNavItems}>
      <section className="card-surface rounded-3xl p-6">
        <h2 className="heading-display text-lg font-semibold">Admin profile</h2>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <p className="interactive-control rounded-2xl px-3 py-2.5">
            <span className="mr-2 muted-text">Username:</span>
            <span className="font-semibold">{profile.username || "-"}</span>
          </p>
          <p className="interactive-control rounded-2xl px-3 py-2.5">
            <span className="mr-2 muted-text">Email:</span>
            <span className="font-semibold">{profile.email || "-"}</span>
          </p>
          <p className="interactive-control rounded-2xl px-3 py-2.5">
            <span className="mr-2 muted-text">Role:</span>
            <span className="font-semibold uppercase">{profile.role || "-"}</span>
          </p>
        </div>
      </section>
    </AppShell>
  );
}
