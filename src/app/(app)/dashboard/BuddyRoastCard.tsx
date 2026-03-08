import type { MonthlyBuddyRoast } from "@/lib/ai/openai";

export function BuddyRoastCard({
  roast,
  monthLabel,
  loading = false,
  failure = false,
}: {
  roast: MonthlyBuddyRoast | null;
  monthLabel: string;
  loading?: boolean;
  failure?: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-black/30 p-6 shadow-sm shadow-black/30">
        <div className="text-[12px] font-semibold text-zinc-500">今月の改善ヒント</div>
        <div className="mt-2 text-sm font-semibold tracking-tight text-zinc-100">
          {monthLabel}のコメントを整理しています
        </div>
        <p className="mt-2 text-[13px] leading-6 text-zinc-400">
          家計の大枠は先に表示しつつ、バディのコメントだけ後から読み込みます。
        </p>
        <div className="mt-4 space-y-3">
          <div className="h-3 w-2/3 rounded-full bg-white/10" />
          <div className="h-3 w-full rounded-full bg-white/10" />
          <div className="h-3 w-4/5 rounded-full bg-white/10" />
        </div>
      </div>
    );
  }

  if (!roast) {
    return (
      <div className="rounded-3xl border border-white/10 bg-black/30 p-6 shadow-sm shadow-black/30">
        <div className="text-[12px] font-semibold text-zinc-500">今月の改善ヒント</div>
        <div className="mt-2 text-sm font-semibold tracking-tight text-zinc-100">
          {failure ? "コメント生成に失敗しました" : `${monthLabel}のデータがまだ足りません`}
        </div>
        <p className="mt-2 text-[13px] leading-6 text-zinc-400">
          {failure
            ? "主要な数字は先に見られる状態を保ちつつ、AIコメントだけ安全にスキップしています。"
            : "今月の支出ログが増えると、バディが『まず直す1点』を具体的に返せるようになります。"}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-black/30 p-6 shadow-sm shadow-black/30">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[12px] font-semibold text-zinc-500">今月の改善ヒント</div>
          <div className="mt-2 text-sm font-semibold tracking-tight text-zinc-100">
            {roast.headline}
          </div>
        </div>
        <div className="rounded-full border border-white/10 bg-(--app-emerald)/15 px-3 py-1 text-[12px] font-semibold text-(--app-emerald)">
          行動ヒント
        </div>
      </div>

      <p className="mt-4 text-[13px] leading-6 text-zinc-300">{roast.body}</p>

      <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3">
        <div className="text-[12px] font-semibold text-zinc-500">まず直す1点</div>
        <div className="mt-1 text-[13px] font-semibold text-zinc-100">{roast.focus}</div>
      </div>
    </div>
  );
}
