import webpush from "web-push";
import connectDB from "@/lib/db";
import { getEnv } from "@/lib/env";
import PushSubscription from "@/models/PushSubscription";
import { logError } from "@/lib/observability/logger";

let vapidConfigured = false;

export function isWebPushConfigured() {
  try {
    const env = getEnv();
    return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
  } catch {
    return false;
  }
}

export function configureWebPushIfNeeded() {
  if (vapidConfigured) return true;
  const env = getEnv();
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return false;
  const subject = env.VAPID_SUBJECT || "mailto:notifications@earnflow";
  webpush.setVapidDetails(subject, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  vapidConfigured = true;
  return true;
}

/**
 * Sends a Web Push payload to every stored subscription for the user (best-effort).
 */
export async function sendReferralCommissionWebPush({ userId, amount, level }) {
  if (!isWebPushConfigured()) return;
  if (!configureWebPushIfNeeded()) return;

  await connectDB();
  const subs = await PushSubscription.find({ userId }).lean();
  if (!subs.length) return;

  const env = getEnv();
  const baseUrl = String(env.APP_URL || "").replace(/\/$/, "");
  const iconUrl = baseUrl ? `${baseUrl}/icon.png` : undefined;

  const title = "New referral commission";
  const body = `KES ${Number(amount || 0).toFixed(2)} · Level ${Number(level)} bonus`;
  const payload = JSON.stringify({
    title,
    body,
    url: baseUrl ? `${baseUrl}/dashboard` : "/dashboard",
    icon: iconUrl,
  });

  for (const row of subs) {
    const subscription = {
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth },
    };
    try {
      await webpush.sendNotification(subscription, payload, {
        TTL: 60 * 60 * 24,
        urgency: "normal",
      });
    } catch (err) {
      const status = err?.statusCode;
      if (status === 404 || status === 410) {
        await PushSubscription.deleteOne({ _id: row._id }).catch(() => {});
      } else {
        logError("notifications.web_push_failed", {
          userId: String(userId),
          status,
          message: err?.message || "unknown",
        });
      }
    }
  }
}
