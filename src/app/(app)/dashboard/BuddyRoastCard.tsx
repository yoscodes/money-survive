import type { MonthlyBuddyRoast } from "@/lib/ai/openai";

export function BuddyRoastCard({
  roast,
  monthLabel,
}: {
  roast: MonthlyBuddyRoast | null;
  monthLabel: string;
}) {
  if (!roast) {
    return (
      <div className="rounded-3xl border border-white/10 bg-black/30 p-6 shadow-sm shadow-black/30">
        <div className="text-[12px] font-semibold text-zinc-500">バディからの今月のダメ出し</div>
        <div className="mt-2 text-sm font-semibold tracking-tight text-zinc-100">
          {monthLabel}のデータが足りません
        </div>
        <p className="mt-2 text-[13px] leading-6 text-zinc-400">
          今月の支出ログが増えると、バディの毒舌アドバイスが届きます。
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-black/30 p-6 shadow-sm shadow-black/30">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[12px] font-semibold text-zinc-500">バディからの今月のダメ出し</div>
          <div className="mt-2 text-sm font-semibold tracking-tight text-zinc-100">
            {roast.headline}
          </div>
        </div>
        <div className="rounded-full border border-white/10 bg-(--app-crimson)/15 px-3 py-1 text-[12px] font-semibold text-(--app-crimson)">
          毒舌
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
