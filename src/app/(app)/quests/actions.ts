"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getQuestTemplate } from "@/lib/quests/templates";
import { buildFinanceSnapshot, type FinanceTransaction } from "@/lib/finance/insights";
import {
  generateAiTriggers,
  rewardForCategory,
  type AiTriggerDraft,
} from "@/lib/ai/openai";

export type AiTriggerActionState = {
  error: string | null;
  success: string | null;
};

type AiTriggerRow = AiTriggerDraft & {
  id: string;
  user_id: string;
  status: "generated" | "started" | "completed" | "abandoned";
};

async function requireUser() {
  const supabase = await createSupabaseServer();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");
  return { supabase, user: userData.user };
}

function formatAiError(error: unknown) {
  const message = error instanceof Error ? error.message : "AI提案の生成に失敗しました";
  if (message.includes("OPENAI_API_KEY")) {
    return "OPENAI_API_KEY が未設定です。README の設定を確認してください。";
  }
  if (message.includes("relation") || message.includes("ai_triggers")) {
    return "ai_triggers テーブルが未作成です。README の SQL を実行してください。";
  }
  if (message.includes("quota") || message.includes("rate")) {
    return "OpenAI API の利用制限に達した可能性があります。少し待ってから再実行してください。";
  }
  return message;
}

export async function startQuest(templateKey: string) {
  const template = getQuestTemplate(templateKey);
  if (!template) throw new Error("Unknown quest template");

  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("user_quests")
    .insert({
      user_id: user.id,
      template_key: template.key,
      title: template.title,
      description: template.description,
      category: template.category,
      status: "active",
      source: "template",
      reward: template.reward,
      recommended_cut_fixed: template.recommended?.cutFixed ?? null,
      recommended_boost_income: template.recommended?.boostIncome ?? null,
      proof_hint: template.proofHint,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/quests");
  redirect(`/quests/${data.id}`);
}

export async function attachQuestProof(params: {
  questId: string;
  proofPath: string;
  proofMime: string;
}) {
  const { supabase } = await requireUser();

  const { error } = await supabase
    .from("user_quests")
    .update({
      proof_path: params.proofPath,
      proof_mime: params.proofMime,
    })
    .eq("id", params.questId);

  if (error) throw new Error(error.message);
  revalidatePath(`/quests/${params.questId}`);
  revalidatePath("/quests");
}

export async function completeQuest(params: {
  questId: string;
  proofNote: string;
}) {
  const { supabase } = await requireUser();

  const { data: questData } = await supabase
    .from("user_quests")
    .select("ai_trigger_id")
    .eq("id", params.questId)
    .maybeSingle();

  const { error } = await supabase
    .from("user_quests")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      proof_note: params.proofNote.trim().length ? params.proofNote.trim() : null,
    })
    .eq("id", params.questId);

  if (error) throw new Error(error.message);

  const aiTriggerId =
    questData && typeof questData.ai_trigger_id === "string" ? questData.ai_trigger_id : null;
  if (aiTriggerId) {
    await supabase
      .from("ai_triggers")
      .update({ status: "completed" })
      .eq("id", aiTriggerId);
  }

  revalidatePath(`/quests/${params.questId}`);
  revalidatePath("/quests");
  revalidatePath("/dashboard");
  revalidatePath("/map");
}

export async function abandonQuest(questId: string) {
  const { supabase } = await requireUser();

  const { data: questData } = await supabase
    .from("user_quests")
    .select("ai_trigger_id")
    .eq("id", questId)
    .maybeSingle();

  const { error } = await supabase
    .from("user_quests")
    .update({
      status: "abandoned",
    })
    .eq("id", questId);

  if (error) throw new Error(error.message);

  const aiTriggerId =
    questData && typeof questData.ai_trigger_id === "string" ? questData.ai_trigger_id : null;
  if (aiTriggerId) {
    await supabase
      .from("ai_triggers")
      .update({ status: "abandoned" })
      .eq("id", aiTriggerId);
  }

  revalidatePath(`/quests/${questId}`);
  revalidatePath("/quests");
  redirect("/quests");
}

export async function generateAiTriggersAction(
  _prevState: AiTriggerActionState,
  _formData: FormData,
): Promise<AiTriggerActionState> {
  void _prevState;
  void _formData;

  try {
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase
      .from("transactions")
      .select("id, created_at, type, amount, note")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(240);

    if (error) {
      return { error: error.message, success: null };
    }

    const items = ((data ?? []) as FinanceTransaction[]) ?? [];
    const snapshot = buildFinanceSnapshot(items);

    if (snapshot.expenseCount < 5 || snapshot.avgMonthlyExpense === null) {
      return {
        error: "AI診断には、ある程度の支出ログが必要です。まずは支出を5件以上記録してください。",
        success: null,
      };
    }

    const suggestions = await generateAiTriggers(snapshot);
    const payload = suggestions.map((item) => ({
      user_id: user.id,
      title: item.title,
      description: item.description,
      category: item.category,
      proof_hint: item.proofHint,
      recommended_cut_fixed: item.recommendedCutFixed,
      recommended_boost_income: item.recommendedBoostIncome,
      estimated_delta_days: item.estimatedDeltaDays,
      status: "generated",
      source_snapshot: snapshot,
    }));

    const { error: insertError } = await supabase.from("ai_triggers").insert(payload);
    if (insertError) {
      return { error: formatAiError(insertError), success: null };
    }

    revalidatePath("/quests");
    return {
      error: null,
      success: "あなた専用のAIトリガーを3件生成しました。",
    };
  } catch (error) {
    return {
      error: formatAiError(error),
      success: null,
    };
  }
}

export async function startAiTriggerQuest(aiTriggerId: string) {
  const { supabase, user } = await requireUser();

  const { data: existingQuest } = await supabase
    .from("user_quests")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("ai_trigger_id", aiTriggerId)
    .in("status", ["active", "completed"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingQuest?.id) {
    redirect(`/quests/${existingQuest.id}`);
  }

  const { data, error } = await supabase
    .from("ai_triggers")
    .select(
      "id, user_id, title, description, category, proof_hint, recommended_cut_fixed, recommended_boost_income, estimated_delta_days, status",
    )
    .eq("id", aiTriggerId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    throw new Error("AI trigger not found");
  }

  const trigger = data as AiTriggerRow & {
    proof_hint?: string | null;
    recommended_cut_fixed?: number | null;
    recommended_boost_income?: number | null;
    estimated_delta_days?: number | null;
  };

  const reward = rewardForCategory(trigger.category);
  const templateKey = `ai:${trigger.id}`;
  const { data: questInsert, error: questError } = await supabase
    .from("user_quests")
    .insert({
      user_id: user.id,
      template_key: templateKey,
      title: trigger.title,
      description: trigger.description,
      category: trigger.category,
      status: "active",
      source: "ai",
      reward,
      recommended_cut_fixed: trigger.recommended_cut_fixed ?? null,
      recommended_boost_income: trigger.recommended_boost_income ?? null,
      proof_hint: trigger.proof_hint ?? "行動した証拠がわかるスクショ、または1行メモ",
      ai_trigger_id: trigger.id,
    })
    .select("id")
    .single();

  if (questError) throw new Error(questError.message);

  await supabase.from("ai_triggers").update({ status: "started" }).eq("id", trigger.id);
  revalidatePath("/quests");
  redirect(`/quests/${questInsert.id}`);
}

