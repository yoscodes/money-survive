import { buildFinanceSnapshot, type FinanceSnapshot, type FinanceTransaction } from "@/lib/finance/insights";
import type { SegmentMapPoint } from "@/lib/social/segment";

export type SegmentTransactionRow = FinanceTransaction & {
  user_id: string;
};

export type QuestProjectionInput = {
  avgMonthlyExpense: number | null;
  estimatedDeltaDays?: number | null;
  recommendedCutFixed?: number | null;
  recommendedBoostIncome?: number | null;
  shieldMode?: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function pointScore(point: SegmentMapPoint) {
  return point.survivalDays * 2 + point.monthlySurplus / 5000 + point.savings / 100000;
}

export function withRanks(points: SegmentMapPoint[]) {
  const sorted = [...points].sort((a, b) => pointScore(b) - pointScore(a));
  return sorted.map((point, index) => ({
    ...point,
    rank: index + 1,
  }));
}

export function createSelfPoint(
  userId: string,
  snapshot: Pick<FinanceSnapshot, "survivalDays" | "monthlySurplus" | "savings">,
): SegmentMapPoint {
  return {
    id: userId,
    label: "あなた",
    survivalDays: snapshot.survivalDays ?? 0,
    monthlySurplus: snapshot.monthlySurplus ?? 0,
    savings: snapshot.savings,
    rank: null,
    isSelf: true,
  };
}

export function buildSegmentPoints(
  userIds: string[],
  transactionRows: SegmentTransactionRow[],
  selfPoint: SegmentMapPoint,
) {
  const grouped = new Map<string, FinanceTransaction[]>();
  for (const userId of userIds) {
    grouped.set(userId, []);
  }
  for (const row of transactionRows) {
    const items = grouped.get(row.user_id);
    if (!items) continue;
    items.push({
      id: row.id,
      created_at: row.created_at,
      type: row.type,
      amount: row.amount,
      note: row.note,
    });
  }

  let buddyNumber = 1;
  const points = userIds.map((userId) => {
    if (userId === selfPoint.id) return selfPoint;
    const items = grouped.get(userId) ?? [];
    const snapshot = buildFinanceSnapshot(items);
    const point: SegmentMapPoint = {
      id: userId,
      label: `戦友${buddyNumber}`,
      survivalDays: snapshot.survivalDays ?? 0,
      monthlySurplus: snapshot.monthlySurplus ?? 0,
      savings: snapshot.savings,
      rank: null,
    };
    buddyNumber += 1;
    return point;
  });

  if (!userIds.includes(selfPoint.id)) {
    points.push(selfPoint);
  }

  return withRanks(points);
}

export function projectPointForQuest(
  point: SegmentMapPoint,
  input: QuestProjectionInput,
): SegmentMapPoint {
  const cutFixed = Math.max(0, input.recommendedCutFixed ?? 0);
  const boostIncome = Math.max(0, input.recommendedBoostIncome ?? 0);
  const avgMonthlyExpense = input.avgMonthlyExpense;

  let survivalDays = point.survivalDays;
  const monthlySurplus = point.monthlySurplus + cutFixed + boostIncome;
  const savings = point.savings + boostIncome;

  if (avgMonthlyExpense && avgMonthlyExpense > 0) {
    const adjustedExpense = Math.max(1, avgMonthlyExpense - cutFixed);
    const adjustedSavings = Math.max(0, point.savings + boostIncome);
    survivalDays = Math.max(0, Math.floor((adjustedSavings / adjustedExpense) * 30));
  } else if (boostIncome > 0) {
    survivalDays = point.survivalDays + clamp(Math.round(boostIncome / 2000), 1, 15);
  }

  if (input.shieldMode) {
    const bonusDays =
      input.estimatedDeltaDays && input.estimatedDeltaDays > 0
        ? input.estimatedDeltaDays
        : 6;
    survivalDays += bonusDays;
  } else if (!cutFixed && !boostIncome && input.estimatedDeltaDays && input.estimatedDeltaDays > 0) {
    survivalDays += input.estimatedDeltaDays;
  }

  return {
    ...point,
    survivalDays,
    monthlySurplus,
    savings,
  };
}
