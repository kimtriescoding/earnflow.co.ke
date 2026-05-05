"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { AppShell } from "@/components/ui/AppShell";
import { adminNavItems } from "@/lib/nav/admin-nav";
import { StatusChip } from "@/components/ui/StatusChip";

export default function AdminUserDetailPage() {
  const params = useParams();
  const userId = params.id;
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState({ username: "", email: "", phoneNumber: "", role: "user" });
  const [passwordReset, setPasswordReset] = useState({ password: "", confirmPassword: "" });
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [activityTab, setActivityTab] = useState("transactions");
  const [referrerAssign, setReferrerAssign] = useState({
    referrer: "",
    distributeCommission: false,
    loading: false,
  });

  const user = payload?.user;
  const wallet = payload?.wallet;
  const referral = payload?.referral || {};
  const hasDirectReferrer = Boolean(
    user?.referredByUserId || user?.uplineL1UserId || referral?.referrer || referral?.uplineL1
  );
  const totals = payload?.totals || { totalWithdrawals: 0 };
  const transactions = payload?.transactions || [];
  const latestTransactions = payload?.latestTransactions || [];
  const activityTransactions = latestTransactions.length ? latestTransactions : transactions;
  const withdrawals = payload?.withdrawals || [];

  const withdrawable = useMemo(() => Number(wallet?.availableBalance || 0).toFixed(2), [wallet]);

  async function fetchUserData() {
    const res = await fetch(`/api/admin/users/${userId}`);
    const data = await res.json();
    if (!data.success) {
      toast.error(data.message || "Unable to load user details.");
      setLoading(false);
      return;
    }
    setPayload(data.data);
    setEditing({
      username: data.data.user.username || "",
      email: data.data.user.email || "",
      phoneNumber: data.data.user.phoneNumber || "",
      role: data.data.user.role || "user",
    });
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/admin/users/${userId}`);
        const data = await res.json();
        if (!active) return;
        if (!data.success) {
          toast.error(data.message || "Unable to load user details.");
          setLoading(false);
          return;
        }
        setPayload(data.data);
        setEditing({
          username: data.data.user.username || "",
          email: data.data.user.email || "",
          phoneNumber: data.data.user.phoneNumber || "",
          role: data.data.user.role || "user",
        });
        setLoading(false);
      } catch {
        if (!active) return;
        toast.error("Failed to fetch user details.");
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  async function runAction(type) {
    if (!user) return;
    if (type === "impersonate") {
      const res = await fetch(`/api/admin/users/${userId}/impersonate`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success("Impersonation started.");
        window.location.href = "/dashboard";
      } else {
        toast.error(data.message || "Impersonation failed.");
      }
      return;
    }

    if (type === "delete") {
      const confirmed = window.confirm("Delete this user permanently?");
      if (!confirmed) return;
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("User deleted.");
        window.location.href = "/admin/users";
      } else {
        toast.error(data.message || "Delete failed.");
      }
      return;
    }

    const updates =
      type === "block"
        ? { isBlocked: true }
        : type === "unblock"
          ? { isBlocked: false }
          : type === "activate"
            ? { isActivated: true }
            : { isActivated: false };

    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (data.success) {
      toast.success("User updated.");
      setLoading(true);
      await fetchUserData();
    } else {
      toast.error(data.message || "Action failed.");
    }
  }

  async function saveProfile() {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    const data = await res.json();
    if (data.success) {
      toast.success("Profile updated.");
      setLoading(true);
      await fetchUserData();
    } else {
      toast.error(data.message || "Update failed.");
    }
  }

  async function assignReferrer() {
    if (hasDirectReferrer) return;
    const referrer = String(referrerAssign.referrer || "").trim();
    if (!referrer || !userId) {
      toast.error("Enter the referrer username or user id.");
      return;
    }
    setReferrerAssign((p) => ({ ...p, loading: true }));
    try {
      const res = await fetch(`/api/admin/users/${userId}/referrer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referrer,
          distributeCommission: referrerAssign.distributeCommission,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        toast.success(data.message || "Referrer updated.");
        setReferrerAssign({ referrer: "", distributeCommission: false, loading: false });
        setLoading(true);
        await fetchUserData();
      } else {
        toast.error(data.message || "Referrer assignment failed.");
        setReferrerAssign((p) => ({ ...p, loading: false }));
      }
    } catch {
      toast.error("Network error.");
      setReferrerAssign((p) => ({ ...p, loading: false }));
    }
  }

  async function resetPassword() {
    const password = String(passwordReset.password || "");
    const confirmPassword = String(passwordReset.confirmPassword || "");
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    const confirmed = window.confirm("Reset this user's password?");
    if (!confirmed) return;

    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (data.success) {
      toast.success("Password reset successful.");
      setPasswordReset({ password: "", confirmPassword: "" });
    } else {
      toast.error(data.message || "Password reset failed.");
    }
  }

  return (
    <AppShell title="User Detail & Actions" navItems={adminNavItems}>
      <div className="card-surface rounded-3xl section-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="heading-display text-lg font-semibold">Detailed user profile</h2>
          <Link href="/admin/users" className="secondary-btn px-3 py-2.5 text-sm">
            Back to users
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="card-surface rounded-3xl section-card text-sm muted-text">Loading user details...</div>
      ) : !user ? (
        <div className="card-surface rounded-3xl section-card text-sm text-[var(--danger)]">User not found.</div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="card-surface rounded-3xl section-card">
              <p className="text-xs uppercase tracking-[0.12em] muted-text">Withdrawable</p>
              <p className="heading-display mt-2 text-2xl font-semibold">KES {withdrawable}</p>
            </div>
            <div className="card-surface rounded-3xl section-card">
              <p className="text-xs uppercase tracking-[0.12em] muted-text">Lifetime Earnings</p>
              <p className="heading-display mt-2 text-2xl font-semibold">KES {Number(wallet?.lifetimeEarnings || 0).toFixed(2)}</p>
            </div>
            <div className="card-surface rounded-3xl section-card">
              <p className="text-xs uppercase tracking-[0.12em] muted-text">Total Withdrawals</p>
              <p className="heading-display mt-2 text-2xl font-semibold">KES {Number(totals.totalWithdrawals || 0).toFixed(2)}</p>
            </div>
            <div className="card-surface rounded-3xl section-card">
              <p className="text-xs uppercase tracking-[0.12em] muted-text">Direct Referrals</p>
              <p className="heading-display mt-2 text-2xl font-semibold">{referral.directReferrals || 0}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="card-surface rounded-3xl section-card">
              <h3 className="heading-display text-base font-semibold">Profile edit</h3>
              <div className="mt-3 grid gap-3">
                <input
                  className="interactive-control focus-ring px-3.5 py-2.5 text-sm"
                  value={editing.username}
                  onChange={(e) => setEditing((p) => ({ ...p, username: e.target.value }))}
                  placeholder="Username"
                />
                <input
                  className="interactive-control focus-ring px-3.5 py-2.5 text-sm"
                  value={editing.email}
                  onChange={(e) => setEditing((p) => ({ ...p, email: e.target.value }))}
                  placeholder="Email"
                />
                <input
                  className="interactive-control focus-ring px-3.5 py-2.5 text-sm"
                  value={editing.phoneNumber}
                  onChange={(e) => setEditing((p) => ({ ...p, phoneNumber: e.target.value }))}
                  placeholder="Phone"
                />
                <select
                  className="interactive-control focus-ring px-3.5 py-2.5 text-sm"
                  value={editing.role}
                  onChange={(e) => setEditing((p) => ({ ...p, role: e.target.value }))}
                >
                  <option value="user">user</option>
                  <option value="client">client</option>
                  <option value="support">support</option>
                  <option value="admin">admin</option>
                </select>
                <button onClick={saveProfile} className="primary-btn w-fit px-4 py-2 text-sm">
                  Save profile
                </button>
              </div>
            </div>

            <div className="card-surface rounded-3xl section-card">
              <h3 className="heading-display text-base font-semibold">Admin actions</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => runAction("impersonate")} className="primary-btn px-4 py-2 text-sm">
                  Impersonate
                </button>
                {user.isBlocked ? (
                  <button onClick={() => runAction("unblock")} className="secondary-btn px-4 py-2 text-sm">
                    Unblock
                  </button>
                ) : (
                  <button onClick={() => runAction("block")} className="secondary-btn px-4 py-2 text-sm">
                    Block
                  </button>
                )}
                {user.isActivated ? (
                  <button onClick={() => runAction("deactivate")} className="secondary-btn px-4 py-2 text-sm">
                    Deactivate
                  </button>
                ) : (
                  <button onClick={() => runAction("activate")} className="secondary-btn px-4 py-2 text-sm">
                    Activate
                  </button>
                )}
                <button onClick={() => runAction("delete")} className="secondary-btn px-4 py-2 text-sm text-[var(--danger)]">
                  Delete
                </button>
              </div>
              <div className="mt-4 text-sm muted-text">
                <p>Status: {user.isBlocked ? "Blocked" : "Active"}</p>
                <p>Activation: {user.isActivated ? "Activated" : "Not activated"}</p>
              </div>
              <div className="mt-4 grid gap-2 border-t border-[var(--border)] pt-4">
                <p className="text-xs uppercase tracking-[0.12em] muted-text">Reset user password</p>
                <input
                  type={showResetPassword ? "text" : "password"}
                  className="interactive-control focus-ring px-3.5 py-2.5 text-sm"
                  value={passwordReset.password}
                  onChange={(e) => setPasswordReset((p) => ({ ...p, password: e.target.value }))}
                  placeholder="New password"
                />
                <input
                  type={showResetPassword ? "text" : "password"}
                  className="interactive-control focus-ring px-3.5 py-2.5 text-sm"
                  value={passwordReset.confirmPassword}
                  onChange={(e) => setPasswordReset((p) => ({ ...p, confirmPassword: e.target.value }))}
                  placeholder="Confirm new password"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowResetPassword((v) => !v)}
                    className="secondary-btn w-fit px-4 py-2 text-sm"
                  >
                    {showResetPassword ? "Hide password" : "Show password"}
                  </button>
                  <button onClick={resetPassword} className="secondary-btn w-fit px-4 py-2 text-sm">
                    Reset password
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="card-surface rounded-3xl section-card">
            <h3 className="heading-display text-base font-semibold">Referral hierarchy</h3>
            <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
              <p>Referrer: {referral.referrer?.username || "-"}</p>
              <p>Level 1 upline: {referral.uplineL1?.username || "-"}</p>
              <p>Level 2 upline: {referral.uplineL2?.username || "-"}</p>
              <p>Level 3 upline: {referral.uplineL3?.username || "-"}</p>
            </div>

            {!hasDirectReferrer ? (
              <div className="mt-5 border-t border-[var(--border)] pt-5">
                <p className="text-xs uppercase tracking-[0.12em] muted-text">Assign direct referrer</p>
                <p className="mt-1 max-w-2xl text-sm muted-text">
                  Available only when this account has no direct referrer yet. Set L1 only; level 2 and 3 follow from that
                  member&apos;s upline (same as signup).
                </p>
                <div className="mt-4 grid gap-3 sm:max-w-md">
                  <input
                    className="interactive-control focus-ring px-3.5 py-2.5 text-sm"
                    value={referrerAssign.referrer}
                    onChange={(e) => setReferrerAssign((p) => ({ ...p, referrer: e.target.value }))}
                    placeholder="Referrer username or user id"
                    disabled={referrerAssign.loading}
                  />
                  <label className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1 rounded border-[var(--border)]"
                      checked={referrerAssign.distributeCommission}
                      onChange={(e) => setReferrerAssign((p) => ({ ...p, distributeCommission: e.target.checked }))}
                      disabled={referrerAssign.loading || !user?.isActivated}
                    />
                    <span>
                      Distribute signup commissions now (activated accounts only; idempotent — no duplicate payouts).
                      {!user?.isActivated ? (
                        <span className="mt-0.5 block text-xs muted-text">Activate this user first to enable commission distribution.</span>
                      ) : null}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => void assignReferrer()}
                    className="primary-btn w-fit px-4 py-2 text-sm disabled:opacity-60"
                    disabled={referrerAssign.loading || !String(referrerAssign.referrer || "").trim()}
                  >
                    {referrerAssign.loading ? "Saving…" : "Assign referrer"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5 border-t border-[var(--border)] pt-5">
                <p className="text-xs uppercase tracking-[0.12em] muted-text">Assign direct referrer</p>
                <p className="mt-1 max-w-xl text-sm muted-text">
                  Not shown — this user already has a direct referrer. Assignment is only allowed for accounts without one.
                </p>
              </div>
            )}
          </div>

          <div className="card-surface rounded-3xl section-card">
            <h3 className="heading-display text-base font-semibold">Activity</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActivityTab("transactions")}
                className={activityTab === "transactions" ? "primary-btn px-4 py-2 text-sm" : "secondary-btn px-4 py-2 text-sm"}
              >
                Transactions
              </button>
              <button
                type="button"
                onClick={() => setActivityTab("withdrawals")}
                className={activityTab === "withdrawals" ? "primary-btn px-4 py-2 text-sm" : "secondary-btn px-4 py-2 text-sm"}
              >
                Withdrawals
              </button>
            </div>

            {activityTab === "transactions" ? (
              <>
                <div className="mt-3 grid gap-3 md:hidden">
                  {activityTransactions.slice(0, 15).length ? (
                    activityTransactions.slice(0, 15).map((tx) => (
                      <article key={String(tx._id)} className="rounded-2xl border bg-[var(--surface)] px-3 py-3 text-sm">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] muted-text">Type</p>
                            <p>{tx.type}</p>
                          </div>
                          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] muted-text">Amount</p>
                            <p>{Number(tx.amount || 0).toFixed(2)}</p>
                          </div>
                          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] muted-text">Status</p>
                            <StatusChip status={tx.status} />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] muted-text">Date</p>
                            <p className="text-right">{new Date(tx.createdAt).toLocaleString()}</p>
                          </div>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="text-sm muted-text">No transactions found.</p>
                  )}
                </div>
                <div className="mt-3 hidden overflow-x-auto rounded-xl border md:block">
                  <table className="min-w-full text-sm">
                    <thead className="bg-[var(--surface-soft)]">
                      <tr>
                        <th className="px-2 py-2 text-left">Type</th>
                        <th className="px-2 py-2 text-left">Amount</th>
                        <th className="px-2 py-2 text-left">Status</th>
                        <th className="px-2 py-2 text-left">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activityTransactions.slice(0, 15).length ? (
                        activityTransactions.slice(0, 15).map((tx) => (
                          <tr key={String(tx._id)} className="border-t">
                            <td className="px-2 py-2">{tx.type}</td>
                            <td className="px-2 py-2">{Number(tx.amount || 0).toFixed(2)}</td>
                            <td className="px-2 py-2">
                              <StatusChip status={tx.status} />
                            </td>
                            <td className="px-2 py-2">{new Date(tx.createdAt).toLocaleString()}</td>
                          </tr>
                        ))
                      ) : (
                        <tr className="border-t">
                          <td className="px-2 py-3 muted-text" colSpan={4}>
                            No transactions found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <>
                <div className="mt-3 grid gap-3 md:hidden">
                  {withdrawals.slice(0, 15).length ? (
                    withdrawals.slice(0, 15).map((wd) => (
                      <article key={wd._id} className="rounded-2xl border bg-[var(--surface)] px-3 py-3 text-sm">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] muted-text">Amount</p>
                            <p>{Number(wd.amount || 0).toFixed(2)}</p>
                          </div>
                          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] muted-text">Fee</p>
                            <p>{Number(wd.fee || 0).toFixed(2)}</p>
                          </div>
                          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] muted-text">Status</p>
                            <StatusChip status={wd.status} />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] muted-text">Date</p>
                            <p className="text-right">{new Date(wd.createdAt).toLocaleString()}</p>
                          </div>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="text-sm muted-text">No withdrawals found.</p>
                  )}
                </div>
                <div className="mt-3 hidden overflow-x-auto rounded-xl border md:block">
                  <table className="min-w-full text-sm">
                    <thead className="bg-[var(--surface-soft)]">
                      <tr>
                        <th className="px-2 py-2 text-left">Amount</th>
                        <th className="px-2 py-2 text-left">Fee</th>
                        <th className="px-2 py-2 text-left">Method</th>
                        <th className="px-2 py-2 text-left">Status</th>
                        <th className="px-2 py-2 text-left">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {withdrawals.slice(0, 15).length ? (
                        withdrawals.slice(0, 15).map((wd) => (
                          <tr key={wd._id} className="border-t">
                            <td className="px-2 py-2">{Number(wd.amount || 0).toFixed(2)}</td>
                            <td className="px-2 py-2">{Number(wd.fee || 0).toFixed(2)}</td>
                            <td className="px-2 py-2">{wd.method || "-"}</td>
                            <td className="px-2 py-2">
                              <StatusChip status={wd.status} />
                            </td>
                            <td className="px-2 py-2">{new Date(wd.createdAt).toLocaleString()}</td>
                          </tr>
                        ))
                      ) : (
                        <tr className="border-t">
                          <td className="px-2 py-3 muted-text" colSpan={5}>
                            No withdrawals found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}
