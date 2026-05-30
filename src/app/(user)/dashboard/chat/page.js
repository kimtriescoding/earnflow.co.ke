"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { UserAppShell } from "@/components/user/UserAppShell";

const CHAT_SIGNIN_URL = "https://www.rentacyberfriend.com/signin/";

function isCheckoutReturn() {
  if (typeof window === "undefined") return false;
  const search = window.location.search || "";
  return /checkout=1/i.test(search) || /status=(success|completed|ok|paid)/i.test(search);
}

export default function ChatPage() {
  const [status, setStatus] = useState({ loading: true, unlocked: false, fee: 0 });
  const [phoneNumber, setPhoneNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const pollRef = useRef(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/modules/chat/unlock", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (data?.success) {
        setStatus({ loading: false, unlocked: Boolean(data.data?.unlocked), fee: Number(data.data?.fee || 0) });
        const savedPhone = String(data.data?.phoneNumber || "");
        if (savedPhone) setPhoneNumber((prev) => (prev ? prev : savedPhone));
        return Boolean(data.data?.unlocked);
      }
    } catch {
      /* keep defaults */
    }
    setStatus((prev) => ({ ...prev, loading: false }));
    return false;
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const unlocked = await loadStatus();
      if (cancelled || unlocked || !isCheckoutReturn()) return;
      setVerifying(true);
      let attempts = 0;
      const tick = async () => {
        if (cancelled) return;
        attempts += 1;
        const done = await loadStatus();
        if (done) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setVerifying(false);
          toast.success("Chat unlocked.");
          return;
        }
        if (attempts >= 30) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setVerifying(false);
          toast.info("Still confirming your payment. Refresh in a moment.");
        }
      };
      pollRef.current = setInterval(() => void tick(), 2000);
    })();

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadStatus]);

  async function startUnlock(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const returnUrl = `${window.location.origin}/dashboard/chat?checkout=1`;
      const res = await fetch("/api/modules/chat/unlock", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, redirectUrl: returnUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.success) {
        toast.error(data.message || "Unable to start unlock payment.");
        return;
      }
      if (data.data?.unlocked) {
        toast.success("Chat already unlocked.");
        await loadStatus();
        return;
      }
      if (data.data?.checkoutUrl) {
        toast.success("Payment initiated. Redirecting...");
        window.location.href = data.data.checkoutUrl;
        return;
      }
      toast.info("Payment initiated. Complete payment to unlock chat.");
    } catch {
      toast.error("Something went wrong while starting the payment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <UserAppShell title="Chat" hideHeader>
      <div className="flex min-h-[calc(100dvh-3.25rem)] flex-col items-center justify-center p-6">
        <div className="card-strong neon-outline w-full max-w-lg rounded-[var(--radius-panel)] px-7 py-9 text-center md:px-10 md:py-11">
          <p className="eyebrow-label">Paid chat</p>
          <h2 className="heading-display mt-2 text-balance text-xl font-semibold leading-snug tracking-tight gradient-text md:text-2xl">
            Get paid to chat with people around the world
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
            Rent a Cyber Friend matches you with clients who want real conversation — flexible hours, global audience,
            you choose how you show up.
          </p>

          {status.loading ? (
            <div className="mt-7 flex items-center justify-center gap-2 text-sm text-[var(--muted)]">
              <Loader2 className="h-4 w-4 motion-safe:animate-spin text-[var(--brand)]" strokeWidth={2} aria-hidden />
              Loading…
            </div>
          ) : status.unlocked ? (
            <>
              <a
                href={CHAT_SIGNIN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="primary-btn mt-7 inline-flex min-w-[12.5rem] justify-center px-7 py-3 text-sm font-semibold"
              >
                Get started now
              </a>
              <p className="mt-5 text-xs leading-relaxed text-[var(--muted)]">
                Already have an account?{" "}
                <a
                  href={CHAT_SIGNIN_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[var(--brand)] underline underline-offset-2 transition-colors hover:text-[var(--brand-strong)]"
                >
                  Continue chatting
                </a>
                .
              </p>
            </>
          ) : verifying ? (
            <div className="mt-7 flex items-center justify-center gap-2 text-sm text-[var(--muted)]">
              <Loader2 className="h-4 w-4 motion-safe:animate-spin text-[var(--brand)]" strokeWidth={2} aria-hidden />
              Confirming your payment…
            </div>
          ) : (
            <>
              <div className="mt-6 rounded-2xl border bg-[var(--surface-soft)] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] muted-text">One-time unlock fee</p>
                <p className="heading-display mt-1 text-xl font-semibold">KES {Number(status.fee || 0).toFixed(2)}</p>
              </div>
              <form onSubmit={startUnlock} className="mt-5 space-y-4 text-left">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Phone number</span>
                  <input
                    className="interactive-control focus-ring w-full px-3.5 py-2.5 text-sm"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="2547XXXXXXXX"
                  />
                </label>
                <button
                  disabled={submitting}
                  className="primary-btn w-full px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
                >
                  {submitting ? "Starting payment..." : "Unlock chat"}
                </button>
              </form>
              <p className="mt-4 text-xs leading-relaxed text-[var(--muted)]">
                Pay the one-time fee to unlock access to the chat platform.
              </p>
            </>
          )}
        </div>
      </div>
    </UserAppShell>
  );
}
