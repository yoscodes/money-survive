import webpush from "web-push";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export type StoredPushSubscription = {
  id: string;
  user_id: string;
  user_email: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  disabled_at: string | null;
};

export type PushMessage = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

let configured = false;

function configureWebPush() {
  if (configured) return;

  webpush.setVapidDetails(
    getEnv("VAPID_SUBJECT"),
    getEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY"),
    getEnv("VAPID_PRIVATE_KEY"),
  );
  configured = true;
}

export function supportsWebPushConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

export async function sendWebPushToSubscriptions(
  subscriptions: StoredPushSubscription[],
  message: PushMessage,
) {
  if (!supportsWebPushConfig()) {
    return {
      sent: 0,
      failed: subscriptions.length,
      failures: subscriptions.map((subscription) => ({
        subscriptionId: subscription.id,
        error: "Missing VAPID configuration",
      })),
    };
  }

  configureWebPush();
  const admin = createSupabaseAdmin();
  let sent = 0;
  let failed = 0;
  const failures: Array<{ subscriptionId: string; error: string }> = [];

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        JSON.stringify(message),
      );
      sent += 1;
    } catch (error) {
      failed += 1;
      const messageText = error instanceof Error ? error.message : "Push send failed";
      failures.push({ subscriptionId: subscription.id, error: messageText });

      const statusCode =
        typeof error === "object" &&
        error !== null &&
        "statusCode" in error &&
        typeof (error as { statusCode?: unknown }).statusCode === "number"
          ? (error as { statusCode: number }).statusCode
          : null;

      if (statusCode === 404 || statusCode === 410) {
        await admin
          .from("push_subscriptions")
          .update({ disabled_at: new Date().toISOString() })
          .eq("id", subscription.id);
      }
    }
  }

  return { sent, failed, failures };
}
