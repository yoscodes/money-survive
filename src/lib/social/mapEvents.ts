import {
  createBattleFeedItem,
  createBattleFeedItemFromEvent,
  segmentChannelKey,
  type AgeGroup,
  type BattleFeedItem,
  type IncomeBand,
} from "@/lib/social/segment";

export type MapSegmentEventRow = {
  id: string;
  user_id: string;
  quest_id: string;
  title: string;
  message: string;
  category: string;
  completed_at: string | null;
  delta_days: number | null;
  age_group: AgeGroup;
  income_band: IncomeBand;
};

export function createMapSegmentEventPayload(input: {
  userId: string;
  questId: string;
  title: string;
  category: string;
  reward: unknown;
  completedAt: string;
  ageGroup: AgeGroup;
  incomeBand: IncomeBand;
  recommendedCutFixed?: number | null;
  recommendedBoostIncome?: number | null;
}) {
  const feedItem = createBattleFeedItem({
    id: input.questId,
    title: input.title,
    category: input.category,
    reward: input.reward,
    completed_at: input.completedAt,
    age_group: input.ageGroup,
    income_band: input.incomeBand,
    recommended_cut_fixed: input.recommendedCutFixed,
    recommended_boost_income: input.recommendedBoostIncome,
  });

  return {
    segment_key: segmentChannelKey(input.ageGroup, input.incomeBand),
    user_id: input.userId,
    quest_id: input.questId,
    title: input.title,
    message: feedItem.message,
    category: feedItem.category,
    reward: input.reward,
    completed_at: feedItem.completedAt,
    delta_days: feedItem.deltaDays,
    age_group: input.ageGroup,
    income_band: input.incomeBand,
    recommended_cut_fixed: input.recommendedCutFixed ?? null,
    recommended_boost_income: input.recommendedBoostIncome ?? null,
  };
}

export function mapSegmentEventToBattleFeedItem(row: MapSegmentEventRow): BattleFeedItem {
  return createBattleFeedItemFromEvent({
    id: row.quest_id || row.id,
    message: row.message,
    category: row.category,
    completed_at: row.completed_at,
    delta_days: row.delta_days,
  });
}
