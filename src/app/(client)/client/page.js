"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/ui/AppShell";
import { StatCard } from "@/components/ui/StatCard";
import { clientNavItems } from "@/lib/nav/client-nav";

export default function ClientOverviewPage() {
  const [summary, setSummary] = useState({
    totalOrders: 0,
    pendingApproval: 0,
    approvedCampaigns: 0,
    paidOrders: 0,
    totalSpend: 0,
  });

  useEffect(() => {
    fetch("/api/client/summary")
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) return;
        setSummary({
          totalOrders: Number(data.data?.totalOrders || 0),
          pendingApproval: Number(data.data?.pendingApproval || 0),
          approvedCampaigns: Number(data.data?.approvedCampaigns || 0),
          paidOrders: Number(data.data?.paidOrders || 0),
          totalSpend: Number(data.data?.totalSpend || 0),
        });
      })
      .catch(() => {});
  }, []);

  return (
    <AppShell
      title="Client Services Hub"
      navItems={clientNavItems}
      rightSlot={
        <Link href="/client/videos" className="primary-btn neon-ring px-4 py-2 text-sm">
          New campaign
        </Link>
      }
    >
      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Total Orders" value={String(summary.totalOrders)} />
        <StatCard label="Paid Orders" value={String(summary.paidOrders)} tone="success" />
        <StatCard label="Pending Approval" value={String(summary.pendingApproval)} tone="danger" />
        <StatCard label="Approved Campaigns" value={String(summary.approvedCampaigns)} />
      </div>
      <div className="grid gap-[var(--space-section)] md:grid-cols-2">
        <div className="card-surface neon-outline rounded-[var(--radius-panel)] section-card">
          <h2 className="section-title">Total spend</h2>
          <p className="mt-2 heading-display text-3xl font-semibold">KES {summary.totalSpend.toFixed(2)}</p>
          <p className="mt-1 text-sm muted-text">Across videos, chat requests, and academic orders.</p>
        </div>
        <div className="card-surface neon-outline rounded-[var(--radius-panel)] section-card">
          <h2 className="section-title">Next actions</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/client/videos" className="secondary-btn px-3.5 py-2 text-sm">
              Promote a video
            </Link>
            <Link href="/client/chat" className="secondary-btn px-3.5 py-2 text-sm">
              Start chat request
            </Link>
            <Link href="/client/academic" className="secondary-btn px-3.5 py-2 text-sm">
              Order assignment
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
