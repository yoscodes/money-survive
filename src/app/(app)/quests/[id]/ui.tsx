"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/browser";
import { getQuestTemplate } from "@/lib/quests/templates";
import { PrimaryButton, SubtleButton, TextInput } from "@/components/ui";
import { abandonQuest, attachQuestProof, completeQuest } from "@/app/(app)/quests/actions";
import type { QuestReward } from "@/lib/quests/templates";
import type { SolutionLink } from "@/lib/monetization/solutions";
import { SolutionLinkCard } from "@/components/monetization/SolutionLinkCard";
import { ProfessionalAdviceCard } from "@/components/monetization/ProfessionalAdviceCard";

type UserQuestRow = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: "active" | "completed" | "abandoned";
  template_key: string;
  source: "template" | "ai" | null;
  proof_note: string | null;
  proof_hint: string | null;
  proof_path: string | null;
  proof_mime: string | null;
  reward: unknown;
  recommended_cut_fixed: number | null;
  recommended_boost_income: number | null;
  ai_trigger_id: string | null;
  started_at: string;
  completed_at: string | null;
};

const BUCKET = "proofs";

function safeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

function asQuestReward(value: unknown): QuestReward {
  if (!value || typeof value !== "object") return {};
  const v = value as { shield?: unknown; armor?: unknown };
  const shield =
    v.shield === "basic" || v.shield === "ironwall" ? v.shield : undefined;
  const armor = typeof v.armor === "boolean" ? v.armor : undefined;
  return { shield, armor };
}

export function QuestDetail({
  quest,
  solutionLinks,
  fpBookingUrl,
}: {
  quest: UserQuestRow;
  solutionLinks: SolutionLink[];
  fpBookingUrl: string | null;
}) {
  const template = useMemo(
    () => getQuestTemplate(quest.template_key),
    [quest.template_key],
  );
  const reward = useMemo(() => asQuestReward(quest.reward), [quest.reward]);
  const description = template?.description ?? quest.description ?? "—";
  const proofHint = template?.proofHint ?? quest.proof_hint ?? "—";

  const [note, setNote] = useState(quest.proof_note ?? "");
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [proofPath, setProofPath] = useState<string | null>(quest.proof_path);
  const [proofMime, setProofMime] = useState<string | null>(quest.proof_mime);

  const triggerHref = useMemo(() => {
    const qs = new URLSearchParams();
    if (quest.recommended_cut_fixed) qs.set("cutFixed", String(quest.recommended_cut_fixed));
    if (quest.recommended_boost_income) qs.set("boostIncome", String(quest.recommended_boost_income));
    const q = qs.toString();
    return q.length ? `/triggers?${q}` : "/triggers";
  }, [quest.recommended_boost_income, quest.recommended_cut_fixed]);

  async function onPickFile(file: File | null) {
    setFileError(null);
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setFileError("画像ファイル（png/jpgなど）を選んでください");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFileError("ファイルが大きすぎます（最大10MB）");
      return;
    }

    setUploading(true);
    try {
      const supabase = createSupabaseBrowser();
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw new Error(userErr.message);
      const uid = userData.user?.id;
      if (!uid) throw new Error("ログインが必要です");

      const path = `${uid}/${quest.id}/${Date.now()}-${safeFilename(file.name)}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (error) throw new Error(error.message);

      await attachQuestProof({ questId: quest.id, proofPath: path, proofMime: file.type });
      setProofPath(path);
      setProofMime(file.type);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "アップロードに失敗しました";
      setFileError(
        `${msg}\n（Supabase Storage に '${BUCKET}' バケットが必要です）`,
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr,340px]">
      <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
        <div className="text-[12px] font-semibold text-zinc-500">内容</div>
        <div className="mt-2 text-sm font-semibold tracking-tight text-zinc-100">
          {template?.title ?? quest.title}
        </div>
        <p className="mt-2 text-[13px] leading-6 text-zinc-400">
          {description}
        </p>

        <div className="mt-5 rounded-3xl border border-white/10 bg-zinc-950 p-4">
          <div className="text-[12px] font-semibold text-zinc-500">証明のヒント</div>
          <div className="mt-2 text-[13px] leading-6 text-zinc-300">
            {proofHint}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={triggerHref}
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] font-semibold text-zinc-100 hover:border-white/20"
          >
            トリガーを開く
          </Link>
          <form action={abandonQuest.bind(null, quest.id)}>
            <SubtleButton type="submit" className="h-10 px-3 text-[13px]">
              中断する
            </SubtleButton>
          </form>
        </div>

        {solutionLinks.length > 0 ? (
          <div className="mt-5 grid gap-3">
            {solutionLinks.map((link) => (
              <SolutionLinkCard key={link.id} link={link} compact />
            ))}
          </div>
        ) : null}
      </div>

      <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
        <div className="text-[12px] font-semibold text-zinc-500">行動証明</div>
        <div className="mt-2 text-sm font-semibold tracking-tight text-zinc-100">
          スクショ/申告を提出
        </div>
        <p className="mt-2 text-[13px] leading-6 text-zinc-400">
          “スライダーを動かしただけ”で終わらせない。現実で動いた証拠を残す。
        </p>

        <div className="mt-4 grid gap-2">
          <label className="grid gap-1">
            <span className="text-[12px] font-semibold text-zinc-500">
              証明メモ（任意）
            </span>
            <TextInput
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例: 〇〇を解約。スクショ添付。"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-[12px] font-semibold text-zinc-500">
              画像アップロード（任意）
            </span>
            <input
              type="file"
              accept="image/*"
              disabled={uploading || quest.status !== "active"}
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              className="block w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-zinc-200 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-[12px] file:font-semibold file:text-zinc-100"
            />
          </label>

          {proofPath ? (
            <div className="rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3 text-[12px] text-zinc-400">
              アップロード済み: <span className="text-zinc-200">{proofMime ?? "image/*"}</span>
            </div>
          ) : null}

          {fileError ? (
            <pre className="whitespace-pre-wrap rounded-2xl border border-white/10 bg-(--app-crimson)/10 px-4 py-3 text-[12px] leading-5 text-zinc-200">
              {fileError}
            </pre>
          ) : null}
        </div>

        <div className="mt-5">
          {quest.status !== "active" ? (
            <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-[13px] text-zinc-300">
              このクエストはすでに {quest.status} です。
            </div>
          ) : (
            <form
              action={async () => {
                await completeQuest({ questId: quest.id, proofNote: note });
              }}
            >
              <PrimaryButton type="submit" className="w-full" disabled={uploading}>
                {uploading ? "処理中..." : "達成して装備を獲得する"}
              </PrimaryButton>
            </form>
          )}
        </div>

        <div className="mt-5 rounded-3xl border border-white/10 bg-zinc-950 p-4">
          <div className="text-[12px] font-semibold text-zinc-500">報酬</div>
          <div className="mt-2 text-[13px] leading-6 text-zinc-300">
            {reward.shield ? `盾: ${reward.shield}` : "盾: なし"}
            {reward.armor ? (
              <span className="ml-3">鎧: あり</span>
            ) : (
              <span className="ml-3">鎧: なし</span>
            )}
          </div>
        </div>

        <div className="mt-5">
          <ProfessionalAdviceCard href={fpBookingUrl} />
        </div>
      </div>
    </div>
  );
}

