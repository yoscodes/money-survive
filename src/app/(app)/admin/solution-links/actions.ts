"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/admin/guard";
import {
  isSolutionCategory,
  isSolutionPlacement,
  isSolutionSubcategory,
  isValidHttpUrl,
  normalizeSolutionSubcategory,
} from "@/lib/monetization/solutions";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function getPriority(formData: FormData) {
  const raw = getString(formData, "priority");
  const value = Number(raw);
  if (!Number.isFinite(value)) return 100;
  return Math.max(0, Math.min(9999, Math.round(value)));
}

function parseSolutionLinkForm(formData: FormData) {
  const placement = getString(formData, "placement");
  const category = getString(formData, "category");
  const subcategory = getString(formData, "subcategory");
  const label = getString(formData, "label");
  const description = getString(formData, "description");
  const url = getString(formData, "url");
  const ctaLabel = getString(formData, "cta_label");
  const priority = getPriority(formData);
  const isActive = getBoolean(formData, "is_active");

  if (!isSolutionPlacement(placement)) {
    return { error: "placement が不正です" as const };
  }
  if (!isSolutionCategory(category)) {
    return { error: "category が不正です" as const };
  }
  if (subcategory.length > 0 && !isSolutionSubcategory(subcategory)) {
    return { error: "subcategory が不正です" as const };
  }
  if (!label.length) {
    return { error: "label は必須です" as const };
  }
  if (!url.length || !isValidHttpUrl(url)) {
    return { error: "url は http/https の有効なURLを指定してください" as const };
  }

  return {
    data: {
      placement,
      category,
      subcategory: normalizeSolutionSubcategory(subcategory),
      label,
      description: description.length ? description : null,
      url,
      cta_label: ctaLabel.length ? ctaLabel : null,
      priority,
      is_active: isActive,
    },
  } as const;
}

function backWithStatus(params: { error?: string; success?: string }) {
  const qs = new URLSearchParams();
  if (params.error) qs.set("error", params.error);
  if (params.success) qs.set("success", params.success);
  redirect(`/admin/solution-links?${qs.toString()}`);
}

export async function createSolutionLink(formData: FormData) {
  await requireAdminUser();
  const parsed = parseSolutionLinkForm(formData);
  if ("error" in parsed) backWithStatus({ error: parsed.error });

  const admin = createSupabaseAdmin();
  const { error } = await admin.from("solution_links").insert(parsed.data);
  if (error) backWithStatus({ error: error.message });

  revalidatePath("/admin/solution-links");
  revalidatePath("/triggers");
  revalidatePath("/quests");
  backWithStatus({ success: "提携リンクを追加しました" });
}

export async function updateSolutionLink(formData: FormData) {
  await requireAdminUser();
  const id = getString(formData, "id");
  if (!id.length) backWithStatus({ error: "id が不足しています" });

  const parsed = parseSolutionLinkForm(formData);
  if ("error" in parsed) backWithStatus({ error: parsed.error });

  const admin = createSupabaseAdmin();
  const { error } = await admin.from("solution_links").update(parsed.data).eq("id", id);
  if (error) backWithStatus({ error: error.message });

  revalidatePath("/admin/solution-links");
  revalidatePath("/triggers");
  revalidatePath("/quests");
  backWithStatus({ success: "提携リンクを更新しました" });
}

export async function toggleSolutionLink(id: string, nextActive: boolean) {
  await requireAdminUser();

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("solution_links")
    .update({ is_active: nextActive })
    .eq("id", id);
  if (error) backWithStatus({ error: error.message });

  revalidatePath("/admin/solution-links");
  revalidatePath("/triggers");
  revalidatePath("/quests");
  backWithStatus({
    success: nextActive ? "提携リンクを有効化しました" : "提携リンクを無効化しました",
  });
}
