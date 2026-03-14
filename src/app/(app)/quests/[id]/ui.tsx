"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useActionState, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/browser";
import { getQuestTemplate } from "@/lib/quests/templates";
import { PrimaryButton, SubtleButton, TextInput } from "@/components/ui";
import {
  abandonQuest,
  attachQuestProof,
  completeQuestAction,
  type QuestCompletionActionState,
} from "@/app/(app)/quests/actions";
import type { QuestReward } from "@/lib/quests/templates";
import type { SolutionLink } from "@/lib/monetization/solutions";
import { SolutionLinkCard } from "@/components/monetization/SolutionLinkCard";
import { ProfessionalAdviceCard } from "@/components/monetization/ProfessionalAdviceCard";
import {
  BuddyAvatar,
  wealthFromSavings,
  type BuddyGear,
  type BuddyRisk,
} from "@/components/buddy/BuddyAvatar";
import type { FailureAtlasStory } from "@/lib/social/failureAtlas";

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

type QuestProjection = {
  currentRank: number | null;
  projectedRank: number | null;
  currentSurvivalDays: number | null;
  projectedSurvivalDays: number | null;
  segmentSize: number | null;
  note: string | null;
};

const BUCKET = "proofs";
const initialCompletionState: QuestCompletionActionState = {
  error: null,
  success: null,
};

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
  currentSavings,
  projection,
  stories,
  solutionLinks,
  fpBookingUrl,
}: {
  quest: UserQuestRow;
  currentSavings: number;
  projection: QuestProjection;
  stories: FailureAtlasStory[];
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
  const [completionState, completionAction, completing] = useActionState(
    completeQuestAction,
    initialCompletionState,
  );
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [proofPath, setProofPath] = useState<string | null>(quest.proof_path);
  const [proofMime, setProofMime] = useState<string | null>(quest.proof_mime);
  const [storedPreviewUrl, setStoredPreviewUrl] = useState<string | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const isCompleted = quest.status !== "active" || !!completionState.success;
  const avatarRisk = riskFromDays(
    completionState.success ? projection.projectedSurvivalDays : projection.currentSurvivalDays,
  );
  const avatarWealth = wealthFromSavings(currentSavings);
  const avatarGear: BuddyGear | undefined = isCompleted ? reward : undefined;

  const triggerHref = useMemo(() => {
    const qs = new URLSearchParams();
    if (quest.recommended_cut_fixed) qs.set("cutFixed", String(quest.recommended_cut_fixed));
    if (quest.recommended_boost_income) qs.set("boostIncome", String(quest.recommended_boost_income));
    const q = qs.toString();
    return q.length ? `/triggers?${q}` : "/triggers";
  }, [quest.recommended_boost_income, quest.recommended_cut_fixed]);

  useEffect(() => {
    let active = true;
    async function loadPreview() {
      if (!proofPath) {
        setStoredPreviewUrl(null);
        return;
      }
      const supabase = createSupabaseBrowser();
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(proofPath, 60 * 60);
      if (active) setStoredPreviewUrl(data?.signedUrl ?? null);
    }
    void loadPreview();
    return () => {
      active = false;
    };
  }, [proofPath]);

  useEffect(() => {
    return () => {
      if (localPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, [localPreviewUrl]);

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

    const previewUrl = URL.createObjectURL(file);
    if (localPreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(localPreviewUrl);
    }
    setLocalPreviewUrl(previewUrl);
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

        {stories.length > 0 ? (
          <div className="mt-5 rounded-3xl border border-white/10 bg-zinc-950 p-4">
            <div className="text-[12px] font-semibold text-zinc-500">失敗図鑑 / 供養された体験談</div>
            <div className="mt-2 text-sm font-semibold tracking-tight text-zinc-100">
              似た失敗から、どうやって立て直したか
            </div>
            <div className="mt-4 grid gap-3">
              {stories.map((story) => (
                <div key={story.id} className="rounded-2xl border border-white/10 bg-black/40 p-4">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[11px] font-semibold text-zinc-300">
                      {story.levelLabel}
                    </span>
                    <div className="text-[13px] font-semibold text-zinc-100">{story.title}</div>
                  </div>
                  <div className="mt-3 grid gap-2 text-[13px] leading-6 text-zinc-300">
                    <div><span className="font-semibold text-zinc-100">失敗:</span> {story.before}</div>
                    <div><span className="font-semibold text-zinc-100">転機:</span> {story.turningPoint}</div>
                    <div><span className="font-semibold text-zinc-100">結果:</span> {story.after}</div>
                    <div className="rounded-2xl border border-white/10 bg-zinc-950 px-3 py-2 text-[12px] text-zinc-400">
                      教訓: {story.lesson}
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
          <div className="grid gap-3 rounded-3xl border border-white/10 bg-zinc-950 p-4">
            <div className="text-[12px] font-semibold text-zinc-500">バディが証拠を確認中</div>
            <div className="grid items-center gap-4 sm:grid-cols-[120px,1fr]">
              <div className="mx-auto flex h-[120px] w-[120px] items-center justify-center">
                <BuddyAvatar
                  risk={avatarRisk}
                  wealth={avatarWealth}
                  gear={avatarGear}
                  className="h-[120px] w-[120px]"
                />
              </div>
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/40 p-3">
                {localPreviewUrl || storedPreviewUrl ? (
                  <div className="relative h-36 w-full overflow-hidden rounded-2xl">
                    <Image
                      src={localPreviewUrl ?? storedPreviewUrl ?? ""}
                      alt="アップロードした証拠"
                      fill
                      sizes="(max-width: 768px) 100vw, 240px"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="flex h-36 items-center justify-center text-center text-[12px] leading-5 text-zinc-500">
                    画像を選ぶとここに証拠プレビューが表示されます。
                  </div>
                )}
              </div>
            </div>
          </div>

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
              disabled={uploading || isCompleted}
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
          {isCompleted ? (
            <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-[13px] text-zinc-300">
              このクエストはすでに {completionState.success ? "completed" : quest.status} です。
            </div>
          ) : (
            <form action={completionAction}>
              <input type="hidden" name="questId" value={quest.id} />
              <input type="hidden" name="proofNote" value={note} />
              <PrimaryButton type="submit" className="w-full" disabled={uploading || completing}>
                {uploading || completing ? "処理中..." : "達成して装備を獲得する"}
              </PrimaryButton>
            </form>
          )}
        </div>

        <AnimatePresence initial={false}>
          {completionState.error ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-4 rounded-3xl border border-white/10 bg-(--app-crimson)/10 p-4 text-[13px] leading-6 text-zinc-200"
            >
              {completionState.error}
            </motion.div>
          ) : null}
          {completionState.success ? (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-4 rounded-3xl border border-white/10 bg-(--app-emerald)/15 p-5 shadow-sm shadow-black/20"
            >
              <div className="text-[12px] font-semibold text-zinc-300">Proof of Action 完了</div>
              <div className="mt-2 text-lg font-semibold tracking-tight text-zinc-50">
                バディに装備が追加されました。
              </div>
              <div className="mt-3 grid gap-2 text-[13px] text-zinc-200">
                <div>{completionState.success}</div>
                <div>
                  生存日数: {formatDays(projection.currentSurvivalDays)} →{" "}
                  {formatDays(projection.projectedSurvivalDays)}
                </div>
                <div>
                  セグメント順位: {formatRank(projection.currentRank)} →{" "}
                  {formatRank(projection.projectedRank)}
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="mt-5 rounded-3xl border border-white/10 bg-zinc-950 p-4">
          <div className="text-[12px] font-semibold text-zinc-500">ビフォー・アフター</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <ProjectionCard
              label="生存日数"
              before={formatDays(projection.currentSurvivalDays)}
              after={formatDays(projection.projectedSurvivalDays)}
            />
            <ProjectionCard
              label="map順位"
              before={formatRank(projection.currentRank)}
              after={formatRank(projection.projectedRank)}
            />
          </div>
          <div className="mt-3 text-[12px] leading-5 text-zinc-500">
            {projection.segmentSize
              ? `同セグメント ${projection.segmentSize} 人の中で試算しています。`
              : "同セグメント比較の材料が不足しているため、個人ベースの試算を表示しています。"}
            {projection.note ? ` ${projection.note}` : ""}
          </div>
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

function riskFromDays(days: number | null): BuddyRisk {
  if (days === null) return "unknown";
  if (!Number.isFinite(days)) return "safe";
  if (days <= 7) return "danger";
  if (days <= 21) return "warn";
  return "safe";
}

function formatDays(days: number | null) {
  if (days === null) return "—";
  if (!Number.isFinite(days)) return "∞";
  return `${days}日`;
}

function formatRank(rank: number | null) {
  if (rank === null) return "—";
  return `${rank}位`;
}

function ProjectionCard({
  label,
  before,
  after,
}: {
  label: string;
  before: string;
  after: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
      <div className="text-[12px] font-semibold text-zinc-500">{label}</div>
      <div className="mt-2 text-[13px] font-semibold text-zinc-100">
        {before} <span className="mx-2 text-zinc-500">→</span> {after}
      </div>
    </div>
  );
}

