"use client";

import { useEffect, useState } from "react";
import { UserAppShell } from "@/components/user/UserAppShell";
import { toast } from "sonner";

export default function ProfilePage() {
  const [profile, setProfile] = useState({
    username: "-",
    email: "-",
    role: "-",
    phoneNumber: "-",
    referralCode: "-",
    accountStatus: "pending_activation",
  });
  const [emailForm, setEmailForm] = useState({ email: "", currentPassword: "" });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const res = await fetch("/api/auth/me");
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        setProfile(data.data || {});
        setEmailForm((prev) => ({ ...prev, email: data.data?.email || "" }));
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function updateEmail(e) {
    e.preventDefault();
    setSavingEmail(true);
    const res = await fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "change_email",
        email: emailForm.email,
        currentPassword: emailForm.currentPassword,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!data.success) toast.error(data.message || "Unable to update email.");
    else {
      toast.success("Email updated.");
      setEmailForm((prev) => ({ ...prev, currentPassword: "" }));
      setProfile((prev) => ({ ...prev, email: emailForm.email }));
    }
    setSavingEmail(false);
  }

  async function updatePassword(e) {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New password and confirmation do not match.");
      return;
    }
    setSavingPassword(true);
    const res = await fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "change_password",
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!data.success) toast.error(data.message || "Unable to update password.");
    else {
      toast.success("Password updated.");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    }
    setSavingPassword(false);
  }

  return (
    <UserAppShell title="Profile">
      <section className="card-surface rounded-3xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="heading-display text-lg font-semibold">Account profile</h2>
          <span className="neon-chip inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em]">
            {String(profile.accountStatus || "pending_activation").replaceAll("_", " ")}
          </span>
        </div>
        <p className="mt-1 text-sm muted-text">Username, phone number, and referral code are not editable.</p>
        <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
          <div className="rounded-2xl border bg-[var(--surface-soft)] p-4">
            <p className="muted-text">Username</p>
            <p className="font-semibold">{profile.username || "-"}</p>
          </div>
          <div className="rounded-2xl border bg-[var(--surface-soft)] p-4">
            <p className="muted-text">Role</p>
            <p className="font-semibold uppercase">{profile.role || "-"}</p>
          </div>
          <div className="rounded-2xl border bg-[var(--surface-soft)] p-4">
            <p className="muted-text">Referral code</p>
            <p className="font-semibold">{profile.referralCode || "-"}</p>
          </div>
          <div className="rounded-2xl border bg-[var(--surface-soft)] p-4">
            <p className="muted-text">Referred by</p>
            <p className="font-semibold">{profile.referredBy?.username || "-"}</p>
          </div>
          <div className="rounded-2xl border bg-[var(--surface-soft)] p-4">
            <p className="muted-text">Email</p>
            <p className="font-semibold">{profile.email || "-"}</p>
          </div>
          <div className="rounded-2xl border bg-[var(--surface-soft)] p-4">
            <p className="muted-text">Phone</p>
            <p className="font-semibold">{profile.phoneNumber || "-"}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <form onSubmit={updateEmail} className="card-surface rounded-3xl p-6">
          <h3 className="heading-display text-base font-semibold">Change email</h3>
          <div className="mt-4 grid gap-3">
            <label className="text-sm">
              <span className="mb-1 block muted-text">New email</span>
              <input
                type="email"
                value={emailForm.email}
                onChange={(e) => setEmailForm((prev) => ({ ...prev, email: e.target.value }))}
                className="interactive-control w-full rounded-2xl px-3 py-2.5"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block muted-text">Current password</span>
              <input
                type="password"
                value={emailForm.currentPassword}
                onChange={(e) => setEmailForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                className="interactive-control w-full rounded-2xl px-3 py-2.5"
              />
            </label>
            <button disabled={savingEmail} className="primary-btn w-fit px-4 py-2 text-sm">
              {savingEmail ? "Saving..." : "Update email"}
            </button>
          </div>
        </form>

        <form onSubmit={updatePassword} className="card-surface rounded-3xl p-6">
          <h3 className="heading-display text-base font-semibold">Change password</h3>
          <div className="mt-4 grid gap-3">
            <label className="text-sm">
              <span className="mb-1 block muted-text">Current password</span>
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                className="interactive-control w-full rounded-2xl px-3 py-2.5"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block muted-text">New password</span>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                className="interactive-control w-full rounded-2xl px-3 py-2.5"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block muted-text">Confirm new password</span>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                className="interactive-control w-full rounded-2xl px-3 py-2.5"
              />
            </label>
            <button disabled={savingPassword} className="primary-btn w-fit px-4 py-2 text-sm">
              {savingPassword ? "Saving..." : "Update password"}
            </button>
          </div>
        </form>
      </section>
    </UserAppShell>
  );
}
