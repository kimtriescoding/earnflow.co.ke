"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";

function normalizeVapidPublicKeyFromApi(s) {
  if (!s || typeof s !== "string") return "";
  let t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    t = t.slice(1, -1).trim();
  }
  return t.replace(/\s+/g, "");
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

/** web-push `generate-vapid-keys` public key decodes to 65 bytes (uncompressed P-256). */
const EXPECTED_VAPID_PUBLIC_KEY_BYTES = 65;

function isLocalPushDevHostname() {
  if (typeof window === "undefined") return false;
  const h = (window.location.hostname || "").toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h.endsWith(".local");
}

function pushSubscribeErrorMessage(err) {
  const name = err?.name || "";
  const msg = String(err?.message || err || "");
  if (name === "NotAllowedError" || /permission/i.test(msg)) {
    return "Notifications are blocked for this site. Allow them in the browser address bar or site settings.";
  }
  if (name === "SecurityError" || /secure context/i.test(msg)) {
    return "Push needs HTTPS (or localhost). Open the app over https:// or http://localhost.";
  }
  if (name === "AbortError") {
    const base = "The push handshake was aborted after several retries.";
    const local =
      " For local development, use http://localhost (not a raw LAN IP). In DevTools → Application → Service Workers, click Unregister, reload, then try again.";
    const production =
      " On production this usually means the browser could not finish talking to the push service (corporate firewall/VPN, DNS or content filtering, data saver, or a privacy extension). Try another network or device, pause blockers, confirm the site is served over HTTPS, then DevTools → Application → Service Workers → Unregister for this origin and try again.";
    return base + (isLocalPushDevHostname() ? local : production);
  }
  if (/push service error/i.test(msg)) {
    return [
      "The push provider rejected the subscription (invalid or mismatched VAPID keys on the server).",
      "Regenerate keys (`pnpm run vapid:keys`), set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in the deployed environment, restart the app, and confirm with `pnpm run vapid:verify` using that same .env.",
    ].join(" ");
  }
  return msg || "Could not enable browser alerts.";
}

/** `reg.update()` + immediate subscribe races Chrome/Firefox; retries cover flaky push endpoints. */
async function subscribePushWithRetries(pushManager, applicationServerKey) {
  const backoffMs = [0, 600, 1800, 4000];
  let lastErr;
  for (let i = 0; i < backoffMs.length; i += 1) {
    if (backoffMs[i] > 0) {
      await new Promise((r) => setTimeout(r, backoffMs[i]));
    }
    try {
      const key = new Uint8Array(applicationServerKey);
      return await pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      });
    } catch (e) {
      lastErr = e;
      const n = e?.name || "";
      const m = String(e?.message || "");
      const retryable = n === "AbortError" || /push service error/i.test(m) || /networkerror/i.test(m);
      if (!retryable || i === backoffMs.length - 1) {
        throw e;
      }
    }
  }
  throw lastErr;
}

export function UserNotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const knownIdsRef = useRef(new Set());
  const seededRef = useRef(false);
  const rootRef = useRef(null);

  const fetchNotifications = useCallback(async (opts = { silent: false }) => {
    if (!opts.silent) setLoading(true);
    try {
      const res = await fetch("/api/user/notifications?limit=40");
      const data = await res.json();
      if (!data.success) return;
      const list = data.data?.items || [];
      const unread = Number(data.data?.unreadCount || 0);
      setItems(list);
      setUnreadCount(unread);

      const nextIds = new Set(list.map((n) => n.id));
      if (!seededRef.current) {
        list.forEach((n) => knownIdsRef.current.add(n.id));
        seededRef.current = true;
        return;
      }
      for (const n of list) {
        if (!knownIdsRef.current.has(n.id)) {
          knownIdsRef.current.add(n.id);
          if (n.type === "commission_referral") {
            toast.success(n.title, { description: n.body });
          } else {
            toast.message(n.title, { description: n.body });
          }
        }
      }
      for (const id of knownIdsRef.current) {
        if (!nextIds.has(id)) knownIdsRef.current.delete(id);
      }
    } catch {
      /* ignore */
    } finally {
      if (!opts.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPushSupported(Boolean("serviceWorker" in navigator && "PushManager" in window));
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void fetchNotifications({ silent: true });
    }, 22_000);
    return () => window.clearInterval(t);
  }, [fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function markRead(ids) {
    if (!ids.length) return;
    await fetch("/api/user/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    await fetchNotifications({ silent: true });
  }

  async function markAllRead() {
    await fetch("/api/user/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    await fetchNotifications({ silent: true });
  }

  async function enablePush() {
    if (!pushSupported) {
      toast.error("Push notifications are not supported in this browser.");
      return;
    }
    setPushBusy(true);
    try {
      let vapidRes;
      try {
        vapidRes = await fetch("/api/user/notifications/vapid-public-key");
      } catch {
        toast.error("Could not reach the server to load push settings. Check your connection and try again.");
        return;
      }
      const vapidJson = await vapidRes.json().catch(() => ({}));
      if (!vapidRes.ok || !vapidJson.success) {
        toast.error(vapidJson.message || "Browser alerts are not configured on the server.");
        return;
      }
      const publicKeyRaw = vapidJson.data?.publicKey;
      const publicKey = normalizeVapidPublicKeyFromApi(publicKeyRaw);
      if (!publicKey) {
        toast.error("Missing VAPID public key.");
        return;
      }
      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      if (applicationServerKey.length !== EXPECTED_VAPID_PUBLIC_KEY_BYTES) {
        toast.error(
          `VAPID public key decodes to ${applicationServerKey.length} bytes (expected ${EXPECTED_VAPID_PUBLIC_KEY_BYTES}). Check .env: use the public key from the same pair as VAPID_PRIVATE_KEY, one line, no spaces.`
        );
        return;
      }
      if (!window.isSecureContext) {
        toast.error("Push needs a secure context. Use https:// or open the site at http://localhost (not a raw LAN IP) for local testing.");
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast.error("Notification permission was not granted.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      await reg.ready;
      const regForPush = reg;
      await new Promise((r) => setTimeout(r, 280));
      const existing = await regForPush.pushManager.getSubscription();
      if (existing) {
        try {
          await existing.unsubscribe();
        } catch {
          /* continue; subscribe may still work */
        }
      }
      let sub;
      try {
        sub = await subscribePushWithRetries(regForPush.pushManager, applicationServerKey);
      } catch (e) {
        toast.error(pushSubscribeErrorMessage(e));
        return;
      }
      const j = sub.toJSON();
      let save;
      try {
        save = await fetch("/api/user/notifications/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: j.endpoint, keys: j.keys }),
        });
      } catch {
        toast.error("Could not reach the server to save this device. Check your connection and try again.");
        return;
      }
      const saveJson = await save.json().catch(() => ({}));
      if (!save.ok || !saveJson.success) {
        toast.error(saveJson.message || "Could not save this device for alerts.");
        return;
      }
      toast.success("Browser alerts enabled for this device.");
      void regForPush.update();
    } catch (e) {
      toast.error(pushSubscribeErrorMessage(e));
    } finally {
      setPushBusy(false);
    }
  }

  const Icon = unreadCount > 0 ? BellRing : Bell;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((p) => !p);
          void fetchNotifications({ silent: true });
        }}
        className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface-soft)_90%,transparent)] text-[var(--foreground)] transition hover:border-[color-mix(in_srgb,var(--brand)_44%,var(--border))] hover:shadow-[0_0_18px_color-mix(in_srgb,var(--brand)_22%,transparent)] sm:h-10 sm:w-10"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
      >
        <Icon className="h-4 w-4 sm:h-[1.05rem] sm:w-[1.05rem]" strokeWidth={2} aria-hidden />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[9px] font-bold text-white shadow-sm">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="card-strong neon-outline absolute right-0 z-50 mt-2 w-[min(100vw-2rem,22rem)] max-h-[min(70vh,26rem)] overflow-hidden rounded-2xl shadow-xl">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
            <p className="text-sm font-semibold">Notifications</p>
            <div className="flex items-center gap-1">
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-[var(--muted)]" aria-hidden /> : null}
              {unreadCount > 0 ? (
                <button type="button" className="text-[11px] font-medium text-[var(--brand)] hover:underline" onClick={() => void markAllRead()}>
                  Mark all read
                </button>
              ) : null}
            </div>
          </div>
          <div className="max-h-[min(52vh,20rem)] overflow-y-auto overscroll-contain px-1 py-1">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm muted-text">You&apos;re all caught up.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className="flex w-full flex-col gap-0.5 rounded-xl px-2.5 py-2 text-left text-sm transition hover:bg-[var(--surface-soft)]"
                  onClick={() => {
                    if (!n.read) void markRead([n.id]);
                  }}
                >
                  <span className={`font-semibold leading-snug ${n.read ? "muted-text" : ""}`}>{n.title}</span>
                  <span className="text-[12px] leading-snug muted-text">{n.body}</span>
                  <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                    {n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}
                  </span>
                </button>
              ))
            )}
          </div>
          {pushSupported ? (
            <div className="border-t border-[var(--border)] px-3 py-2">
              <button
                type="button"
                disabled={pushBusy}
                onClick={() => void enablePush()}
                className="secondary-btn w-full justify-center px-2 py-2 text-xs sm:text-sm"
              >
                {pushBusy ? "Working…" : "Enable browser alerts"}
              </button>
              <p className="mt-1 text-[10px] leading-snug muted-text">Get notified when you earn referral commissions, even with the tab in the background.</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
