"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { ROLE } from "@/lib/auth/roles";

function postActivationPath(role) {
  if ([ROLE.ADMIN, ROLE.SUPPORT, ROLE.SUPERADMIN].includes(String(role || ""))) return "/admin";
  if (role === "client") return "/client";
  return "/dashboard";
}

/**
 * ZetuPay may use `status=success` instead of `success=true`, and may append a second `?`
 * (e.g. `?checkout=1?status=success`) instead of `&`. Normalize so we can poll / confirm.
 */
function parseActivationReturnFromSearch(fullSearch) {
  const raw = fullSearch.startsWith("?") ? fullSearch.slice(1) : fullSearch;
  const fixed = raw.replace(/^(checkout=[^&]+)\?/i, "$1&");
  const sp = new URLSearchParams(fixed);
  let checkout = String(sp.get("checkout") ?? "").trim();
  if (checkout.includes("?")) checkout = checkout.split("?")[0];
  if (checkout.includes("&")) checkout = checkout.split("&")[0];

  const status = String(sp.get("status") ?? "").toLowerCase();
  const success = String(sp.get("success") ?? "").toLowerCase();

  const checkoutOk = checkout === "1";
  const statusPositive = ["success", "completed", "ok", "paid"].includes(status);
  const successPositive = success === "true" || success === "1" || success === "yes";
  const isReturn = checkoutOk || statusPositive || successPositive;

  const statusNegative = ["failed", "fail", "cancelled", "canceled", "error", "declined"].includes(status);
  const successNegative = success === "false" || success === "0" || success === "no";
  const isFailure = statusNegative || successNegative;

  return { checkoutOk, isReturn, isFailure };
}

function currentActivationSearch(searchParams) {
  if (typeof window !== "undefined" && window.location?.search) return window.location.search;
  const q = searchParams.toString();
  return q ? `?${q}` : "";
}

export default function ActivatePageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [activationFee, setActivationFee] = useState(0);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [verifyingReturn, setVerifyingReturn] = useState(false);
  const [feeLoading, setFeeLoading] = useState(true);

  const fetchFee = useCallback(async () => {
    setFeeLoading(true);
    try {
      const activationRes = await fetch("/api/payments/wavepay/initiate", { credentials: "include" });
      const activationData = await activationRes.json().catch(() => ({}));
      const fee = Number(activationData?.data?.amount || 0);
      if (Number.isFinite(fee)) setActivationFee(fee);
    } finally {
      setFeeLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let pollTimer = null;

    const { isReturn: isPaymentReturn, isFailure: paymentFailed } = parseActivationReturnFromSearch(
      currentActivationSearch(searchParams)
    );

    if (paymentFailed) {
      setCheckingSession(false);
      setMessage("Payment was not completed. You can try again.");
      toast.error("Payment was not completed.");
      void fetchFee();
      return () => {
        cancelled = true;
      };
    }

    if (isPaymentReturn) {
      setCheckingSession(false);
      setVerifyingReturn(true);
      const maxAttempts = 30;
      let attempts = 0;

      const tick = async () => {
        if (cancelled) return;
        attempts += 1;
        try {
          const meRes = await fetch("/api/auth/me", { credentials: "include" });
          const meData = await meRes.json().catch(() => ({}));
          if (cancelled) return;
          if (meData?.success && meData.data?.isActivated) {
            if (pollTimer) clearInterval(pollTimer);
            pollTimer = null;
            setVerifyingReturn(false);
            toast.success("Account activated.");
            router.replace(postActivationPath(meData.data.role));
            return;
          }
          if (attempts >= maxAttempts) {
            if (pollTimer) clearInterval(pollTimer);
            pollTimer = null;
            setVerifyingReturn(false);
            setMessage("Activation is still processing. Refresh in a moment or try paying again if something went wrong.");
            toast.info("Still waiting on activation confirmation.");
            void fetchFee();
          }
        } catch {
          if (attempts >= maxAttempts) {
            if (pollTimer) clearInterval(pollTimer);
            pollTimer = null;
            setVerifyingReturn(false);
            void fetchFee();
          }
        }
      };

      void tick();
      pollTimer = setInterval(() => void tick(), 2000);

      return () => {
        cancelled = true;
        if (pollTimer) clearInterval(pollTimer);
      };
    }

    (async () => {
      let leaving = false;
      try {
        const meRes = await fetch("/api/auth/me", { credentials: "include" });
        const meData = await meRes.json().catch(() => ({}));
        if (cancelled) return;
        if (!meData?.success) {
          if (meRes.status === 401) {
            leaving = true;
            router.replace("/login");
            return;
          }
        } else {
          const d = meData.data || {};
          if (d.isBlocked) {
            leaving = true;
            router.replace("/login");
            return;
          }
          if (d.isActivated) {
            leaving = true;
            router.replace(postActivationPath(d.role));
            return;
          }
          const saved = d.phoneNumber || "";
          if (saved) setPhoneNumber(saved);
        }
      } catch {
        /* keep defaults */
      }
      // Do not await activation fee here: `/api/payments/wavepay/initiate` can be slow and
      // was blocking the whole "Checking your account" screen after `/api/auth/me` finished.
      if (!cancelled && !leaving) {
        setCheckingSession(false);
        void fetchFee();
      }
    })();

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [router, searchParams, fetchFee]);

  async function startActivation(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const returnUrl = `${window.location.origin}/activate?checkout=1`;
      const res = await fetch("/api/payments/wavepay/initiate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, redirectUrl: returnUrl }),
      });
      const data = await res.json();
      if (!data.success) {
        const msg = data.message || "Unable to start activation payment.";
        setMessage(msg);
        toast.error(msg);
        return;
      }
      if (data.data?.checkoutUrl) {
        toast.success("Activation payment initiated. Redirecting...");
        window.location.href = data.data.checkoutUrl;
        return;
      }
      const msg = "Payment initiated. Complete payment then log in again.";
      setMessage(msg);
      toast.success(msg);
    } catch {
      const msg = "Something went wrong while starting activation.";
      setMessage(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <div className="page-shell soft-gradient relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden p-6">
        <div
          className="activate-ambient-glow pointer-events-none absolute left-1/2 top-[38%] h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[color-mix(in_srgb,var(--brand)_22%,transparent)] blur-3xl"
          aria-hidden
        />
        <div className="activate-animate-in card-strong neon-outline relative w-full max-w-sm rounded-[var(--radius-panel)] px-8 py-10 text-center shadow-[var(--shadow-strong)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[color-mix(in_srgb,var(--brand)_35%,var(--border))] bg-[color-mix(in_srgb,var(--brand)_10%,var(--surface-soft))]">
            <Loader2 className="h-7 w-7 motion-safe:animate-spin text-[var(--brand)]" strokeWidth={2} aria-hidden />
          </div>
          <p className="activate-animate-in-delay-1 mt-5 text-base font-semibold text-[var(--foreground)]">Checking your account</p>
          <p className="activate-animate-in-delay-2 mt-2 text-sm leading-relaxed text-[var(--muted)]">
            Hang tight while we load your session.
          </p>
          <div className="activate-animate-in-delay-2 mt-8 h-1.5 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--brand)_10%,var(--border))]">
            <div className="activate-shimmer-track h-full w-full rounded-full">
              <div className="activate-shimmer-bar" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (verifyingReturn) {
    return (
      <div className="page-shell soft-gradient relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden p-6">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
          <div className="activate-ambient-glow absolute -left-20 top-1/4 h-80 w-80 rounded-full bg-[color-mix(in_srgb,var(--brand)_18%,transparent)] blur-3xl" />
          <div className="activate-ambient-glow-delayed absolute bottom-1/4 right-[-3rem] h-72 w-72 rounded-full bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] blur-3xl" />
        </div>

        <div className="activate-animate-in card-strong neon-outline relative w-full max-w-md rounded-[var(--radius-panel)] px-8 pb-10 pt-12 text-center shadow-[var(--shadow-strong)]">
          <div className="relative mx-auto flex h-[5.5rem] w-[5.5rem] items-center justify-center">
            <span
              className="activate-ring-a absolute h-[4.75rem] w-[4.75rem] rounded-full border-2 border-[color-mix(in_srgb,var(--brand)_38%,transparent)]"
              aria-hidden
            />
            <span
              className="activate-ring-b absolute h-[3.85rem] w-[3.85rem] rounded-full border-2 border-[color-mix(in_srgb,var(--brand)_52%,transparent)]"
              aria-hidden
            />
            <span
              className="activate-ring-c absolute h-[3rem] w-[3rem] rounded-full border-2 border-[color-mix(in_srgb,var(--brand)_68%,transparent)]"
              aria-hidden
            />
            <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--brand)_14%,var(--surface))] shadow-[0_8px_28px_color-mix(in_srgb,var(--brand)_22%,transparent)]">
              <Loader2 className="h-6 w-6 motion-safe:animate-spin text-[var(--brand)]" strokeWidth={2.25} aria-hidden />
            </div>
          </div>

          <div className="activate-animate-in-delay-1 mt-8 flex items-center justify-center gap-2">
            <ShieldCheck className="h-5 w-5 shrink-0 text-[var(--brand)]" strokeWidth={2} aria-hidden />
            <p className="text-lg font-semibold tracking-tight text-[var(--foreground)] sm:text-xl">Verifying payment</p>
          </div>
          <p className="activate-animate-in-delay-2 mx-auto mt-3 max-w-sm text-sm leading-relaxed text-[var(--muted)]">
            Confirming activation with our servers. This usually takes a few seconds — please keep this tab open.
          </p>

          <div className="activate-animate-in-delay-2 mt-10 h-2 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--brand)_12%,var(--border))]">
            <div className="activate-shimmer-track relative h-full w-full">
              <div className="activate-shimmer-bar" />
            </div>
          </div>
          <p className="activate-animate-in-delay-2 mt-4 text-xs text-[var(--muted)]">Secure checkout · Encrypted connection</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell soft-gradient p-4 md:p-8">
      <div className="relative mx-auto max-w-xl">
        <div className="card-strong rounded-3xl p-6 md:p-8">
          <p className="text-xs uppercase tracking-[0.13em] muted-text">Earnflow</p>
          <h1 className="heading-display mt-2 text-2xl font-semibold gradient-text">Activate your account</h1>
          <p className="mt-1 text-sm muted-text">
            Your account is not activated yet. Complete activation payment to unlock dashboard and earning modules.
          </p>
          <div className="mt-4 rounded-2xl border bg-[var(--surface-soft)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.12em] muted-text">Activation fee</p>
            <p className="heading-display mt-1 flex min-h-[1.75rem] items-center text-xl font-semibold">
              {feeLoading ? (
                <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--muted)]">
                  <Loader2 className="h-4 w-4 shrink-0 motion-safe:animate-spin text-[var(--brand)]" strokeWidth={2} aria-hidden />
                  Loading fee…
                </span>
              ) : (
                <>KES {Number(activationFee || 0).toFixed(2)}</>
              )}
            </p>
          </div>
          <form onSubmit={startActivation} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Phone Number</span>
              <input
                className="interactive-control focus-ring w-full px-3.5 py-2.5 text-sm"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="2547XXXXXXXX"
              />
            </label>
            <button disabled={loading || feeLoading} className="primary-btn w-full px-4 py-2.5 text-sm disabled:opacity-60">
              {loading ? "Starting payment..." : feeLoading ? "Loading fee…" : "Pay Activation Fee"}
            </button>
          </form>
          {message ? <p className="mt-3 text-sm muted-text">{message}</p> : null}
          <button type="button" onClick={() => router.push("/login")} className="mt-4 text-sm font-semibold text-[var(--brand)]">
            Back to login
          </button>
        </div>
      </div>
    </div>
  );
}
