"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  async function submit(e) {
    e.preventDefault();
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    const msg = data.message || "If the email exists, a reset link has been sent.";
    setMessage(msg);
    toast.success(msg);
  }

  return (
    <div className="page-shell soft-gradient p-4 md:p-8">
      <div className="blob left-8 top-16 h-44 w-44 bg-[color-mix(in_srgb,var(--accent)_62%,transparent)]" />
      <div className="blob bottom-14 right-8 h-48 w-48 bg-[color-mix(in_srgb,var(--brand)_68%,transparent)]" />
      <div className="relative mx-auto max-w-xl pt-4 md:pt-8">
        <div className="card-strong neon-outline mx-auto w-full max-w-[460px] rounded-[var(--radius-panel)] p-6 md:p-8 lg:max-w-[500px]">
            <p className="eyebrow-label text-center">Earnflow Agencies</p>
            <h1 className="heading-display mt-2 text-center text-3xl font-semibold gradient-text">Forgot password</h1>
            <p className="mt-1 text-center text-sm muted-text">Enter your email and we will send a password reset link.</p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Email</span>
                <input
                  className="interactive-control focus-ring w-full px-3.5 py-2.5 text-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                />
              </label>
              <button className="primary-btn neon-ring w-full px-4 py-2.5 text-sm">Send reset link</button>
            </form>
            {message ? <p className="mt-3 text-sm muted-text">{message}</p> : null}
            <p className="mt-4 text-sm muted-text">
              Remembered your password?{" "}
              <Link href="/login" className="font-semibold text-[var(--brand)]">
                Back to login
              </Link>
            </p>
        </div>
      </div>
    </div>
  );
}
