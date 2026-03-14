import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { QuestDetail } from "./ui";
import {
  inferSubcategory,
  loadSolutionLinks,
  pickFpLink,
  pickSolutionLinks,
  type SolutionLink,
} from "@/lib/monetization/solutions";
import {
  getFailureAtlasStories,
  type FailureAtlasStory,
} from "@/lib/social/failureAtlas";
import { buildFinanceSnapshot, type FinanceTransaction } from "@/lib/finance/insights";
import { isAgeGroup, isIncomeBand, type UserProfile } from "@/lib/social/segment";
import {
  buildSegmentPoints,
  createSelfPoint,
  projectPointForQuest,
  withRanks,
  type SegmentTransactionRow,
} from "@/lib/social/rankProjection";

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

export default async function QuestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const admin = createSupabaseAdmin();
  const { data: userData } = await supabase.auth.getUser();

  const user = userData.user;
  const { data, error } = await supabase
    .from("user_quests")
    .select(
      "id, title, description, category, status, template_key, source, proof_note, proof_hint, proof_path, proof_mime, reward, recommended_cut_fixed, recommended_boost_income, ai_trigger_id, started_at, completed_at",
    )
    .eq("id", id)
    .eq("user_id", user?.id ?? "")
    .single();

  if (error || !data) notFound();
  const q = data as UserQuestRow;
  const { data: txData } = await supabase
    .from("transactions")
    .select("id, created_at, type, amount, note")
    .eq("user_id", user?.id ?? "")
    .order("created_at", { ascending: false })
    .limit(240);
  const snapshot = buildFinanceSnapshot(((txData ?? []) as FinanceTransaction[]) ?? []);

  let estimatedDeltaDays: number | null = null;
  if (q.ai_trigger_id) {
    const { data: aiTriggerData } = await supabase
      .from("ai_triggers")
      .select("estimated_delta_days")
      .eq("id", q.ai_trigger_id)
      .eq("user_id", user?.id ?? "")
      .maybeSingle();
    estimatedDeltaDays =
      aiTriggerData && typeof aiTriggerData.estimated_delta_days === "number"
        ? aiTriggerData.estimated_delta_days
        : null;
  }

  const { data: profileData } = await admin
    .from("user_profiles")
    .select("user_id, age_group, income_band")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();
  const profileCandidate = profileData as Partial<UserProfile> | null;
  const profile =
    profileCandidate &&
    typeof profileCandidate.user_id === "string" &&
    isAgeGroup(profileCandidate.age_group ?? "") &&
    isIncomeBand(profileCandidate.income_band ?? "")
      ? {
          user_id: profileCandidate.user_id,
          age_group: profileCandidate.age_group,
          income_band: profileCandidate.income_band,
        }
      : null;

  let projection: QuestProjection = {
    currentRank: null,
    projectedRank: null,
    currentSurvivalDays: snapshot.survivalDays,
    projectedSurvivalDays: snapshot.survivalDays,
    segmentSize: null,
    note: "比較に必要なプロフィール情報がそろうと、順位予測を表示できます。",
  };

  if (user?.id && profile) {
    const { data: profileRows } = await admin
      .from("user_profiles")
      .select("user_id")
      .eq("age_group", profile.age_group)
      .eq("income_band", profile.income_band)
      .limit(200);
    const userIds = ((profileRows ?? []) as Array<{ user_id: string }>).map((row) => row.user_id);
    const { data: segmentTxData } = userIds.length
      ? await admin
          .from("transactions")
          .select("id, user_id, created_at, type, amount, note")
          .in("user_id", userIds)
          .order("created_at", { ascending: false })
      : { data: [] };

    const selfPoint = createSelfPoint(user.id, snapshot);
    const currentPoints = buildSegmentPoints(
      userIds,
      ((segmentTxData ?? []) as SegmentTransactionRow[]) ?? [],
      selfPoint,
    );
    const projectedPoints = withRanks(
      currentPoints.map((point) =>
        point.id === user.id
          ? projectPointForQuest(point, {
              avgMonthlyExpense: snapshot.avgMonthlyExpense,
              estimatedDeltaDays,
              recommendedCutFixed: q.recommended_cut_fixed,
              recommendedBoostIncome: q.recommended_boost_income,
              shieldMode:
                q.category === "shield" &&
                !q.recommended_cut_fixed &&
                !q.recommended_boost_income,
            })
          : point,
      ),
    );
    const currentSelf = currentPoints.find((point) => point.id === user.id) ?? null;
    const projectedSelf = projectedPoints.find((point) => point.id === user.id) ?? null;
    projection = {
      currentRank: currentSelf?.rank ?? null,
      projectedRank: projectedSelf?.rank ?? null,
      currentSurvivalDays: currentSelf?.survivalDays ?? snapshot.survivalDays,
      projectedSurvivalDays: projectedSelf?.survivalDays ?? snapshot.survivalDays,
      segmentSize: currentPoints.length,
      note:
        q.category === "shield" &&
        !q.recommended_cut_fixed &&
        !q.recommended_boost_income
          ? "盾クエストは守りの行動なので、順位よりも急な下振れを防ぐ効果を強めに見積もっています。"
          : null,
    };
  }

  const { links: solutionLinks } = await loadSolutionLinks(supabase, ["quest_detail", "fp"]);
  const subcategory = inferSubcategory({
    category: q.category,
    title: q.title,
    description: q.description,
    proofHint: q.proof_hint,
  });
  const contextualLinks = pickSolutionLinks(solutionLinks, {
    placement: "quest_detail",
    category:
      q.category === "poison" || q.category === "doping" || q.category === "shield"
        ? q.category
        : "shield",
    subcategory,
    limit: 2,
  });
  const stories = getFailureAtlasStories({
    category:
      q.category === "poison" || q.category === "doping" || q.category === "shield"
        ? q.category
        : "shield",
    subcategory,
  });
  const fpLink = pickFpLink(solutionLinks);

  return (
    <div className="grid gap-5">
      <div className="rounded-[28px] border border-white/10 bg-zinc-950 p-7 shadow-sm shadow-black/30">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[12px] font-semibold text-zinc-500">
              Proof of Action
            </div>
            <div className="mt-2 truncate text-lg font-semibold tracking-tight text-zinc-100">
              {q.title}
            </div>
            <div className="mt-2 text-[13px] text-zinc-400">
              ステータス:{" "}
              <span className="font-semibold text-zinc-200">{q.status}</span>
            </div>
          </div>

          <Link
            href="/quests"
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] font-semibold text-zinc-100 hover:border-white/20"
          >
            一覧へ
          </Link>
        </div>

        <div className="mt-6">
          <QuestDetail
            quest={q}
            currentSavings={snapshot.savings}
            projection={projection}
            stories={stories as FailureAtlasStory[]}
            solutionLinks={contextualLinks as SolutionLink[]}
            fpBookingUrl={fpLink?.url ?? process.env.NEXT_PUBLIC_FP_BOOKING_URL ?? null}
          />
        </div>
      </div>
    </div>
  );
}

