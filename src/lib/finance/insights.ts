export type FinanceTransaction = {
  id: string;
  created_at: string;
  type: "income" | "expense";
  amount: number;
  note: string | null;
};

export type SpendingTendency = "small" | "fixed" | "spiky" | "unknown";

export type ExpensePattern = {
  label: string;
  count: number;
  averageAmount: number;
  latestAt: string;
};

export type FinanceSnapshot = {
  transactionCount: number;
  incomeCount: number;
  expenseCount: number;
  expenseCount30: number;
  savings: number;
  avgMonthlyExpense: number | null;
  monthlySurplus: number | null;
  survivalDays: number | null;
  spendingTendency: SpendingTendency;
  recurringExpenseCandidates: ExpensePattern[];
  smallExpenseHotspots: ExpensePattern[];
  highExpenseItems: Array<{
    label: string;
    amount: number;
    createdAt: string;
  }>;
  recentExpenses: Array<{
    label: string;
    amount: number;
    createdAt: string;
  }>;
};

export const APP_TIME_ZONE = "Asia/Tokyo";

function normalizeLabel(note: string | null) {
  const raw = note?.trim();
  if (!raw) return "メモなし";
  return raw.replace(/\s+/g, " ").slice(0, 80);
}

function datePartsInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const read = (type: "year" | "month" | "day") =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
  };
}

export function monthKeyInTimeZone(date: Date, timeZone = APP_TIME_ZONE) {
  const { year, month } = datePartsInTimeZone(date, timeZone);
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function formatMonthLabel(date: Date, timeZone = APP_TIME_ZONE) {
  const { year, month } = datePartsInTimeZone(date, timeZone);
  return `${year}年${month}月`;
}

export function filterCurrentMonthTransactions(
  items: FinanceTransaction[],
  now = new Date(),
  timeZone = APP_TIME_ZONE,
) {
  const currentMonthKey = monthKeyInTimeZone(now, timeZone);
  return items.filter(
    (tx) => monthKeyInTimeZone(new Date(tx.created_at), timeZone) === currentMonthKey,
  );
}

function calcSurvivalDays(savings: number, avgMonthlyExpense: number | null) {
  if (!avgMonthlyExpense || avgMonthlyExpense <= 0) return null;
  return Math.max(0, Math.floor((Math.max(0, savings) / avgMonthlyExpense) * 30));
}

function deriveSpendingTendency(items: FinanceTransaction[], now: Date): SpendingTendency {
  const days30 = 30;
  const since30 = new Date(now.getTime() - days30 * 24 * 60 * 60 * 1000);
  const exp30 = items.filter((tx) => tx.type === "expense" && new Date(tx.created_at) >= since30);
  const smallCount = exp30.filter((tx) => tx.amount > 0 && tx.amount < 2000).length;
  const largeCount = exp30.filter((tx) => tx.amount >= 10000).length;
  const expCount = exp30.length;
  const smallRate = expCount ? smallCount / expCount : 0;

  if (expCount === 0) return "unknown";
  if (expCount >= 12 && smallRate >= 0.6) return "small";
  if (largeCount <= 1) return "fixed";
  return "spiky";
}

export function buildFinanceSnapshot(
  items: FinanceTransaction[],
  options?: { now?: Date; timeZone?: string },
): FinanceSnapshot {
  const now = options?.now ?? new Date();
  const timeZone = options?.timeZone ?? APP_TIME_ZONE;
  const daysWindow = 90;
  const since90 = new Date(now.getTime() - daysWindow * 24 * 60 * 60 * 1000);

  const incomes = items.filter((tx) => tx.type === "income");
  const expenses = items.filter((tx) => tx.type === "expense");
  const in90 = items.filter((tx) => new Date(tx.created_at) >= since90);
  const expense90 = in90.filter((tx) => tx.type === "expense");
  const monthItems = filterCurrentMonthTransactions(items, now, timeZone);
  const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const expense30 = expenses.filter((tx) => new Date(tx.created_at) >= since30);

  const savings =
    items.reduce((acc, tx) => acc + (tx.type === "income" ? tx.amount : -tx.amount), 0) || 0;
  const windowExpense = expense90.reduce((acc, tx) => acc + tx.amount, 0);
  const avgMonthlyExpense = windowExpense > 0 ? (windowExpense / daysWindow) * 30 : null;
  const monthlySurplus =
    monthItems.length === 0
      ? null
      : monthItems.reduce(
          (acc, tx) => acc + (tx.type === "income" ? tx.amount : -tx.amount),
          0,
        );
  const survivalDays = calcSurvivalDays(savings, avgMonthlyExpense);

  const expenseGroups = new Map<
    string,
    { count: number; totalAmount: number; latestAt: string }
  >();
  for (const tx of expenses) {
    const label = normalizeLabel(tx.note);
    const prev = expenseGroups.get(label);
    if (prev) {
      prev.count += 1;
      prev.totalAmount += tx.amount;
      if (new Date(tx.created_at) > new Date(prev.latestAt)) prev.latestAt = tx.created_at;
    } else {
      expenseGroups.set(label, {
        count: 1,
        totalAmount: tx.amount,
        latestAt: tx.created_at,
      });
    }
  }

  const grouped = [...expenseGroups.entries()].map(([label, value]) => ({
    label,
    count: value.count,
    averageAmount: Math.round(value.totalAmount / value.count),
    latestAt: value.latestAt,
  }));

  const recurringExpenseCandidates = grouped
    .filter((item) => item.count >= 2 && item.averageAmount >= 1500)
    .sort((a, b) => b.count - a.count || b.averageAmount - a.averageAmount)
    .slice(0, 5);

  const smallExpenseHotspots = grouped
    .filter((item) => item.count >= 2 && item.averageAmount < 2500)
    .sort((a, b) => b.count - a.count || b.averageAmount - a.averageAmount)
    .slice(0, 5);

  const highExpenseItems = [...expenses]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map((tx) => ({
      label: normalizeLabel(tx.note),
      amount: Math.round(tx.amount),
      createdAt: tx.created_at,
    }));

  const recentExpenses = expenses.slice(0, 8).map((tx) => ({
    label: normalizeLabel(tx.note),
    amount: Math.round(tx.amount),
    createdAt: tx.created_at,
  }));

  return {
    transactionCount: items.length,
    incomeCount: incomes.length,
    expenseCount: expenses.length,
    expenseCount30: expense30.length,
    savings,
    avgMonthlyExpense,
    monthlySurplus,
    survivalDays,
    spendingTendency: deriveSpendingTendency(items, now),
    recurringExpenseCandidates,
    smallExpenseHotspots,
    highExpenseItems,
    recentExpenses,
  };
}
