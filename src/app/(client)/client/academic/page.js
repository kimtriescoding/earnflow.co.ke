"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/ui/AppShell";
import { clientNavItems } from "@/lib/nav/client-nav";

export default function ClientAcademicPage() {
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    instructions: "",
    wordCount: "1200",
    phoneNumber: "",
    urgent: false,
  });

  async function load() {
    const res = await fetch("/api/client/academic/orders");
    const data = await res.json();
    if (data.success) setRows(data.data || []);
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/client/academic/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, wordCount: Number(form.wordCount || 0) }),
    });
    const data = await res.json();
    setSaving(false);
    if (!data.success) {
      toast.error(data.message || "Unable to create academic order");
      return;
    }
    toast.success("Academic order created. Complete payment to continue.");
    if (data.data?.checkoutUrl) window.location.href = data.data.checkoutUrl;
    await load();
  }

  return (
    <AppShell title="Academic Assignment Orders" navItems={clientNavItems}>
      <div className="card-surface rounded-3xl section-card">
        <h2 className="heading-display text-lg font-semibold">Submit academic assignment order</h2>
        <p className="mt-1 text-sm muted-text">Post assignment requirements, pay instantly, then wait for admin approval and worker assignment.</p>
        <form onSubmit={submit} className="mt-4 grid gap-3 md:grid-cols-2">
          <input className="interactive-control focus-ring px-3.5 py-2.5 text-sm" placeholder="Assignment title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
          <input className="interactive-control focus-ring px-3.5 py-2.5 text-sm" placeholder="Word count" type="number" value={form.wordCount} onChange={(e) => setForm((p) => ({ ...p, wordCount: e.target.value }))} />
          <input className="interactive-control focus-ring px-3.5 py-2.5 text-sm md:col-span-2" placeholder="Short description" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          <textarea className="interactive-control focus-ring px-3.5 py-2.5 text-sm md:col-span-2" placeholder="Detailed instructions" value={form.instructions} onChange={(e) => setForm((p) => ({ ...p, instructions: e.target.value }))} />
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.urgent} onChange={(e) => setForm((p) => ({ ...p, urgent: e.target.checked }))} />
            Mark as urgent
          </label>
          <input className="interactive-control focus-ring px-3.5 py-2.5 text-sm" placeholder="Phone number for checkout" value={form.phoneNumber} onChange={(e) => setForm((p) => ({ ...p, phoneNumber: e.target.value }))} />
          <div className="md:col-span-2">
            <button disabled={saving} className="primary-btn px-4 py-2 text-sm disabled:opacity-50">
              {saving ? "Creating..." : "Create and pay"}
            </button>
          </div>
        </form>
      </div>

      <div className="card-surface rounded-3xl section-card">
        <h3 className="heading-display text-base font-semibold">Recent orders</h3>
        <div className="mt-3 overflow-x-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--surface-soft)]">
              <tr>
                <th className="px-3 py-2 text-left">Title</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Payment</th>
                <th className="px-3 py-2 text-left">Words</th>
                <th className="px-3 py-2 text-left">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id} className="border-t">
                  <td className="px-3 py-2">{row.title}</td>
                  <td className="px-3 py-2">{row.status}</td>
                  <td className="px-3 py-2">{row.paymentStatus}</td>
                  <td className="px-3 py-2">{row.wordCount || "-"}</td>
                  <td className="px-3 py-2">KES {Number(row.totalAmount || 0).toFixed(2)}</td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td className="px-3 py-4 muted-text" colSpan={5}>
                    No academic orders yet.
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
