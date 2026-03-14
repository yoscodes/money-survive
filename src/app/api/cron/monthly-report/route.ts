import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendRetentionMail } from "@/lib/notifications/mailer";
import { buildMonthlySummary } from "@/lib/notifications/pulse";
import {
  sendWebPushToSubscriptions,
  type StoredPushSubscription,
} from "@/lib/notifications/webpush";
import type { FinanceTransaction } from "@/lib/finance/insights";

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
  return runMonthlyReport(request);
}

export async function POST(request: Request) {
  return runMonthlyReport(request);
}

async function runMonthlyReport(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createSupabaseAdmin();
    const { data: subscriptions, error: subscriptionError } = await admin
      .from("push_subscriptions")
      .select("id, user_id, user_email, endpoint, p256dh, auth, disabled_at, last_seen_at")
      .is("disabled_at", null)
      .order("last_seen_at", { ascending: false });

    if (subscriptionError) {
      return NextResponse.json({ error: subscriptionError.message }, { status: 500 });
    }

    const grouped = new Map<string, SubscriptionRow[]>();
    for (const subscription of ((subscriptions ?? []) as SubscriptionRow[]) ?? []) {
      const list = grouped.get(subscription.user_id) ?? [];
      list.push(subscription);
      grouped.set(subscription.user_id, list);
    }

    const results: Array<{ userId: string; pushSent: number; pushFailed: number }> = [];
    for (const [userId, userSubscriptions] of grouped.entries()) {
      const summary = await processUserMonthlyReport(admin, userId, userSubscriptions);
      if (summary) results.push(summary);
    }

    return NextResponse.json({
      ok: true,
      processedUsers: grouped.size,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Monthly report failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function processUserMonthlyReport(
  admin: ReturnType<typeof createSupabaseAdmin>,
  userId: string,
  subscriptions: SubscriptionRow[],
) {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const dedupeKey = `monthly:${userId}:${monthKey}`;

  const { data: existing } = await admin
    .from("notification_events")
    .select("id")
    .eq("user_id", userId)
    .eq("event_type", "monthly_report")
    .eq("dedupe_key", dedupeKey)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    return null;
  }

  const since = new Date(now.getTime() - 70 * 24 * 60 * 60 * 1000).toISOString();
  const { data: txData, error: txError } = await admin
    .from("transactions")
    .select("id, created_at, type, amount, note")
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (txError) {
    await admin.from("notification_events").insert({
      user_id: userId,
      event_type: "monthly_report",
      channel: "push",
      status: "failed",
      dedupe_key: dedupeKey,
      payload: { reason: txError.message },
      error_message: txError.message,
    });
    return { userId, pushSent: 0, pushFailed: subscriptions.length };
  }

  const summary = buildMonthlySummary(((txData ?? []) as FinanceTransaction[]) ?? [], now);
  const pushResult = await sendWebPushToSubscriptions(subscriptions, {
    title: summary.title,
    body: summary.body,
    url: summary.pushUrl,
    tag: `monthly-${summary.monthKey}`,
  });

  await admin.from("notification_events").insert({
    user_id: userId,
    event_type: "monthly_report",
    channel: "push",
    status: pushResult.failed > 0 && pushResult.sent === 0 ? "failed" : "sent",
    dedupe_key: dedupeKey,
    payload: {
      deltaDays: summary.deltaDays,
      netChange: summary.netChange,
      expenseTotal: summary.expenseTotal,
      incomeTotal: summary.incomeTotal,
      failures: pushResult.failures,
    },
    error_message:
      pushResult.failed > 0 && pushResult.sent === 0
        ? pushResult.failures.map((item) => item.error).join(" | ")
        : null,
  });

  const emailTo = subscriptions.find((item) => item.user_email)?.user_email ?? null;
  try {
    const mailResult = await sendRetentionMail({
      userId,
      to: emailTo,
      subject: summary.subject,
      body: summary.body,
      reportKey: summary.monthKey,
      title: summary.title,
      tone: summary.tone,
      ctaUrl: summary.pushUrl,
      ctaLabel: "バディの状態を見る",
      metricLabel: summary.tone === "positive" ? "今月の寿命差分" : "危険ライン",
      metricValue:
        summary.tone === "positive"
          ? `+${Math.max(1, summary.deltaDays)}日`
          : summary.depletionDateLabel ?? "記録再開",
    });

    await admin.from("notification_events").insert({
      user_id: userId,
      event_type: "monthly_report",
      channel: mailResult.channel,
      status: "sent",
      dedupe_key: `${dedupeKey}:email`,
      payload: {
        to: emailTo,
        subject: summary.subject,
        body: summary.body,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "email send failed";
    await admin.from("notification_events").insert({
      user_id: userId,
      event_type: "monthly_report",
      channel: "email",
      status: "failed",
      dedupe_key: `${dedupeKey}:email`,
      payload: { to: emailTo, subject: summary.subject },
      error_message: message,
    });
  }

  return { userId, pushSent: pushResult.sent, pushFailed: pushResult.failed };
}
