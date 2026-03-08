import type { FinanceSnapshot } from "@/lib/finance/insights";

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

  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-sm shadow-black/30">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold tracking-tight">原因分析</div>
          <div className="mt-2 text-[13px] leading-6 text-zinc-400">
            今の家計を削っている主因を、固定費・小口支出・高額支出の3方向から見ます。
          </div>
        </div>
        <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[12px] text-zinc-300">
          {tendency.label}
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
        <div className="text-[12px] font-semibold text-zinc-500">いまの傾向</div>
        <div className="mt-2 text-[14px] font-semibold text-zinc-100">{tendency.label}</div>
        <p className="mt-2 text-[13px] leading-6 text-zinc-400">{tendency.body}</p>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <InsightList
          title="固定費候補"
          empty="繰り返し支出の候補はまだ少なめです。"
          items={snapshot.recurringExpenseCandidates.slice(0, 3).map((item) => ({
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
