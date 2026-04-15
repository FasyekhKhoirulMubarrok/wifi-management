import webpush from "web-push";
import { db } from "@/lib/db";

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL ?? "admin@fadiljaya.com"}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

export interface NotificationPayload {
  title: string;
  body:  string;
  url?:  string;
}

/** Send a push notification to one subscription. Cleans up expired endpoints automatically. */
export async function sendPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: NotificationPayload,
): Promise<void> {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
    );
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      // Subscription expired or unregistered — remove from DB
      await db.pushSubscription.deleteMany({ where: { endpoint: subscription.endpoint } });
    }
    // Other errors (e.g. VAPID misconfigured) are silently ignored
  }
}

/** Send a notification to all admin subscriptions. */
export async function notifyAllAdmins(payload: NotificationPayload): Promise<void> {
  const subs = await db.pushSubscription.findMany({ where: { userType: "admin" } });
  await Promise.all(subs.map((s) => sendPush(s, payload)));
}

/** Send a notification to subscriptions for a specific user ID. */
export async function notifyUser(userId: string, payload: NotificationPayload): Promise<void> {
  const subs = await db.pushSubscription.findMany({ where: { userId } });
  await Promise.all(subs.map((s) => sendPush(s, payload)));
}
