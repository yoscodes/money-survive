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
  tone: "positive" | "warning";
  depletionDateLabel: string | null;
};

export type MonthlySummary = {
  monthKey: string;
  title: string;
  body: string;
  subject: string;
  pushUrl: string;
  deltaDays: number;
  netChange: number;
  expenseTotal: number;
  incomeTotal: number;
  tone: "positive" | "warning";
  depletionDateLabel: string | null;
};

export type LivenessPulseAlert = {
  eventType: "liveness_check";
  dedupeKey: string;
  title: string;
  body: string;
  url: string;
  payload: Record<string, unknown>;
};

function normalizeLabel(note: string | null) {
  return note?.trim().toLowerCase() ?? "";
}

function toMonthDay(date: Date) {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function depletionDateLabel(snapshot: FinanceSnapshot, referenceDate: Date) {
  if (
    snapshot.survivalDays === null ||
    !Number.isFinite(snapshot.survivalDays) ||
    snapshot.survivalDays <= 0
  ) {
    return null;
  }
  const depletionDate = new Date(referenceDate.getTime() + snapshot.survivalDays * 24 * 60 * 60 * 1000);
  return toMonthDay(depletionDate);
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

function createMonthKey(date: Date) {
  return date.toISOString().slice(0, 7);
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

  const currentWeek = allTransactions.filter((tx) => {
    const createdAt = new Date(tx.created_at);
    return createdAt >= start && createdAt < end;
  });

  const currentIncome = sumTransactions(currentWeek, "income");
  const currentExpense = sumTransactions(currentWeek, "expense");
  const netChange = currentIncome - currentExpense;
  const snapshot = buildFinanceSnapshot(allTransactions);
  const avgMonthlyExpense = snapshot.avgMonthlyExpense;
  const noActionWeek = currentWeek.length === 0;
  const deltaDaysRaw =
    avgMonthlyExpense && avgMonthlyExpense > 0 ? (netChange / avgMonthlyExpense) * 30 : 0;
  const deltaDays = Math.round(deltaDaysRaw);
  const depletionLabel = depletionDateLabel(snapshot, referenceDate);
  const tone = noActionWeek || deltaDays <= 0 ? "warning" : "positive";
  const title = "ウィークリー・サバイバル・レポート";
  const body =
    tone === "positive"
      ? `今週の決断でバディの寿命が ${Math.max(1, deltaDays)} 日延びました。収入 ${Math.round(
          currentIncome,
        ).toLocaleString()}円 / 支出 ${Math.round(currentExpense).toLocaleString()}円。`
      : noActionWeek
        ? `今週は記録も行動も止まっていました。${
            depletionLabel ? `このままでは ${depletionLabel} に資金が尽きます。` : "まずは1件だけでも記録を戻しましょう。"
          }`
        : `今週はバディの寿命が ${Math.abs(deltaDays)} 日縮みました。${
            depletionLabel ? `このままでは ${depletionLabel} に資金が尽きます。` : "まずは固定費か小口支出を1つ止血しましょう。"
          }`;

  return {
    weekKey: createWeekKey(start),
    title,
    subject:
      tone === "positive"
        ? `${title}: 今週の寿命 +${Math.max(1, deltaDays)}日`
        : `${title}: 危機の再確認`,
    body,
    pushUrl: "/dashboard",
    deltaDays,
    netChange,
    expenseTotal: Math.round(currentExpense),
    incomeTotal: Math.round(currentIncome),
    tone,
    depletionDateLabel: depletionLabel,
  };
}

export function buildMonthlySummary(
  allTransactions: FinanceTransaction[],
  referenceDate: Date = new Date(),
): MonthlySummary {
  const end = new Date(referenceDate);
  const start = new Date(end.getFullYear(), end.getMonth(), 1);

  const currentMonth = allTransactions.filter((tx) => {
    const createdAt = new Date(tx.created_at);
    return createdAt >= start && createdAt < end;
  });

  const currentIncome = sumTransactions(currentMonth, "income");
  const currentExpense = sumTransactions(currentMonth, "expense");
  const netChange = currentIncome - currentExpense;
  const snapshot = buildFinanceSnapshot(allTransactions);
  const avgMonthlyExpense = snapshot.avgMonthlyExpense;
  const deltaDaysRaw =
    avgMonthlyExpense && avgMonthlyExpense > 0 ? (netChange / avgMonthlyExpense) * 30 : 0;
  const deltaDays = Math.round(deltaDaysRaw);
  const depletionLabel = depletionDateLabel(snapshot, referenceDate);
  const tone = currentMonth.length === 0 || deltaDays <= 0 ? "warning" : "positive";

  const title = "マンスリー・サバイバル・レポート";
  const body =
    tone === "positive"
      ? `今月の行動でバディの寿命が ${Math.max(1, deltaDays)} 日伸びました。月間収支は ${Math.round(
          netChange,
        ).toLocaleString()}円。`
      : currentMonth.length === 0
        ? `今月はまだ記録が止まっています。${
            depletionLabel ? `このままでは ${depletionLabel} に資金が尽きます。` : "まずはざっくり1件、家計を再起動しましょう。"
          }`
        : `今月は月間収支が ${Math.round(netChange).toLocaleString()}円。${
            depletionLabel ? `このままでは ${depletionLabel} に資金が尽きます。` : "今月の止血ポイントを1つ決めましょう。"
          }`;

  return {
    monthKey: createMonthKey(start),
    title,
    subject: `${title}: ${tone === "positive" ? `寿命 +${Math.max(1, deltaDays)}日` : "危機の再確認"}`,
    body,
    pushUrl: "/dashboard",
    deltaDays,
    netChange,
    expenseTotal: Math.round(currentExpense),
    incomeTotal: Math.round(currentIncome),
    tone,
    depletionDateLabel: depletionLabel,
  };
}

export function buildLivenessPulseAlert(input: {
  snapshot: FinanceSnapshot;
  lastSeenAt: string | null;
  referenceDate?: Date;
}) {
  const referenceDate = input.referenceDate ?? new Date();
  const lastSeen = input.lastSeenAt ? new Date(input.lastSeenAt) : null;
  const daysAway = lastSeen
    ? Math.floor((referenceDate.getTime() - lastSeen.getTime()) / (24 * 60 * 60 * 1000))
    : 99;
  if (daysAway < 3) return null;

  const depletionLabel = depletionDateLabel(input.snapshot, referenceDate);
  const survivalDays = input.snapshot.survivalDays;
  return {
    eventType: "liveness_check" as const,
    dedupeKey: `liveness:${lastSeen ? lastSeen.toISOString().slice(0, 10) : "never"}`,
    title: "……まだ、生きてる？",
    body:
      survivalDays !== null && Number.isFinite(survivalDays)
        ? `${
            depletionLabel ? `このままでは ${depletionLabel} に資金が尽きます。` : `生存日数はあと ${survivalDays} 日です。`
          } バディが帰還を待っています。`
        : "3日以上ログが止まっています。ざっくり1件でいいので、生存確認を返してください。",
    url: "/dashboard",
    payload: {
      daysAway,
      survivalDays,
      depletionDateLabel: depletionLabel,
    },
  } satisfies LivenessPulseAlert;
}
