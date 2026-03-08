import { Suspense } from "react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { AddTransactionCard, TransactionList } from "./ui";
import { SurvivalStatus } from "./SurvivalStatus";
import { BuddyRoastCard } from "./BuddyRoastCard";
import { CauseInsights } from "./CauseInsights";
import { MonthlyBuddyRoastSection } from "./MonthlyBuddyRoastSection";
import type { Transaction } from "./types";
import type { BuddyGear } from "@/components/buddy/BuddyAvatar";
import type { QuestReward } from "@/lib/quests/templates";
import {
  buildFinanceSnapshot,
  filterCurrentMonthTransactions,
  formatMonthLabel,
} from "@/lib/finance/insights";

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
  const now = new Date();

  const user = userData.user;
  const { data, error } = await supabase
    .from("transactions")
    .select("id, created_at, type, amount, note")
    .eq("user_id", user?.id ?? "")
    .order("created_at", { ascending: false })
    .limit(120);

  const items = (data ?? []) as Transaction[];
  const snapshot = buildFinanceSnapshot(items, { now });
  const buddyLevel = Math.max(
    1,
    Math.min(99, 1 + Math.floor(Math.max(0, snapshot.savings) / 50_000)),
  );

  const monthItems = filterCurrentMonthTransactions(items, now);
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
  const monthLabel = formatMonthLabel(now);

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
            snapshot={snapshot}
            buddyLevel={buddyLevel}
            buddyGear={buddyGear}
          />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
            <CauseInsights snapshot={snapshot} />
            <Suspense fallback={<BuddyRoastCard roast={null} monthLabel={monthLabel} loading />}>
              <MonthlyBuddyRoastSection
                monthLabel={monthLabel}
                savings={snapshot.savings}
                monthlySurplus={snapshot.monthlySurplus}
                avgMonthlyExpense={snapshot.avgMonthlyExpense}
                survivalDays={snapshot.survivalDays}
                expenses={monthExpenses}
                incomes={monthIncomes}
              />
            </Suspense>
          </div>

          <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
            <AddTransactionCard />
            <TransactionList items={items} />
          </div>
        </>
      )}
    </div>
  );
}

