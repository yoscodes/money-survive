"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { buildFinanceSnapshot, type FinanceTransaction } from "@/lib/finance/insights";
import { detectImmediatePulseAlerts } from "@/lib/notifications/pulse";
import {
  sendWebPushToSubscriptions,
  type StoredPushSubscription,
} from "@/lib/notifications/webpush";

export type TxActionState = { error?: string | null };

function getString(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

export async function addTransaction(
  _prevState: TxActionState,
  formData: FormData,
): Promise<TxActionState> {
  const type = getString(formData, "type");
  const amountRaw = getString(formData, "amount");
  const note = getString(formData, "note").trim();

  if (type !== "income" && type !== "expense") return { error: "type が不正です" };

  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) return { error: "金額を正しく入力してください" };

  const supabase = await createSupabaseServer();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "ログインが必要です" };

  const { data: inserted, error } = await supabase
    .from("transactions")
    .insert({
      user_id: userData.user.id,
      type,
      amount,
      note: note.length ? note : null,
    })
    .select("id, created_at, type, amount, note")
    .single();

  if (error) return { error: error.message };

  try {
    await maybeSendImmediatePulse(userData.user.id, inserted as FinanceTransaction);
  } catch {
    // 通知失敗は家計ログ追加を失敗させない。
  }

  revalidatePath("/dashboard");
  return { error: null };
}

export async function deleteTransaction(id: string) {
  const supabase = await createSupabaseServer();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  await supabase.from("transactions").delete().eq("id", id);
  revalidatePath("/dashboard");
}

async function maybeSendImmediatePulse(userId: string, inserted: FinanceTransaction) {
  const supabase = await createSupabaseServer();
  const { data: txData, error: txError } = await supabase
    .from("transactions")
    .select("id, created_at, type, amount, note")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(240);

  if (txError) return;

  const snapshot = buildFinanceSnapshot(((txData ?? []) as FinanceTransaction[]) ?? []);
  const alerts = detectImmediatePulseAlerts(snapshot, inserted);
  if (alerts.length === 0) return;

  const { data: subscriptions, error: subscriptionError } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, user_email, endpoint, p256dh, auth, disabled_at")
    .eq("user_id", userId)
    .is("disabled_at", null);

  const activeSubscriptions = ((subscriptions ?? []) as StoredPushSubscription[]) ?? [];

  for (const alert of alerts) {
    const threshold = new Date(Date.now() - alert.cooldownHours * 60 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from("notification_events")
      .select("id")
      .eq("user_id", userId)
      .eq("event_type", alert.eventType)
      .eq("dedupe_key", alert.dedupeKey)
      .gte("created_at", threshold)
      .limit(1)
      .maybeSingle();

    if (existing?.id) continue;

    if (subscriptionError || activeSubscriptions.length === 0) {
      await supabase.from("notification_events").insert({
        user_id: userId,
        event_type: alert.eventType,
        channel: "push",
        status: "skipped",
        dedupe_key: alert.dedupeKey,
        payload: { ...alert.payload, reason: "no_active_subscription" },
      });
      continue;
    }

    const result = await sendWebPushToSubscriptions(activeSubscriptions, {
      title: alert.title,
      body: alert.body,
      url: alert.url,
      tag: alert.dedupeKey,
    });

    await supabase.from("notification_events").insert({
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
  }
}
