import Link from "next/link";
import { estimateRecoveredDays, type FinanceSnapshot } from "@/lib/finance/insights";

function formatCurrency(value: number) {
  return `${Math.round(value).toLocaleString()}円`;
}

function tendencyCopy(tendency: FinanceSnapshot["spendingTendency"]) {
  if (tendency === "small") {
    return {
      label: "小口支出が多い",
      body: "小さい出費が積み重なりやすい状態です。まずは頻度の高い支出名から止血すると効きます。",
    };
  }
  if (tendency === "fixed") {
    return {
      label: "固定費寄り",
      body: "毎月のベースコストが重めです。高頻度で繰り返す支出から見直すと改善幅が出ます。",
    };
  }
  if (tendency === "spiky") {
    return {
      label: "高額支出の波が大きい",
      body: "単発の大きな出費が効いています。再発防止ルールを先に決めると安定しやすいです。",
    };
  }
  return {
    label: "まだ分析中",
    body: "支出ログが増えるほど、改善ポイントをはっきり示せるようになります。",
  };
}

export function CauseInsights({ snapshot }: { snapshot: FinanceSnapshot }) {
  const tendency = tendencyCopy(snapshot.spendingTendency);
  const topRecurring = snapshot.heavyRecurringExpenses[0] ?? snapshot.recurringExpenseCandidates[0] ?? null;
  const topUnexpected = snapshot.unusualExpenseItems[0] ?? null;
  const culprit =
    topUnexpected
      ? {
          title: `予定外支出「${topUnexpected.label}」`,
          body: `${formatCurrency(topUnexpected.amount)}の単発支出が直近で強く効いています。平均より大きい出費として優先度が高いです。`,
          delta: estimateRecoveredDays(topUnexpected.amount, snapshot.avgMonthlyExpense),
        }
      : topRecurring
        ? {
            title: `重い固定費「${topRecurring.label}」`,
            body: `${topRecurring.count}回・平均${formatCurrency(topRecurring.averageAmount)}の支出です。毎月効くぶん、家計への圧力が大きいです。`,
            delta: estimateRecoveredDays(topRecurring.averageAmount, snapshot.avgMonthlyExpense),
          }
        : null;

  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-sm shadow-black/30">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold tracking-tight">Cause</div>
          <div className="mt-2 text-[13px] leading-6 text-zinc-400">
            生存日数を削っている犯人を、予定外支出・重い固定費・小口支出の順で洗い出します。
          </div>
        </div>
        <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[12px] text-zinc-300">
          {tendency.label}
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
        <div className="text-[12px] font-semibold text-zinc-500">いまの犯人</div>
        {culprit ? (
          <>
            <div className="mt-2 text-[14px] font-semibold text-zinc-100">{culprit.title}</div>
            <p className="mt-2 text-[13px] leading-6 text-zinc-400">{culprit.body}</p>
            {culprit.delta ? (
              <div className="mt-3 text-[13px] font-semibold text-(--app-crimson)">
                放置コスト: 推定 {culprit.delta}日分
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div className="mt-2 text-[14px] font-semibold text-zinc-100">{tendency.label}</div>
            <p className="mt-2 text-[13px] leading-6 text-zinc-400">{tendency.body}</p>
          </>
        )}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <InsightList
          title="予定外の犯人"
          empty="単発で大きすぎる支出はまだ目立っていません。"
          items={snapshot.unusualExpenseItems.slice(0, 3).map((item) => ({
            key: `${item.label}:${item.createdAt}`,
            title: item.label,
            meta: `${formatCurrency(item.amount)} / ${
              item.ratioToAverage ? `平均の${item.ratioToAverage}倍` : new Date(item.createdAt).toLocaleDateString("ja-JP")
            }`,
          }))}
        />
        <InsightList
          title="重い固定費"
          empty="重い固定費候補はまだ少なめです。"
          items={(snapshot.heavyRecurringExpenses.length > 0
            ? snapshot.heavyRecurringExpenses
            : snapshot.recurringExpenseCandidates
          )
            .slice(0, 3)
            .map((item) => ({
            key: `${item.label}:${item.latestAt}`,
            title: item.label,
            meta: `${item.count}回 / 平均 ${formatCurrency(item.averageAmount)}`,
          }))}
        />
        <InsightList
          title="小口支出ホットスポット"
          empty="小さい支出の偏りはまだ見えていません。"
          items={snapshot.smallExpenseHotspots.slice(0, 3).map((item) => ({
            key: `${item.label}:${item.latestAt}`,
            title: item.label,
            meta: `${item.count}回 / 平均 ${formatCurrency(item.averageAmount)}`,
          }))}
        />
        <InsightList
          title="高額支出"
          empty="大きな支出はまだ目立っていません。"
          items={snapshot.highExpenseItems.slice(0, 3).map((item) => ({
            key: `${item.label}:${item.createdAt}`,
            title: item.label,
            meta: `${formatCurrency(item.amount)} / ${new Date(item.createdAt).toLocaleDateString("ja-JP")}`,
          }))}
        />
      </div>
      <div className="mt-5 flex justify-end">
        <Link
          href="/quests"
          className="inline-flex rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] font-semibold text-zinc-100 hover:border-white/20"
        >
          対策クエストを見る →
        </Link>
      </div>
    </div>
  );
}

function InsightList({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: Array<{ key: string; title: string; meta: string }>;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="text-[12px] font-semibold text-zinc-500">{title}</div>
      {items.length === 0 ? (
        <div className="mt-3 text-[13px] leading-6 text-zinc-400">{empty}</div>
      ) : (
        <ul className="mt-3 grid gap-3">
          {items.map((item) => (
            <li key={item.key} className="rounded-2xl border border-white/10 bg-black/30 px-3 py-3">
              <div className="text-[13px] font-semibold text-zinc-100">{item.title}</div>
              <div className="mt-1 text-[12px] text-zinc-400">{item.meta}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
