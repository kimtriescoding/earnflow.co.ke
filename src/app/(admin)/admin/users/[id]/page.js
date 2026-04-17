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
  const [activityTab, setActivityTab] = useState("transactions");

  const user = payload?.user;
  const wallet = payload?.wallet;
  const referral = payload?.referral || {};
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
