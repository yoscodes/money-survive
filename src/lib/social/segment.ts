import type { QuestReward } from "@/lib/quests/templates";

export const AGE_GROUPS = ["20代", "30代", "40代", "50代", "60代+"] as const;
export const INCOME_BANDS = [
  "300万層",
  "400万層",
  "500万層",
  "600万層",
  "700万層+",
] as const;

export type AgeGroup = (typeof AGE_GROUPS)[number];
export type IncomeBand = (typeof INCOME_BANDS)[number];

export type UserProfile = {
  user_id: string;
  age_group: AgeGroup;
  income_band: IncomeBand;
  created_at?: string;
  updated_at?: string;
};

export type SegmentBenchmark = {
  segment_size: number;
  avg_savings: number | null;
  avg_survival_days: number | null;
  avg_monthly_expense: number | null;
  my_savings: number | null;
  my_survival_days: number | null;
  my_avg_monthly_expense: number | null;
  my_rank: number | null;
  poison_completed: number;
  doping_completed: number;
  shield_completed: number;
};

export type BattleFeedItem = {
  id: string;
  message: string;
  category: "poison" | "doping" | "shield";
  completedAt: string;
  deltaDays: number;
  reactionCount: number;
};

export type SegmentMapPoint = {
  id: string;
  label: string;
  survivalDays: number;
  monthlySurplus: number;
  savings: number;
  rank: number | null;
  isSelf?: boolean;
};

export type SegmentMapView = {
  id: string;
  label: string;
  description: string;
  points: SegmentMapPoint[];
  avgSurvivalDays: number | null;
  avgMonthlySurplus: number | null;
  hiddenCount: number;
  ctaHref: string;
  ctaLabel: string;
  topQuestTitle?: string | null;
  isProjection?: boolean;
};

export function isAgeGroup(value: string): value is AgeGroup {
  return AGE_GROUPS.includes(value as AgeGroup);
}

export function isIncomeBand(value: string): value is IncomeBand {
  return INCOME_BANDS.includes(value as IncomeBand);
}

export function nextIncomeBand(value: IncomeBand): IncomeBand | null {
  const index = INCOME_BANDS.indexOf(value);
  if (index < 0 || index >= INCOME_BANDS.length - 1) return null;
  return INCOME_BANDS[index + 1] ?? null;
}

export function segmentLabel(profile: Pick<UserProfile, "age_group" | "income_band">) {
  return `${profile.age_group}・年収${profile.income_band}`;
}

export function segmentChannelKey(
  ageGroup: AgeGroup,
  incomeBand: IncomeBand,
) {
  const ageIndex = AGE_GROUPS.indexOf(ageGroup);
  const incomeIndex = INCOME_BANDS.indexOf(incomeBand);
  return `segment:${Math.max(ageIndex, 0)}:${Math.max(incomeIndex, 0)}`;
}

function asQuestReward(value: unknown): QuestReward {
  if (!value || typeof value !== "object") return {};
  const v = value as { shield?: unknown; armor?: unknown };
  const shield =
    v.shield === "basic" || v.shield === "ironwall" ? v.shield : undefined;
  const armor = typeof v.armor === "boolean" ? v.armor : undefined;
  return { shield, armor };
}

function gearText(category: string, reward: QuestReward, title: string) {
  if (reward.shield === "ironwall") return `${title}で鉄壁の盾を手に入れました`;
  if (reward.shield === "basic") return `${title}で盾を手に入れました`;
  if (reward.armor) return `${title}で鎧を装備しました`;
  if (category === "poison") return `${title}で固定費を削りました`;
  if (category === "doping") return `${title}で稼ぐ力を伸ばしました`;
  return `${title}を完了しました`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function seedFromString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function estimateQuestDeltaDays(row: {
  category: string;
  reward: QuestReward;
  recommended_cut_fixed?: number | null;
  recommended_boost_income?: number | null;
}) {
  if (row.reward.shield === "ironwall") return 9;
  if (row.reward.shield === "basic") return 6;
  if (row.reward.armor) return 5;

  const recommended = Math.max(
    row.recommended_cut_fixed ?? 0,
    row.recommended_boost_income ?? 0,
  );
  if (recommended > 0) {
    return clamp(Math.round(recommended / 3000), 2, 12);
  }

  if (row.category === "poison") return 4;
  if (row.category === "doping") return 6;
  return 5;
}

export function createBattleFeedItem(row: {
  id: string;
  title: string;
  category: string;
  completed_at: string | null;
  reward: unknown;
  age_group: AgeGroup;
  income_band: IncomeBand;
  recommended_cut_fixed?: number | null;
  recommended_boost_income?: number | null;
}): BattleFeedItem {
  const reward = asQuestReward(row.reward);
  const deltaDays = estimateQuestDeltaDays({
    category: row.category,
    reward,
    recommended_cut_fixed: row.recommended_cut_fixed,
    recommended_boost_income: row.recommended_boost_income,
  });
  return {
    id: row.id,
    category:
      row.category === "poison" || row.category === "doping" || row.category === "shield"
        ? row.category
        : "shield",
    completedAt: row.completed_at ?? new Date().toISOString(),
    deltaDays,
    reactionCount: (seedFromString(row.id) % 6) + 2,
    message: `同じ${row.age_group}・年収${row.income_band}の誰かが、今、${gearText(
      row.category,
      reward,
      row.title,
    )}。`,
  };
}

export function createBattleFeedItemFromEvent(row: {
  id: string;
  message: string;
  category: string;
  completed_at: string | null;
  delta_days?: number | null;
}): BattleFeedItem {
  return {
    id: row.id,
    message: row.message,
    category:
      row.category === "poison" || row.category === "doping" || row.category === "shield"
        ? row.category
        : "shield",
    completedAt: row.completed_at ?? new Date().toISOString(),
    deltaDays: row.delta_days ?? 4,
    reactionCount: (seedFromString(row.id) % 6) + 2,
  };
}

export function formatDelta(current: number | null, average: number | null, unit: string) {
  if (current === null || average === null) return "—";
  const delta = Math.round(current - average);
  if (delta === 0) return `平均と同じ ${Math.round(current).toLocaleString()}${unit}`;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toLocaleString()}${unit}`;
}
