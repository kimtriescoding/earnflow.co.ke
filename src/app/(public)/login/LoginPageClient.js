"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPageClient() {
  const router = useRouter();
  const params = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");
  const [mfaMode, setMfaMode] = useState("none");
  const [otpAuthUrl, setOtpAuthUrl] = useState("");
  const [backupCodes, setBackupCodes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  /** Initial email + password only */
  const credentialPhase = mfaMode === "none";
  /** Steps that need the OTP / code input */
  const otpPhase = mfaMode === "bootstrap" || mfaMode === "verify" || mfaMode === "setup";
  const qrCodeUrl = otpAuthUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(otpAuthUrl)}`
    : "";

  async function fetchSetupSecret() {
    const setupRes = await fetch("/api/auth/2fa/setup", { method: "POST", credentials: "include" });
    const setupData = await setupRes.json().catch(() => ({}));
    if (!setupData?.success || !setupData?.data?.otpAuthUrl) {
      throw new Error(setupData?.message || "Unable to start MFA setup.");
    }
    setOtpAuthUrl(setupData.data.otpAuthUrl);
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password, otp: otp.trim() }),
    });
    const raw = await res.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { success: false, message: raw?.slice(0, 120) || "Invalid server response" };
    }
    setBusy(false);
    if (data.success) {
      if (data.mfaRequired && !data.mfaVerified) {
        if (data.mfaSetupRequired) {
          setMfaMode("bootstrap");
          setMessage(
            data.otpEmailSent === false
              ? "Email could not be sent. Configure RESEND_API_KEY and EMAIL_FROM, or use Resend code in server logs. You can still try Resend code from logs if dev fallback logged it."
              : "Check your email for a 6-digit verification code before MFA setup."
          );
          toast.info("Email verification required.");
          return;
        }
        setMfaMode("verify");
        setMessage("");
        return;
      }

      toast.success("Login successful.");
      if (data.role === "admin" || data.role === "support") {
        router.push("/admin");
      } else if (data.role === "client") {
        router.push("/client");
      } else if (!data.isActivated) {
        router.push("/activate");
      } else {
        router.push("/dashboard");
      }
      return;
    }
    if (data?.mfaRequired && !data?.mfaSetupRequired) {
      setMfaMode("verify");
      if (data.mfaAwaitingCode) {
        setMessage("");
        return;
      }
      const msg = data.message || "Invalid authenticator code or backup code.";
      setMessage(msg);
      toast.error(msg);
      return;
    }
    if (data?.mfaRequired && data?.mfaSetupRequired) {
      setMfaMode("bootstrap");
    }
    const msg = data.message || "Login failed";
    setMessage(msg);
    toast.error(msg);
  }

  async function verifySetupCode() {
    if (!otp.trim()) {
      setMessage("Enter the MFA code from your authenticator app.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/auth/2fa/verify", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: otp.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!data?.success) {
      const msg = data?.message || "Invalid MFA code.";
      setMessage(msg);
      toast.error(msg);
      return;
    }
    setBackupCodes(data?.data?.backupCodes || []);
    setMfaMode("done");
    setMessage("MFA enabled successfully. Save your backup codes, then continue.");
    toast.success("MFA enabled.");
  }

  async function verifyBootstrapCode() {
    if (!otp.trim()) {
      setMessage("Enter the code sent to your email.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/auth/2fa/bootstrap/verify", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: otp.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!data?.success) {
      const msg = data?.message || "Invalid email verification code.";
      setMessage(msg);
      toast.error(msg);
      return;
    }
    try {
      await fetchSetupSecret();
      setOtp("");
      setMfaMode("setup");
      setMessage("Email verified. Scan the QR code and enter your authenticator code.");
      toast.success("Email verified.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to start MFA setup.";
      setMessage(msg);
      toast.error(msg);
    }
  }

  async function resendBootstrapCode() {
    setBusy(true);
    const res = await fetch("/api/auth/2fa/bootstrap/send", { method: "POST", credentials: "include" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!data?.success) {
      const msg = data?.message || "Unable to resend verification code.";
      setMessage(msg);
      toast.error(msg);
      return;
    }
    setMessage(data?.message || "Verification code sent.");
    toast.success("Verification code sent.");
  }

  return (
    <div className="page-shell soft-gradient p-4 md:p-8">
      <div className="blob left-8 top-16 h-52 w-52 bg-[color-mix(in_srgb,var(--accent)_74%,transparent)]" />
      <div className="blob bottom-12 right-10 h-56 w-56 bg-[color-mix(in_srgb,var(--brand)_78%,transparent)]" />
      <div className="relative mx-auto max-w-xl pt-3 md:pt-8">
        <div className="card-strong neon-outline mx-auto w-full max-w-[460px] rounded-[var(--radius-panel)] p-6 md:p-8 lg:max-w-[500px]">
          <p className="eyebrow-label text-center">Earnflow Agencies</p>
          <h1 className="heading-display mt-2 text-center text-3xl font-semibold gradient-text">Welcome back</h1>
          <p className="mt-1 text-center text-sm muted-text">Sign in using your email or username.</p>
          {params.get("mfa") === "required" ? (
            <p className="mt-3 rounded-xl border border-[color-mix(in_srgb,var(--brand)_35%,var(--border))] bg-[color-mix(in_srgb,var(--brand)_10%,transparent)] px-3 py-2 text-xs muted-text">
              Admin access requires MFA verification before continuing.
            </p>
          ) : null}
          {credentialPhase ? (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Email or Username</span>
                <input
                  className="interactive-control focus-ring w-full px-3.5 py-2.5 text-sm"
                  placeholder="name@example.com or your_username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Password</span>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    className="interactive-control focus-ring w-full px-3.5 py-2.5 pr-11 text-sm"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--foreground)] opacity-60 transition hover:opacity-100 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={2} /> : <Eye className="h-4 w-4" strokeWidth={2} />}
                  </button>
                </div>
              </label>
              <button type="submit" disabled={busy} className="primary-btn neon-ring w-full px-4 py-2.5 text-sm disabled:opacity-60">
                {busy ? "Please wait..." : "Log in"}
              </button>
            </form>
          ) : null}

          {otpPhase && mfaMode !== "verify" ? (
            <div className="mt-6 space-y-4">
              {mfaMode === "bootstrap" ? (
                <>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium">Email verification code</span>
                    <input
                      className="interactive-control focus-ring w-full px-3.5 py-2.5 text-sm tracking-[0.18em]"
                      placeholder="123456"
                      inputMode="numeric"
                      maxLength={8}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\s+/g, ""))}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        void verifyBootstrapCode();
                      }}
                    />
                  </label>
                  <p className="text-xs muted-text">
                    We sent a 6-digit code to your account email. Enter it below, then set up your authenticator app.
                  </p>
                  <button
                    type="button"
                    onClick={verifyBootstrapCode}
                    disabled={busy}
                    className="primary-btn neon-ring w-full px-4 py-2.5 text-sm disabled:opacity-60"
                  >
                    {busy ? "Please wait..." : "Verify email code"}
                  </button>
                  <button
                    type="button"
                    onClick={resendBootstrapCode}
                    disabled={busy}
                    className="secondary-btn w-full px-4 py-2.5 text-sm disabled:opacity-60"
                  >
                    Resend code
                  </button>
                </>
              ) : null}

              {mfaMode === "setup" ? (
                <div className="rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface-soft)_92%,transparent)] px-3.5 py-3">
                  {qrCodeUrl ? (
                    <img
                      src={qrCodeUrl}
                      alt="MFA setup QR code"
                      className="mx-auto mb-3 h-[176px] w-[176px] rounded-lg border border-[var(--border)] bg-white p-2"
                    />
                  ) : null}
                  <p className="text-xs muted-text">Scan the QR in Google Authenticator or Authy, or open this link:</p>
                  <a href={otpAuthUrl} className="mt-1 block text-xs font-semibold text-[var(--accent)] break-all">
                    {otpAuthUrl}
                  </a>
                  <label className="mt-4 block">
                    <span className="mb-1.5 block text-sm font-medium">Authenticator setup code</span>
                    <input
                      className="interactive-control focus-ring w-full px-3.5 py-2.5 text-sm tracking-[0.18em]"
                      placeholder="123456"
                      inputMode="numeric"
                      maxLength={8}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\s+/g, ""))}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        void verifySetupCode();
                      }}
                      autoComplete="one-time-code"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={verifySetupCode}
                    disabled={busy}
                    className="primary-btn neon-ring mt-3 w-full px-3 py-2.5 text-sm disabled:opacity-60"
                  >
                    {busy ? "Please wait..." : "Verify & enable MFA"}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {mfaMode === "verify" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit(e);
              }}
              className="mt-6 space-y-4"
            >
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Authenticator code</span>
                <input
                  className="interactive-control focus-ring w-full px-3.5 py-2.5 text-sm tracking-[0.18em]"
                  placeholder="123456"
                  inputMode="numeric"
                  maxLength={8}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\s+/g, ""))}
                  autoComplete="one-time-code"
                />
              </label>
              <p className="text-xs muted-text">Enter the 6-digit code from your authenticator app to finish signing in.</p>
              <button type="submit" disabled={busy} className="primary-btn neon-ring w-full px-4 py-2.5 text-sm disabled:opacity-60">
                {busy ? "Please wait..." : "Verify & sign in"}
              </button>
            </form>
          ) : null}
          {mfaMode === "done" && backupCodes.length ? (
            <div className="mt-4 rounded-xl border border-[color-mix(in_srgb,var(--success)_45%,var(--border))] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] px-3.5 py-3">
              <p className="text-xs font-semibold text-[var(--foreground)]">Backup codes (save these):</p>
              <p className="mt-1 text-xs muted-text break-words">{backupCodes.join("  ")}</p>
              <button
                type="button"
                onClick={() => router.push("/admin")}
                className="primary-btn neon-ring mt-3 w-full px-3 py-2 text-sm"
              >
                Continue to admin
              </button>
            </div>
          ) : null}
          {credentialPhase ? (
            <>
              <div className="mt-5 flex items-center justify-between text-right">
                <p className="text-xs muted-text">Secure sign in to your account</p>
                <Link href="/forgot-password" className="text-sm font-semibold text-[var(--brand)]">
                  Forgot password?
                </Link>
              </div>
              <p className="mt-4 text-sm muted-text">
                Don&apos;t have an account?{" "}
                <Link href="/signup" className="font-semibold text-[var(--accent)]">
                  Create account
                </Link>
              </p>
            </>
          ) : null}
          {message ? <p className="mt-3 text-sm text-[var(--danger)]">{message}</p> : null}
        </div>
      </div>
    </div>
  );
}
