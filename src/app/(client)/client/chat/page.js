"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/ui/AppShell";
import { clientNavItems } from "@/lib/nav/client-nav";

export default function ClientChatPage() {
  const [threads, setThreads] = useState([]);
  const [form, setForm] = useState({ title: "", topic: "", requestedMinutes: "30", phoneNumber: "" });
  const [activeThreadId, setActiveThreadId] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/client/chat/threads");
    const data = await res.json();
    if (data.success) setThreads(data.data || []);
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/client/chat/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, requestedMinutes: Number(form.requestedMinutes || 0) }),
    });
    const data = await res.json();
    setSaving(false);
    if (!data.success) {
      toast.error(data.message || "Unable to create chat request");
      return;
    }
    toast.success("Chat request created. Complete payment to enter approval queue.");
    if (data.data?.checkoutUrl) window.location.href = data.data.checkoutUrl;
    await load();
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!activeThreadId || !message.trim()) return;
    const res = await fetch(`/api/client/chat/threads/${activeThreadId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    if (!data.success) {
      toast.error(data.message || "Unable to send message");
      return;
    }
    setMessage("");
    toast.success("Message sent");
    await load();
  }

  const active = threads.find((thread) => thread._id === activeThreadId);

  return (
    <AppShell title="Paid Chat Requests" navItems={clientNavItems}>
      <div className="card-surface rounded-3xl section-card">
        <h2 className="heading-display text-lg font-semibold">Create async chat request</h2>
        <p className="mt-1 text-sm muted-text">Define topic and requested minutes, then pay. Admin approves before workers are attached.</p>
        <form onSubmit={submit} className="mt-4 grid gap-3 md:grid-cols-2">
          <input className="interactive-control focus-ring px-3.5 py-2.5 text-sm" placeholder="Request title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
          <input className="interactive-control focus-ring px-3.5 py-2.5 text-sm" placeholder="Topic" value={form.topic} onChange={(e) => setForm((p) => ({ ...p, topic: e.target.value }))} />
          <input className="interactive-control focus-ring px-3.5 py-2.5 text-sm" placeholder="Requested minutes" type="number" value={form.requestedMinutes} onChange={(e) => setForm((p) => ({ ...p, requestedMinutes: e.target.value }))} />
          <input className="interactive-control focus-ring px-3.5 py-2.5 text-sm" placeholder="Phone number for checkout" value={form.phoneNumber} onChange={(e) => setForm((p) => ({ ...p, phoneNumber: e.target.value }))} />
          <div className="md:col-span-2">
            <button disabled={saving} className="primary-btn px-4 py-2 text-sm disabled:opacity-50">
              {saving ? "Creating..." : "Create and pay"}
            </button>
          </div>
        </form>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="card-surface rounded-3xl section-card">
          <h3 className="heading-display text-base font-semibold">Your threads</h3>
          <div className="mt-3 space-y-2">
            {threads.map((thread) => (
              <button
                key={thread._id}
                type="button"
                onClick={() => setActiveThreadId(thread._id)}
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                  activeThreadId === thread._id ? "bg-[color-mix(in_srgb,var(--brand)_10%,transparent)]" : "bg-[var(--surface-soft)]"
                }`}
              >
                <p className="font-medium">{thread.title}</p>
                <p className="text-xs muted-text">
                  {thread.status} | {thread.orderId?.paymentStatus || "pending"}
                </p>
              </button>
            ))}
            {!threads.length ? <p className="text-sm muted-text">No chat threads yet.</p> : null}
          </div>
        </div>
        <div className="card-surface rounded-3xl section-card">
          <h3 className="heading-display text-base font-semibold">Thread messages</h3>
          {active ? (
            <>
              <div className="mt-3 max-h-[320px] space-y-2 overflow-y-auto rounded-xl border bg-[var(--surface-soft)] p-3">
                {(active.messages || []).map((m, i) => (
                  <div key={`${m.sentAt}-${i}`} className="rounded-lg border bg-[var(--surface)] px-3 py-2">
                    <p className="text-xs muted-text">{m.senderRole}</p>
                    <p className="text-sm">{m.body}</p>
                  </div>
                ))}
                {!active.messages?.length ? <p className="text-sm muted-text">No messages yet.</p> : null}
              </div>
              <form onSubmit={sendMessage} className="mt-3 flex gap-2">
                <input className="interactive-control focus-ring w-full px-3.5 py-2.5 text-sm" placeholder="Type a message..." value={message} onChange={(e) => setMessage(e.target.value)} />
                <button className="primary-btn px-4 py-2 text-sm">Send</button>
              </form>
            </>
          ) : (
            <p className="mt-2 text-sm muted-text">Select a thread to view and send messages.</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
