"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

function ResetPasswordContent() {
  const params = useSearchParams();
  const token = useMemo(() => params.get("token") || "", [params]);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function submit(e) {
    e.preventDefault();
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    const msg = data.message || (data.success ? "Password updated." : "Failed to reset password");
    setMessage(msg);
    if (data.success) toast.success(msg);
    else toast.error(msg);
  }

  return (
    <div className="page-shell soft-gradient p-4 md:p-8">
      <div className="blob left-10 top-16 h-44 w-44 bg-[color-mix(in_srgb,var(--brand)_62%,transparent)]" />
      <div className="blob bottom-14 right-8 h-48 w-48 bg-[color-mix(in_srgb,var(--accent)_66%,transparent)]" />
      <div className="relative mx-auto max-w-xl pt-4 md:pt-8">
        <div className="card-strong neon-outline mx-auto w-full max-w-[460px] rounded-[var(--radius-panel)] p-6 md:p-8 lg:max-w-[500px]">
            <p className="eyebrow-label text-center">Earnflow Agencies</p>
            <h1 className="heading-display mt-2 text-center text-3xl font-semibold gradient-text">Reset password</h1>
            <p className="mt-1 text-center text-sm muted-text">Choose a new password for your account.</p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">New password</span>
                <input
                  type="password"
                  className="interactive-control focus-ring w-full px-3.5 py-2.5 text-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                />
              </label>
              <button className="primary-btn neon-ring w-full px-4 py-2.5 text-sm">Reset password</button>
            </form>
            {message ? <p className="mt-3 text-sm muted-text">{message}</p> : null}
            <p className="mt-4 text-sm muted-text">
              Back to{" "}
              <Link href="/login" className="font-semibold text-[var(--brand)]">
                login
              </Link>
            </p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen soft-gradient p-4 md:p-8" />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
