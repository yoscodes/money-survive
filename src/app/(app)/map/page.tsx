import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { RivalBenchmark } from "./RivalBenchmark";
import type { Transaction } from "../dashboard/types";
import {
  createBattleFeedItem,
  type BattleFeedItem,
  nextIncomeBand,
  segmentChannelKey,
  type SegmentBenchmark,
  type SegmentMapPoint,
  type SegmentMapView,
  type UserProfile,
} from "@/lib/social/segment";
import {
  mapSegmentEventToBattleFeedItem,
  type MapSegmentEventRow,
} from "@/lib/social/mapEvents";
import { buildFinanceSnapshot } from "@/lib/finance/insights";
import {
  buildSegmentPoints,
  createSelfPoint,
  projectPointForQuest,
  withRanks,
  type SegmentTransactionRow,
} from "@/lib/social/rankProjection";

type SearchParams = Record<string, string | string[] | undefined>;

type SegmentQuestRow = {
  id: string;
  user_id: string;
  title: string;
  category: string;
  reward: unknown;
  completed_at: string | null;
  status: string;
  recommended_cut_fixed: number | null;
  recommended_boost_income: number | null;
};

const DEMO_PROFILE: Pick<UserProfile, "age_group" | "income_band"> = {
  age_group: "30代",
  income_band: "400万層",
};

function readFlag(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "1" || raw === "true";
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildMapView(input: {
  id: string;
  label: string;
  description: string;
  points: SegmentMapPoint[];
  ctaHref: string;
  ctaLabel: string;
  topQuestTitle?: string | null;
  isProjection?: boolean;
}): SegmentMapView {
  const ranked = withRanks(input.points);
  const self = ranked.find((point) => point.isSelf);
  const visibleRankBorder = self?.rank ? Math.max(1, self.rank - 3) : null;
  const hiddenCount =
    visibleRankBorder === null
      ? 0
      : ranked.filter((point) => !point.isSelf && (point.rank ?? Infinity) < visibleRankBorder).length;

  return {
    ...input,
    points: ranked,
    hiddenCount,
    avgSurvivalDays: average(ranked.map((point) => point.survivalDays)),
    avgMonthlySurplus: average(ranked.map((point) => point.monthlySurplus)),
  };
}

function buildProjectionPoints(points: SegmentMapPoint[], currentUserId: string) {
  return points.map((point) => {
    if (point.id !== currentUserId) return point;
    return projectPointForQuest(point, {
      avgMonthlyExpense: null,
      recommendedCutFixed: 10000,
      recommendedBoostIncome: 0,
      estimatedDeltaDays: 6,
    });
  });
}

function topQuestTitle(rows: SegmentQuestRow[]) {
  const counts = new Map<string, { title: string; count: number }>();
  for (const row of rows) {
    const entry = counts.get(row.title);
    if (entry) {
      entry.count += 1;
    } else {
      counts.set(row.title, { title: row.title, count: 1 });
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count)[0]?.title ?? null;
}

async function loadSegmentData(input: {
  admin: ReturnType<typeof createSupabaseAdmin>;
  ageGroup: UserProfile["age_group"];
  incomeBand: UserProfile["income_band"];
  currentUserId: string;
  selfPoint: SegmentMapPoint;
}) {
  const { admin, ageGroup, incomeBand, currentUserId, selfPoint } = input;
  const { data: profileRows } = await admin
    .from("user_profiles")
    .select("user_id")
    .eq("age_group", ageGroup)
    .eq("income_band", incomeBand)
    .limit(200);

  const userIds = ((profileRows ?? []) as Array<{ user_id: string }>).map((row) => row.user_id);
  if (userIds.length === 0) {
    return {
      points: withRanks([selfPoint]),
      feed: [] as BattleFeedItem[],
      topQuestTitle: null,
    };
  }

  const { data: transactionRows } = await admin
    .from("transactions")
    .select("id, user_id, created_at, type, amount, note")
    .in("user_id", userIds)
    .order("created_at", { ascending: false });

  const points = buildSegmentPoints(
    userIds,
    ((transactionRows ?? []) as SegmentTransactionRow[]) ?? [],
    selfPoint,
  );

  const feedUserIds = userIds.filter((id) => id !== currentUserId);
  let feed: BattleFeedItem[] = [];
  let mostPlayedQuest: string | null = null;

  const { data: eventRows, error: eventError } = await admin
    .from("map_segment_events")
    .select(
      "id, user_id, quest_id, title, message, category, completed_at, delta_days, age_group, income_band",
    )
    .eq("segment_key", segmentChannelKey(ageGroup, incomeBand))
    .neq("user_id", currentUserId)
    .order("completed_at", { ascending: false })
    .limit(8);

  if (!eventError) {
    feed = (((eventRows ?? []) as MapSegmentEventRow[]) ?? []).map((row) =>
      mapSegmentEventToBattleFeedItem(row),
    );
  }

  if (feedUserIds.length > 0) {
    const { data: questRows } = await admin
      .from("user_quests")
      .select(
        "id, user_id, title, category, reward, completed_at, status, recommended_cut_fixed, recommended_boost_income",
      )
      .in("user_id", feedUserIds)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(24);

    const typedRows = ((questRows ?? []) as SegmentQuestRow[]) ?? [];
    mostPlayedQuest = topQuestTitle(typedRows);
    if (feed.length === 0) {
      feed = typedRows.slice(0, 8).map((row) =>
        createBattleFeedItem({
          id: row.id,
          title: row.title,
          category: row.category,
          reward: row.reward,
          completed_at: row.completed_at,
          recommended_cut_fixed: row.recommended_cut_fixed,
          recommended_boost_income: row.recommended_boost_income,
          age_group: ageGroup,
          income_band: incomeBand,
        }),
      );
    }
  }

  return {
    points,
    feed,
    topQuestTitle: mostPlayedQuest,
  };
}

function createDemoData(currentUserId: string, snapshot: ReturnType<typeof buildFinanceSnapshot>) {
  const selfPoint = createSelfPoint(currentUserId, snapshot);
  const currentPoints = withRanks([
    { ...selfPoint, survivalDays: selfPoint.survivalDays || 11, monthlySurplus: selfPoint.monthlySurplus || -12000, savings: selfPoint.savings || 128000 },
    { id: "demo-1", label: "戦友1", survivalDays: 8, monthlySurplus: -18000, savings: 70000, rank: null },
    { id: "demo-2", label: "戦友2", survivalDays: 12, monthlySurplus: -6000, savings: 102000, rank: null },
    { id: "demo-3", label: "戦友3", survivalDays: 15, monthlySurplus: 3000, savings: 166000, rank: null },
    { id: "demo-4", label: "戦友4", survivalDays: 18, monthlySurplus: 6000, savings: 210000, rank: null },
    { id: "demo-5", label: "戦友5", survivalDays: 24, monthlySurplus: 16000, savings: 288000, rank: null },
    { id: "demo-6", label: "戦友6", survivalDays: 31, monthlySurplus: 25000, savings: 356000, rank: null },
    { id: "demo-7", label: "戦友7", survivalDays: 39, monthlySurplus: 34000, savings: 498000, rank: null },
  ]);

  const futurePoints = withRanks([
    { ...selfPoint, survivalDays: selfPoint.survivalDays || 11, monthlySurplus: selfPoint.monthlySurplus || -12000, savings: selfPoint.savings || 128000 },
    { id: "future-1", label: "戦友1", survivalDays: 18, monthlySurplus: 7000, savings: 220000, rank: null },
    { id: "future-2", label: "戦友2", survivalDays: 24, monthlySurplus: 15000, savings: 320000, rank: null },
    { id: "future-3", label: "戦友3", survivalDays: 29, monthlySurplus: 24000, savings: 410000, rank: null },
    { id: "future-4", label: "戦友4", survivalDays: 36, monthlySurplus: 32000, savings: 530000, rank: null },
    { id: "future-5", label: "戦友5", survivalDays: 44, monthlySurplus: 41000, savings: 690000, rank: null },
    { id: "future-6", label: "戦友6", survivalDays: 53, monthlySurplus: 52000, savings: 920000, rank: null },
  ]);

  const benchmark: SegmentBenchmark = {
    segment_size: currentPoints.length,
    avg_savings: 252000,
    avg_survival_days: 20,
    avg_monthly_expense: 143000,
    my_savings: currentPoints.find((point) => point.isSelf)?.savings ?? selfPoint.savings,
    my_survival_days: currentPoints.find((point) => point.isSelf)?.survivalDays ?? selfPoint.survivalDays,
    my_avg_monthly_expense: snapshot.avgMonthlyExpense ?? 156000,
    my_rank: currentPoints.find((point) => point.isSelf)?.rank ?? 5,
    poison_completed: 14,
    doping_completed: 8,
    shield_completed: 6,
  };

  const initialFeed = [
    createBattleFeedItem({
      id: "demo-feed-1",
      title: "通信費の見直し",
      category: "poison",
      reward: {},
      completed_at: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
      recommended_cut_fixed: 4500,
      age_group: DEMO_PROFILE.age_group,
      income_band: DEMO_PROFILE.income_band,
    }),
    createBattleFeedItem({
      id: "demo-feed-2",
      title: "週末の副業1本",
      category: "doping",
      reward: {},
      completed_at: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
      recommended_boost_income: 9000,
      age_group: DEMO_PROFILE.age_group,
      income_band: DEMO_PROFILE.income_band,
    }),
    createBattleFeedItem({
      id: "demo-feed-3",
      title: "保険の棚卸し",
      category: "shield",
      reward: { shield: "basic" },
      completed_at: new Date(Date.now() - 51 * 60 * 1000).toISOString(),
      age_group: DEMO_PROFILE.age_group,
      income_band: DEMO_PROFILE.income_band,
    }),
  ];

  return {
    benchmark,
    initialFeed,
    mapViews: [
      buildMapView({
        id: "current",
        label: "現在地",
        description: "同じ年代・年収帯の荒野で、自分の少し先にいる戦友たちを可視化します。",
        points: currentPoints,
        ctaHref: "/quests",
        ctaLabel: "通信費の見直しから始める",
        topQuestTitle: "通信費の見直し",
      }),
      buildMapView({
        id: "income-up",
        label: "年収+1帯を覗く",
        description: "年収帯が1段上がった景色です。同じ年齢でも右上の密度が上がります。",
        points: futurePoints,
        ctaHref: "/triggers?boostIncome=10000",
        ctaLabel: "収入を1万円伸ばす導線へ",
        topQuestTitle: "週末の副業1本",
      }),
      buildMapView({
        id: "expense-cut",
        label: "固定費-1万円後",
        description: "今の景色のまま、自分だけが固定費を1万円削った未来投影です。",
        points: buildProjectionPoints(currentPoints, currentUserId),
        ctaHref: "/triggers?cutFixed=10000",
        ctaLabel: "固定費を1万円削る",
        topQuestTitle: "通信費の見直し",
        isProjection: true,
      }),
    ] satisfies SegmentMapView[],
    topQuestTitle: "通信費の見直し",
  };
}

export default async function MapPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const supabase = await createSupabaseServer();
  const { data: userData } = await supabase.auth.getUser();
  const admin = createSupabaseAdmin();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const demoMode = readFlag(resolvedSearchParams?.demo);

  const user = userData.user;
  const { data } = await supabase
    .from("transactions")
    .select("id, created_at, type, amount, note")
    .eq("user_id", user?.id ?? "")
    .order("created_at", { ascending: false })
    .limit(200);

  const items = ((data ?? []) as Transaction[]) ?? [];
  const snapshot = buildFinanceSnapshot(items);

  const { data: profileData } = await admin
    .from("user_profiles")
    .select("user_id, age_group, income_band, created_at, updated_at")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();

  const profile =
    (profileData as UserProfile | null) ??
    (demoMode && user
      ? {
          user_id: user.id,
          age_group: DEMO_PROFILE.age_group,
          income_band: DEMO_PROFILE.income_band,
        }
      : null);

  let benchmark: SegmentBenchmark | null = null;
  let rpcError: string | null = null;
  let initialFeed: BattleFeedItem[] = [];
  let mapViews: SegmentMapView[] = [];
  let recommendedQuestTitle: string | null = null;

  if (user?.id && profile) {
    if (demoMode) {
      const demo = createDemoData(user.id, snapshot);
      benchmark = demo.benchmark;
      initialFeed = demo.initialFeed;
      mapViews = demo.mapViews;
      recommendedQuestTitle = demo.topQuestTitle;
    } else {
      const { data: rpcData, error: benchmarkError } = await admin.rpc("get_segment_benchmark", {
        p_user_id: user.id,
        p_age_group: profile.age_group,
        p_income_band: profile.income_band,
      });

      if (benchmarkError) {
        rpcError = benchmarkError.message;
      } else {
        const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        benchmark = (row as SegmentBenchmark | null) ?? null;
      }

      const selfPoint = createSelfPoint(user.id, snapshot);
      const currentSegment = await loadSegmentData({
        admin,
        ageGroup: profile.age_group,
        incomeBand: profile.income_band,
        currentUserId: user.id,
        selfPoint,
      });

      initialFeed = currentSegment.feed;
      recommendedQuestTitle = currentSegment.topQuestTitle;

      mapViews.push(
        buildMapView({
          id: "current",
          label: "現在地",
          description: "今のセグメントで、自分の少し先にいる戦友だけを見せる探索モードです。",
          points: currentSegment.points,
          ctaHref: "/quests",
          ctaLabel: "今の流れに乗る",
          topQuestTitle: currentSegment.topQuestTitle,
        }),
      );

      const upperIncomeBand = nextIncomeBand(profile.income_band);
      if (upperIncomeBand) {
        const upperSegment = await loadSegmentData({
          admin,
          ageGroup: profile.age_group,
          incomeBand: upperIncomeBand,
          currentUserId: user.id,
          selfPoint,
        });

        if (upperSegment.points.length > 1) {
          mapViews.push(
            buildMapView({
              id: "income-up",
              label: "年収+1帯を覗く",
              description: "収入帯が一段上がった場合の実データ景色です。今の自分をそのまま重ねています。",
              points: upperSegment.points,
              ctaHref: "/triggers?boostIncome=10000",
              ctaLabel: "稼ぐ力を増やす",
              topQuestTitle: upperSegment.topQuestTitle,
            }),
          );
        }
      }

      if (currentSegment.points.length > 0) {
        mapViews.push(
          buildMapView({
            id: "expense-cut",
            label: "固定費-1万円後",
            description: "同じセグメントのまま、自分だけが固定費を1万円削った未来投影です。",
            points: buildProjectionPoints(currentSegment.points, user.id),
            ctaHref: "/triggers?cutFixed=10000",
            ctaLabel: "固定費を削る",
            topQuestTitle: currentSegment.topQuestTitle,
            isProjection: true,
          }),
        );
      }
    }
  }

  return (
    <RivalBenchmark
      profile={profile}
      benchmark={benchmark}
      rpcError={rpcError}
      snapshot={snapshot}
      initialFeed={initialFeed}
      mapViews={mapViews}
      recommendedQuestTitle={recommendedQuestTitle}
      demoMode={demoMode}
    />
  );
}

