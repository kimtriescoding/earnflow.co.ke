"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/ui/AppShell";
import { clientNavItems } from "@/lib/nav/client-nav";
import { StatusChip } from "@/components/ui/StatusChip";

export default function ClientVideosPage() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ title: "", description: "", videoUrl: "", targetViews: "1000", phoneNumber: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/client/videos/orders");
    const data = await res.json();
    if (data.success) setRows(data.data || []);
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/client/videos/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, targetViews: Number(form.targetViews || 0) }),
    });
    const data = await res.json();
    setSaving(false);
    if (!data.success) {
      toast.error(data.message || "Unable to create video campaign");
      return;
    }
    toast.success("Campaign created. Complete payment to send for approval.");
    if (data.data?.checkoutUrl) window.location.href = data.data.checkoutUrl;
    await load();
  }

  return (
    <AppShell title="Video Promotion Orders" navItems={clientNavItems}>
      <div className="card-surface neon-outline rounded-3xl section-card">
        <h2 className="section-title">Create video promotion campaign</h2>
        <p className="mt-1 text-sm muted-text">Submit your video and target views. Admin approves before earners receive the campaign.</p>
        <form onSubmit={submit} className="mt-4 grid gap-3 md:grid-cols-2">
          <input className="interactive-control focus-ring px-3.5 py-2.5 text-sm" placeholder="Campaign title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
          <input className="interactive-control focus-ring px-3.5 py-2.5 text-sm" placeholder="Video URL" value={form.videoUrl} onChange={(e) => setForm((p) => ({ ...p, videoUrl: e.target.value }))} />
          <input className="interactive-control focus-ring px-3.5 py-2.5 text-sm" placeholder="Target views" type="number" value={form.targetViews} onChange={(e) => setForm((p) => ({ ...p, targetViews: e.target.value }))} />
          <input className="interactive-control focus-ring px-3.5 py-2.5 text-sm" placeholder="Phone number for checkout" value={form.phoneNumber} onChange={(e) => setForm((p) => ({ ...p, phoneNumber: e.target.value }))} />
          <textarea className="interactive-control focus-ring px-3.5 py-2.5 text-sm md:col-span-2" placeholder="Campaign details" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          <div className="md:col-span-2">
            <button disabled={saving} className="primary-btn px-4 py-2 text-sm disabled:opacity-50">
              {saving ? "Creating..." : "Create and pay"}
            </button>
          </div>
        </form>
      </div>

      <div className="card-surface neon-outline rounded-3xl section-card">
        <h3 className="section-title text-base">Recent campaigns</h3>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-[var(--border)]">
          <table className="min-w-full text-sm">
            <thead className="bg-[color-mix(in_srgb,var(--surface-soft)_95%,transparent)]">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] muted-text">Title</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] muted-text">Status</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] muted-text">Payment</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] muted-text">Target Views</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] muted-text">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id} className="border-t border-[var(--border)] hover:bg-[color-mix(in_srgb,var(--brand)_7%,transparent)]">
                  <td className="px-3 py-3">{row.title}</td>
                  <td className="px-3 py-3">
                    <StatusChip status={row.status} />
                  </td>
                  <td className="px-3 py-3">
                    <StatusChip status={row.paymentStatus} />
                  </td>
                  <td className="px-3 py-3">{row.targetViews || "-"}</td>
                  <td className="px-3 py-3 font-semibold">KES {Number(row.totalAmount || 0).toFixed(2)}</td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td className="px-3 py-4 muted-text" colSpan={5}>
                    No campaigns yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
