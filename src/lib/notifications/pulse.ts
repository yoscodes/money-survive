import {
  buildFinanceSnapshot,
  type FinanceSnapshot,
  type FinanceTransaction,
} from "@/lib/finance/insights";

type WasteCategory =
  | "convenience"
  | "delivery"
  | "cafe"
  | "subscription"
  | "shopping";

export type ImmediatePulseAlert = {
  eventType: "immediate_survival" | "immediate_waste";
  dedupeKey: string;
  cooldownHours: number;
  title: string;
  body: string;
  url: string;
  payload: Record<string, unknown>;
};

export type WeeklySummary = {
  weekKey: string;
  title: string;
  body: string;
  subject: string;
  pushUrl: string;
  deltaDays: number;
  netChange: number;
  expenseTotal: number;
  incomeTotal: number;
};

function normalizeLabel(note: string | null) {
  return note?.trim().toLowerCase() ?? "";
}

function calcHoursLost(amount: number, avgMonthlyExpense: number | null) {
  if (!avgMonthlyExpense || avgMonthlyExpense <= 0) return null;
  const daily = avgMonthlyExpense / 30;
  const hours = (amount / daily) * 24;
  if (!Number.isFinite(hours)) return null;
  return Math.max(1, Math.round(hours));
}

function classifyWasteCategory(note: string | null): WasteCategory | null {
  const value = normalizeLabel(note);
  if (!value) return null;

  const patterns: Array<{ category: WasteCategory; keywords: string[] }> = [
    {
      category: "convenience",
      keywords: ["コンビニ", "7-11", "7eleven", "ファミマ", "ローソン", "mini stop"],
    },
    {
      category: "delivery",
      keywords: ["uber", "ubereats", "出前", "menu", "wolt", "デリバリー"],
    },
    {
      category: "cafe",
      keywords: ["カフェ", "starbucks", "スタバ", "coffee", "コーヒー", "ドトール"],
    },
    {
      category: "subscription",
      keywords: ["netflix", "spotify", "amazon prime", "サブスク", "subscription"],
    },
    {
      category: "shopping",
      keywords: ["zozo", "amazon", "楽天", "shopping", "買い物"],
    },
  ];

  for (const pattern of patterns) {
    if (pattern.keywords.some((keyword) => value.includes(keyword.toLowerCase()))) {
      return pattern.category;
    }
  }
  return null;
}

function wasteLabel(category: WasteCategory) {
  if (category === "convenience") return "コンビニ";
  if (category === "delivery") return "デリバリー";
  if (category === "cafe") return "カフェ";
  if (category === "subscription") return "サブスク";
  return "衝動買い";
}

export function detectImmediatePulseAlerts(
  snapshot: FinanceSnapshot,
  transaction: FinanceTransaction,
): ImmediatePulseAlert[] {
  const alerts: ImmediatePulseAlert[] = [];

  if (
    transaction.type === "expense" &&
    snapshot.survivalDays !== null &&
    Number.isFinite(snapshot.survivalDays) &&
    snapshot.survivalDays < 30
  ) {
    alerts.push({
      eventType: "immediate_survival",
      dedupeKey: "survival-under-30",
      cooldownHours: 24,
      title: "バディが泣いています",
      body: `生存日数が ${snapshot.survivalDays} 日まで縮みました。まずは固定費か小口支出を1つ止血しましょう。`,
      url: "/triggers",
      payload: {
        survivalDays: snapshot.survivalDays,
        transactionAmount: transaction.amount,
      },
    });
  }

  if (transaction.type !== "expense") return alerts;

  const wasteCategory = classifyWasteCategory(transaction.note);
  const smallHotspotMatch = snapshot.smallExpenseHotspots.find(
    (item) =>
      item.label !== "メモなし" &&
      normalizeLabel(item.label) === normalizeLabel(transaction.note),
  );

  if (wasteCategory || smallHotspotMatch) {
    const label = wasteCategory ? wasteLabel(wasteCategory) : "小口支出";
    const hours = calcHoursLost(transaction.amount, snapshot.avgMonthlyExpense);
    const wasteKey = (wasteCategory ?? normalizeLabel(transaction.note)) || "misc";
    alerts.push({
      eventType: "immediate_waste",
      dedupeKey: `waste-${wasteKey}`,
      cooldownHours: 6,
      title: "バディが泣いています",
      body:
        hours === null
          ? `${label}の支出を検知しました。小さな出費でも積み重なると危険です。`
          : `${label}の支出で寿命が ${hours} 時間縮みました。今のうちに流れを止めましょう。`,
      url: "/dashboard",
      payload: {
        wasteCategory: wasteCategory ?? "misc",
        amount: transaction.amount,
        label: transaction.note,
      },
    });
  }

  return alerts;
}

export function createWeekKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function sumTransactions(items: FinanceTransaction[], type: "income" | "expense") {
  return items
    .filter((item) => item.type === type)
    .reduce((acc, item) => acc + item.amount, 0);
}

export function buildWeeklySummary(
  allTransactions: FinanceTransaction[],
  referenceDate: Date = new Date(),
): WeeklySummary {
  const end = new Date(referenceDate);
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  const prevStart = new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000);

  const currentWeek = allTransactions.filter((tx) => {
    const createdAt = new Date(tx.created_at);
    return createdAt >= start && createdAt < end;
  });
  const previousWeek = allTransactions.filter((tx) => {
    const createdAt = new Date(tx.created_at);
    return createdAt >= prevStart && createdAt < start;
  });

  const currentIncome = sumTransactions(currentWeek, "income");
  const currentExpense = sumTransactions(currentWeek, "expense");
  const previousIncome = sumTransactions(previousWeek, "income");
  const previousExpense = sumTransactions(previousWeek, "expense");

  const netChange = currentIncome - currentExpense;
  const previousNetChange = previousIncome - previousExpense;
  const snapshot = buildFinanceSnapshot(allTransactions);
  const avgMonthlyExpense = snapshot.avgMonthlyExpense;
  const deltaDaysRaw =
    avgMonthlyExpense && avgMonthlyExpense > 0 ? (netChange / avgMonthlyExpense) * 30 : 0;
  const deltaDays = Math.round(deltaDaysRaw);

  const direction =
    deltaDays > 0
      ? `先週の行動で寿命が ${deltaDays} 日延びました。`
      : deltaDays < 0
        ? `先週の行動で寿命が ${Math.abs(deltaDays)} 日縮みました。`
        : "先週の寿命変化は 0 日でした。";
  const trend =
    netChange >= previousNetChange
      ? "前週より持ち直しています。"
      : "前週より少し苦しくなっています。";

  const title = "ウィークリー・サバイバル・レポート";
  const body = `${direction} 収入 ${Math.round(currentIncome).toLocaleString()}円 / 支出 ${Math.round(currentExpense).toLocaleString()}円。${trend}`;

  return {
    weekKey: createWeekKey(start),
    title,
    subject: `${title}: ${direction}`,
    body,
    pushUrl: "/dashboard",
    deltaDays,
    netChange,
    expenseTotal: Math.round(currentExpense),
    incomeTotal: Math.round(currentIncome),
  };
}
