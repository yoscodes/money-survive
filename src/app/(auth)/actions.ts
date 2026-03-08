"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isAgeGroup, isIncomeBand } from "@/lib/social/segment";

export type AuthActionState = { error?: string | null };

function getString(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

export async function signIn(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = getString(formData, "email").trim();
  const password = getString(formData, "password");

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  redirect("/dashboard");
}

export async function signUp(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = getString(formData, "email").trim();
  const password = getString(formData, "password");
  const ageGroup = getString(formData, "age_group");
  const incomeBand = getString(formData, "income_band");

  if (!isAgeGroup(ageGroup)) return { error: "年代を選択してください" };
  if (!isIncomeBand(incomeBand)) return { error: "年収帯を選択してください" };

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };

  if (!data.user?.id) return { error: "ユーザー作成後のプロフィール保存に失敗しました" };

  try {
    const admin = createSupabaseAdmin();
    const { error: profileError } = await admin.from("user_profiles").upsert({
      user_id: data.user.id,
      age_group: ageGroup,
      income_band: incomeBand,
      updated_at: new Date().toISOString(),
    });
    if (profileError) return { error: profileError.message };
  } catch (profileError) {
    const message =
      profileError instanceof Error ? profileError.message : "プロフィール保存に失敗しました";
    return { error: message };
  }

  redirect("/dashboard");
}

