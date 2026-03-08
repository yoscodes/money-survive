import { createSupabaseServer } from "@/lib/supabase/server";
import { AddTransactionCard, TransactionList } from "./ui";
import { SurvivalStatus } from "./SurvivalStatus";
import { BuddyRoastCard } from "./BuddyRoastCard";
import type { Transaction } from "./types";
import type { BuddyGear } from "@/components/buddy/BuddyAvatar";
import type { QuestReward } from "@/lib/quests/templates";
import { buildFinanceSnapshot } from "@/lib/finance/insights";
import { generateMonthlyBuddyRoast, type MonthlyBuddyRoast } from "@/lib/ai/openai";

function asQuestReward(value: unknown): QuestReward {
  if (!value || typeof value !== "object") return {};
  const v = value as { shield?: unknown; armor?: unknown };
  const shield =
    v.shield === "basic" || v.shield === "ironwall" ? v.shield : undefined;
  const armor = typeof v.armor === "boolean" ? v.armor : undefined;
  return { shield, armor };
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServer();
  const { data: userData } = await supabase.auth.getUser();

  const user = userData.user;
  const { data, error } = await supabase
    .from("transactions")
    .select("id, created_at, type, amount, note")
    .eq("user_id", user?.id ?? "")
    .order("created_at", { ascending: false })
    .limit(120);

  const items = (data ?? []) as Transaction[];
  const snapshot = buildFinanceSnapshot(items);

  // ---- Survival metrics (情報は絞る: 数字は最大3つ) ----
  const now = items.length ? new Date(items[0].created_at) : new Date(0);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const savings =
    items.reduce((acc, tx) => acc + (tx.type === "income" ? tx.amount : -tx.amount), 0) || 0;

  const daysWindow = 90;
  const since = new Date(now.getTime() - daysWindow * 24 * 60 * 60 * 1000);
  const inWindow = items.filter((tx) => new Date(tx.created_at) >= since);
  const windowExpense = inWindow
    .filter((tx) => tx.type === "expense")
    .reduce((acc, tx) => acc + tx.amount, 0);

  const avgMonthlyExpense =
    windowExpense > 0 ? (windowExpense / daysWindow) * 30 : null;

  const monthItems = items.filter((tx) => new Date(tx.created_at) >= monthStart);
  const monthlySurplus =
    monthItems.length === 0
      ? null
      : monthItems.reduce(
          (acc, tx) => acc + (tx.type === "income" ? tx.amount : -tx.amount),
          0,
        );

  const survivalDays =
    avgMonthlyExpense && avgMonthlyExpense > 0
      ? Math.max(0, Math.floor((Math.max(0, savings) / avgMonthlyExpense) * 30))
      : null;

  const buddyLevel = Math.max(1, Math.min(99, 1 + Math.floor(Math.max(0, savings) / 50_000)));

  const recentExpenses = items.filter((tx) => tx.type === "expense");
  const monthExpenses = monthItems
    .filter((tx) => tx.type === "expense")
    .slice(0, 8)
    .map((tx) => ({
      label: tx.note?.trim() ? tx.note.trim() : "支出",
      amount: tx.amount,
      createdAt: tx.created_at,
    }));
  const monthIncomes = monthItems
    .filter((tx) => tx.type === "income")
    .slice(0, 5)
    .map((tx) => ({
      label: tx.note?.trim() ? tx.note.trim() : "収入",
      amount: tx.amount,
      createdAt: tx.created_at,
    }));
  const monthLabel =
    items.length > 0
      ? `${now.getUTCFullYear()}年${now.getUTCMonth() + 1}月`
      : "今月";

  let buddyGear: BuddyGear | undefined = undefined;
  if (user?.id) {
    const { data: qData } = await supabase
      .from("user_quests")
      .select("reward, status")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .limit(50);

    const rewards = ((qData ?? []) as { reward: unknown; status: string }[]).map(
      (x) => asQuestReward(x.reward),
    );
    const shields = rewards.map((r) => r.shield).filter(Boolean) as Array<
      "basic" | "ironwall"
    >;
    const hasArmor = rewards.some((r) => !!r.armor);

    const shield =
      shields.includes("ironwall") ? "ironwall" : shields.includes("basic") ? "basic" : undefined;

    if (shield || hasArmor) buddyGear = { shield, armor: hasArmor };
  }

  let monthlyRoast: MonthlyBuddyRoast | null = null;
  if (monthExpenses.length >= 2) {
    try {
      monthlyRoast = await generateMonthlyBuddyRoast({
        monthLabel,
        savings: snapshot.savings,
        monthlySurplus: snapshot.monthlySurplus,
        avgMonthlyExpense: snapshot.avgMonthlyExpense,
        survivalDays: snapshot.survivalDays,
        expenses: monthExpenses,
        incomes: monthIncomes,
      });
    } catch {
      monthlyRoast = null;
    }
  }

  return (
    <div className="grid gap-5">
      {error ? (
        <div className="rounded-3xl border border-white/10 bg-(--app-crimson)/10 p-6 text-zinc-100">
          <div className="text-sm font-semibold tracking-tight">
            取引の読み込みに失敗しました
          </div>
          <p className="mt-2 text-[13px] leading-6 text-zinc-300">
            Supabase 側に `transactions` テーブルが無い / RLS ポリシーが未設定の可能性があります。
          </p>
          <pre className="mt-4 overflow-auto rounded-2xl bg-black/40 p-3 text-[12px] leading-5">
            {error.message}
          </pre>
        </div>
      ) : (
        <>
          <SurvivalStatus
            survivalDays={survivalDays}
            savings={savings}
            avgMonthlyExpense={avgMonthlyExpense}
            monthlySurplus={monthlySurplus}
            buddyLevel={buddyLevel}
            buddyGear={buddyGear}
            recentExpenses={recentExpenses}
          />

          <BuddyRoastCard roast={monthlyRoast} monthLabel={monthLabel} />

          <div className="grid gap-5 lg:grid-cols-2">
            <AddTransactionCard />
            <TransactionList items={items.slice(0, 12)} />
          </div>
        </>
      )}
    </div>
  );
}

