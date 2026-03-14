import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { buildLivenessPulseAlert } from "@/lib/notifications/pulse";
import {
  sendWebPushToSubscriptions,
  type StoredPushSubscription,
} from "@/lib/notifications/webpush";
import type { FinanceTransaction } from "@/lib/finance/insights";
import { buildFinanceSnapshot } from "@/lib/finance/insights";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("Missing env: CRON_SECRET");

  const authHeader = request.headers.get("authorization");
  const cronHeader = request.headers.get("x-cron-secret");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  return bearer === secret || cronHeader === secret;
}

type SubscriptionRow = StoredPushSubscription & {
  last_seen_at: string | null;
};

export async function GET(request: Request) {
  return runLivenessPulse(request);
}

export async function POST(request: Request) {
  return runLivenessPulse(request);
}

async function runLivenessPulse(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createSupabaseAdmin();
    const threshold = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data: subscriptions, error: subscriptionError } = await admin
      .from("push_subscriptions")
      .select("id, user_id, user_email, endpoint, p256dh, auth, disabled_at, last_seen_at")
      .is("disabled_at", null)
      .lt("last_seen_at", threshold)
      .order("last_seen_at", { ascending: true });

    if (subscriptionError) {
      return NextResponse.json({ error: subscriptionError.message }, { status: 500 });
    }

    const grouped = new Map<string, SubscriptionRow[]>();
    for (const subscription of ((subscriptions ?? []) as SubscriptionRow[]) ?? []) {
      const list = grouped.get(subscription.user_id) ?? [];
      list.push(subscription);
      grouped.set(subscription.user_id, list);
    }

    const results: Array<{ userId: string; sent: number; failed: number }> = [];
    for (const [userId, userSubscriptions] of grouped.entries()) {
      const summary = await processUserLivenessPulse(admin, userId, userSubscriptions);
      if (summary) results.push(summary);
    }

    return NextResponse.json({
      ok: true,
      processedUsers: grouped.size,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Liveness pulse failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function processUserLivenessPulse(
  admin: ReturnType<typeof createSupabaseAdmin>,
  userId: string,
  subscriptions: SubscriptionRow[],
) {
  const lastSeenAt = subscriptions[0]?.last_seen_at ?? null;
  const since = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();
  const { data: txData, error: txError } = await admin
    .from("transactions")
    .select("id, created_at, type, amount, note")
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (txError) {
    return null;
  }

  const snapshot = buildFinanceSnapshot(((txData ?? []) as FinanceTransaction[]) ?? []);
  const alert = buildLivenessPulseAlert({
    snapshot,
    lastSeenAt,
  });
  if (!alert) return null;

  const { data: existing } = await admin
    .from("notification_events")
    .select("id")
    .eq("user_id", userId)
    .eq("event_type", alert.eventType)
    .eq("dedupe_key", alert.dedupeKey)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    return null;
  }

  const result = await sendWebPushToSubscriptions(subscriptions, {
    title: alert.title,
    body: alert.body,
    url: alert.url,
    tag: alert.dedupeKey,
  });

  await admin.from("notification_events").insert({
    user_id: userId,
    event_type: alert.eventType,
    channel: "push",
    status: result.failed > 0 && result.sent === 0 ? "failed" : "sent",
    dedupe_key: alert.dedupeKey,
    payload: {
      ...alert.payload,
      sent: result.sent,
      failed: result.failed,
      failures: result.failures,
    },
    error_message:
      result.failed > 0 && result.sent === 0
        ? result.failures.map((item) => item.error).join(" | ")
        : null,
  });

  return { userId, sent: result.sent, failed: result.failed };
}
