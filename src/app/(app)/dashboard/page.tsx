import { createSupabaseServer } from "@/lib/supabase/server";
import { AddTransactionCard, TransactionList } from "./ui";
import { SurvivalStatus } from "./SurvivalStatus";
import { CauseInsights } from "./CauseInsights";
import type { Transaction } from "./types";
import type { BuddyGear } from "@/components/buddy/BuddyAvatar";
import type { QuestReward } from "@/lib/quests/templates";
import {
  buildFinanceSnapshot,
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
            buddyGear={buddyGear}
          />

          <CauseInsights snapshot={snapshot} />

          <div className="rounded-3xl border border-white/10 bg-black/30 p-6 shadow-sm shadow-black/30">
            <div className="text-sm font-semibold tracking-tight">Log</div>
            <div className="mt-2 text-[13px] leading-6 text-zinc-400">
              いま記録して、直近の収支だけを短く振り返ります。
            </div>
            <div className="mt-5 grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
              <AddTransactionCard hasTransactions={items.length > 0} />
              <TransactionList items={items} avgMonthlyExpense={snapshot.avgMonthlyExpense} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

