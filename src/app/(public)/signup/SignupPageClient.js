"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

/** Persists invite ref across login ↔ signup until signup succeeds or a new ?ref= is opened. */
const SIGNUP_REF_STORAGE_KEY = "earnflow_signup_referral";
const LEGACY_SIGNUP_REF_STORAGE_KEY = "taskwave_signup_referral";

export default function SignupPageClient() {
  const params = useSearchParams();
  const router = useRouter();
  const [form, setForm] = useState({ username: "", email: "", phoneNumber: "", password: "", referralCode: "" });
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [usernameRemoteStatus, setUsernameRemoteStatus] = useState({ state: "idle", text: "" });
  const [usernameSuggestions, setUsernameSuggestions] = useState([]);
  const usernameCheckCacheRef = useRef(new Map());
  const refFromQuery = params.get("ref");
  /** Normalized referral from invite link (?ref=) or localStorage; locks the field when set. */
  const [inviteReferralCode, setInviteReferralCode] = useState("");

  useEffect(() => {
    const urlRef = String(refFromQuery || "").trim().toLowerCase();
    try {
      if (urlRef) {
        localStorage.setItem(SIGNUP_REF_STORAGE_KEY, urlRef);
        setInviteReferralCode(urlRef);
        setForm((p) => (p.referralCode === urlRef ? p : { ...p, referralCode: urlRef }));
      } else {
        let stored = String(localStorage.getItem(SIGNUP_REF_STORAGE_KEY) || "").trim().toLowerCase();
        if (!stored) {
          const legacy = String(localStorage.getItem(LEGACY_SIGNUP_REF_STORAGE_KEY) || "").trim().toLowerCase();
          if (legacy) {
            try {
              localStorage.setItem(SIGNUP_REF_STORAGE_KEY, legacy);
              localStorage.removeItem(LEGACY_SIGNUP_REF_STORAGE_KEY);
            } catch {
              /* ignore */
            }
            stored = legacy;
          }
        }
        setInviteReferralCode(stored);
        if (stored) {
          setForm((p) => (p.referralCode === stored ? p : { ...p, referralCode: stored }));
        }
      }
    } catch {
      setInviteReferralCode(urlRef);
      if (urlRef) setForm((p) => ({ ...p, referralCode: urlRef }));
    }
  }, [refFromQuery]);

  const referralLocked = Boolean(inviteReferralCode);

  const normalizedUsername = useMemo(() => String(form.username || "").trim().toLowerCase(), [form.username]);
  const usernameLooksValid = /^[a-z0-9_]{3,20}$/.test(normalizedUsername);

  const usernameStatus = useMemo(() => {
    if (!normalizedUsername) return { state: "idle", text: "" };
    if (!usernameLooksValid) {
      return {
        state: "invalid",
        text: "Use 3-20 chars: lowercase letters, numbers, underscore.",
      };
    }
    return usernameRemoteStatus;
  }, [normalizedUsername, usernameLooksValid, usernameRemoteStatus]);

  useEffect(() => {
    if (!normalizedUsername) {
      return;
    }

    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      const cachedEntry = usernameCheckCacheRef.current.get(normalizedUsername);
      if (cachedEntry) {
        setUsernameRemoteStatus(cachedEntry.status);
        setUsernameSuggestions(cachedEntry.suggestions || []);
        return;
      }
      try {
        const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(normalizedUsername)}`, {
          signal: ctrl.signal,
        });
        const data = await res.json();
        if (data.available) {
          const status = { state: "available", text: data.reason || "Username is available." };
          const entry = { status, suggestions: data.suggestions || [] };
          usernameCheckCacheRef.current.set(normalizedUsername, entry);
          setUsernameRemoteStatus(status);
          setUsernameSuggestions(entry.suggestions);
        } else {
          const status = { state: "taken", text: data.reason || "Username is not available." };
          const entry = { status, suggestions: data.suggestions || [] };
          usernameCheckCacheRef.current.set(normalizedUsername, entry);
          setUsernameRemoteStatus(status);
          setUsernameSuggestions(entry.suggestions);
        }
      } catch {
        if (!ctrl.signal.aborted) {
          setUsernameRemoteStatus({ state: "error", text: "Unable to check username right now." });
          setUsernameSuggestions([]);
        }
      }
    }, 350);

    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [normalizedUsername, usernameLooksValid]);

  async function submit(e) {
    e.preventDefault();
    if (usernameStatus.state !== "available") {
      const msg = "Please choose an available username before continuing.";
      setMessage(msg);
      toast.error(msg);
      return;
    }
    if (String(form.password || "").length < 6) {
      const msg = "Password must be at least 6 characters.";
      setMessage(msg);
      toast.error(msg);
      return;
    }
    const referralPayload = referralLocked
      ? inviteReferralCode
      : String(form.referralCode || "").trim().toLowerCase();
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, referralCode: referralPayload }),
    });
    const data = await res.json();
    const msg = data.message || (data.success ? "Account created" : "Failed");
    setMessage(msg);
    if (data.success) {
      try {
        localStorage.removeItem(SIGNUP_REF_STORAGE_KEY);
        localStorage.removeItem(LEGACY_SIGNUP_REF_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      toast.success(msg);
      router.push("/dashboard");
    } else {
      toast.error(msg);
    }
  }

  return (
    <div className="page-shell soft-gradient p-4 md:p-8">
      <div className="blob left-10 top-16 h-56 w-56 bg-[color-mix(in_srgb,var(--brand)_76%,transparent)]" />
      <div className="blob bottom-14 right-8 h-60 w-60 bg-[color-mix(in_srgb,var(--accent)_72%,transparent)]" />
      <div className="relative mx-auto max-w-xl pt-3 md:pt-8">
        <div className="card-strong neon-outline mx-auto w-full max-w-[480px] rounded-[var(--radius-panel)] p-6 md:p-8 lg:max-w-[500px]">
          <p className="eyebrow-label text-center">Earnflow Agencies</p>
          <h2 className="heading-display gradient-text text-center text-3xl font-semibold">Create your Earnflow account</h2>
          <p className="mt-1 text-center text-sm muted-text">Sign up to Earnflow for activation-ready access and your earnings dashboard.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            {[
              { key: "username", label: "Username", type: "text" },
              { key: "email", label: "Email", type: "text" },
              { key: "phoneNumber", label: "Phone number", type: "text" },
              { key: "password", label: "Password", type: "password" },
              {
                key: "referralCode",
                label: referralLocked ? "Referral code (from your invite link)" : "Referral code (optional)",
                type: "text",
              },
            ].map((field) => {
              const isPassword = field.key === "password";
              const inputClassName = `interactive-control focus-ring w-full px-3.5 py-2.5 text-sm${
                isPassword ? " pr-11" : ""
              }${field.key === "referralCode" && referralLocked ? " cursor-not-allowed opacity-90" : ""}`;
              const inputEl = (
                <input
                  className={inputClassName}
                  placeholder={field.label}
                  type={isPassword ? (showPassword ? "text" : "password") : field.type}
                  minLength={isPassword ? 6 : undefined}
                  autoComplete={isPassword ? "new-password" : undefined}
                  readOnly={field.key === "referralCode" && referralLocked}
                  aria-readonly={field.key === "referralCode" && referralLocked ? true : undefined}
                  value={
                    field.key === "referralCode"
                      ? referralLocked
                        ? inviteReferralCode
                        : form.referralCode
                      : form[field.key]
                  }
                  onChange={(e) => {
                    if (field.key === "referralCode" && referralLocked) return;
                    const nextValue = e.target.value;
                    if (field.key === "username") {
                      const normalized = String(nextValue || "").trim().toLowerCase();
                      if (/^[a-z0-9_]{3,20}$/.test(normalized)) {
                        setUsernameRemoteStatus({ state: "checking", text: "Checking username..." });
                        setUsernameSuggestions([]);
                      } else {
                        setUsernameRemoteStatus({ state: "idle", text: "" });
                        setUsernameSuggestions([]);
                      }
                    }
                    setForm((p) => ({ ...p, [field.key]: nextValue }));
                  }}
                />
              );
              return (
              <label key={field.key} className="block">
                <span className="mb-1.5 block text-sm font-medium">{field.label}</span>
                {isPassword ? (
                  <div className="relative">
                    {inputEl}
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--foreground)] opacity-60 transition hover:opacity-100 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={2} /> : <Eye className="h-4 w-4" strokeWidth={2} />}
                    </button>
                  </div>
                ) : (
                  inputEl
                )}
                {field.key === "username" && usernameStatus.text ? (
                  <span
                    className={`mt-1.5 block text-xs ${
                      usernameStatus.state === "available"
                        ? "text-[var(--success)]"
                        : usernameStatus.state === "checking"
                          ? "muted-text"
                          : "text-[var(--danger)]"
                    }`}
                  >
                    {usernameStatus.text}
                  </span>
                ) : null}
                {field.key === "username" && usernameSuggestions.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {usernameSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => {
                          setForm((p) => ({ ...p, username: suggestion }));
                          const status = { state: "available", text: "Username is available." };
                          usernameCheckCacheRef.current.set(suggestion, { status, suggestions: [] });
                          setUsernameRemoteStatus(status);
                          setUsernameSuggestions([]);
                        }}
                        className="rounded-full border bg-[var(--surface-soft)] px-2.5 py-1 text-xs font-medium transition hover:border-[var(--brand)]"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                ) : null}
              </label>
              );
            })}
            <button
              disabled={usernameStatus.state !== "available"}
              className="primary-btn neon-ring w-full px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              Create account
            </button>
          </form>
          {message ? <p className="mt-3 text-sm muted-text">{message}</p> : null}
          <p className="mt-5 text-sm muted-text">
            Already registered?{" "}
            <Link href="/login" className="font-semibold text-[var(--brand)]">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
