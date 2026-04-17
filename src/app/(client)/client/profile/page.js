"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/ui/AppShell";
import { clientNavItems } from "@/lib/nav/client-nav";

export default function ClientProfilePage() {
  const [me, setMe] = useState(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data?.success) setMe(data.data);
      })
      .catch(() => {});
  }, []);

  return (
    <AppShell title="Client Profile" navItems={clientNavItems}>
      <div className="card-surface rounded-3xl section-card">
        <h2 className="heading-display text-lg font-semibold">Client account details</h2>
        <p className="mt-1 text-sm muted-text">Manage your contact details used for campaign and order communication.</p>
        <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
          <div className="rounded-2xl border bg-[var(--surface-soft)] p-4">
            <p className="muted-text">Username</p>
            <p className="font-semibold">{me?.username || "-"}</p>
          </div>
          <div className="rounded-2xl border bg-[var(--surface-soft)] p-4">
            <p className="muted-text">Email</p>
            <p className="font-semibold">{me?.email || "-"}</p>
          </div>
          <div className="rounded-2xl border bg-[var(--surface-soft)] p-4">
            <p className="muted-text">Phone</p>
            <p className="font-semibold">{me?.phoneNumber || "-"}</p>
          </div>
          <div className="rounded-2xl border bg-[var(--surface-soft)] p-4">
            <p className="muted-text">Role</p>
            <p className="font-semibold">{me?.role || "-"}</p>
          </div>
          <div className="rounded-2xl border bg-[var(--surface-soft)] p-4">
            <p className="muted-text">Account status</p>
            <p className="font-semibold">{String(me?.accountStatus || "-").replaceAll("_", " ")}</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
