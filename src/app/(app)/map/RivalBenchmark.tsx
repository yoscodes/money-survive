"use client";

import Link from "next/link";
import { BuddyAvatar, wealthFromSavings, type BuddyRisk } from "@/components/buddy/BuddyAvatar";
import { RealtimeBattleFeed } from "./RealtimeBattleFeed";
import type { FinanceSnapshot } from "@/lib/finance/insights";
import {
  formatDelta,
  segmentLabel,
  type BattleFeedItem,
  type SegmentBenchmark,
  type UserProfile,
} from "@/lib/social/segment";

function riskFromSurvivalDays(survivalDays: number | null): BuddyRisk {
  if (survivalDays === null) return "unknown";
  if (!Number.isFinite(survivalDays)) return "safe";
  if (survivalDays <= 7) return "danger";
  if (survivalDays <= 21) return "warn";
  return "safe";
}

function formatCurrency(value: number | null) {
  if (value === null) return "—";
  return `${Math.round(value).toLocaleString()}円`;
}

function strategyLink(snapshot: FinanceSnapshot, benchmark: SegmentBenchmark | null) {
  if (!benchmark) return "/triggers";
  const myExpense = snapshot.avgMonthlyExpense ?? 0;
  const segmentExpense = benchmark.avg_monthly_expense ?? 0;
  if (myExpense > segmentExpense && myExpense > 0) {
    const cut = Math.max(2000, Math.round(myExpense - segmentExpense));
    return `/triggers?cutFixed=${cut}`;
  }

  const mySurvival = snapshot.survivalDays ?? 0;
  const segmentSurvival = benchmark.avg_survival_days ?? 0;
  if (mySurvival < segmentSurvival) {
    return "/quests";
  }
  return "/triggers";
}

export function RivalBenchmark({
  profile,
  benchmark,
  rpcError,
  snapshot,
  initialFeed,
}: {
  profile: UserProfile | null;
  benchmark: SegmentBenchmark | null;
  rpcError: string | null;
  snapshot: FinanceSnapshot;
  initialFeed: BattleFeedItem[];
}) {
  const risk = riskFromSurvivalDays(snapshot.survivalDays);
  const wealth = wealthFromSavings(snapshot.savings);
  const segmentName = profile ? segmentLabel(profile) : null;
  const enoughSegmentData = (benchmark?.segment_size ?? 0) >= 3;

  return (
    <div className="grid gap-5">
      <div className="rounded-[28px] border border-white/10 bg-zinc-950 p-7 shadow-sm shadow-black/30">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-semibold tracking-tight">近しい境遇の匿名セグメント</div>
            <p className="mt-2 max-w-2xl text-[13px] leading-6 text-zinc-400">
              疑似データではなく、同じ年代・年収帯の戦友たちの匿名集計と行動ログを見せます。
              誰かが先に装備を手に入れた瞬間、その差が行動を促します。
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-[13px] text-zinc-200">
            {segmentName ?? "プロフィール未設定"}
          </div>
        </div>

        {!profile ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-(--app-crimson)/10 p-5 text-[13px] leading-6 text-zinc-200">
            比較に使うプロフィールが未設定です。今後の新規登録では年代・年収帯を保存します。既存ユーザーは
            `user_profiles` に自分の属性を追加するとこの画面が使えます。
          </div>
        ) : rpcError ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-(--app-crimson)/10 p-5 text-[13px] leading-6 text-zinc-200">
            セグメント集計の取得に失敗しました。`user_profiles` と RPC の SQL を実行してください。
            <pre className="mt-3 overflow-auto rounded-2xl bg-black/40 p-3 text-[12px] leading-5 text-zinc-300">
              {rpcError}
            </pre>
          </div>
        ) : !enoughSegmentData ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-black/30 p-5 text-[13px] leading-6 text-zinc-300">
            同じセグメントの人数がまだ少ないため、比較の匿名性と精度が足りません。戦友が増えると、
            平均値とアクティビティフィードが表示されます。
          </div>
        ) : (
          <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr,0.9fr]">
            <div className="grid gap-5">
              <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[12px] font-semibold text-zinc-500">あなたの現在地</div>
                    <div className="mt-2 text-sm font-semibold tracking-tight text-zinc-100">
                      匿名セグメント内での立ち位置
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14">
                      <BuddyAvatar risk={risk} wealth={wealth} className="h-14 w-14" />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3">
                      <div className="text-[12px] font-semibold text-zinc-500">順位</div>
                      <div className="mt-1 text-[15px] font-semibold tabular-nums text-zinc-100">
                        {benchmark?.my_rank ?? "—"} / {benchmark?.segment_size ?? "—"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <MetricCard
                    label="生存日数"
                    value={snapshot.survivalDays === null ? "—" : `${snapshot.survivalDays}日`}
                    subtext={`平均との差 ${formatDelta(
                      snapshot.survivalDays,
                      benchmark?.avg_survival_days ?? null,
                      "日",
                    )}`}
                  />
                  <MetricCard
                    label="すぐ使えるお金"
                    value={formatCurrency(snapshot.savings)}
                    subtext={`平均との差 ${formatDelta(
                      snapshot.savings,
                      benchmark?.avg_savings ?? null,
                      "円",
                    )}`}
                  />
                  <MetricCard
                    label="平均月間支出"
                    value={formatCurrency(snapshot.avgMonthlyExpense)}
                    subtext={`平均との差 ${formatDelta(
                      snapshot.avgMonthlyExpense,
                      benchmark?.avg_monthly_expense ?? null,
                      "円",
                    )}`}
                  />
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
                <div className="text-[12px] font-semibold text-zinc-500">同セグメントの傾向</div>
                <div className="mt-2 text-sm font-semibold tracking-tight text-zinc-100">
                  戦友たちが最近手に入れている装備
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <TrendCard label="毒消し" value={benchmark?.poison_completed ?? 0} />
                  <TrendCard label="ドーピング" value={benchmark?.doping_completed ?? 0} />
                  <TrendCard label="盾" value={benchmark?.shield_completed ?? 0} />
                </div>

                <div className="mt-5 rounded-3xl border border-white/10 bg-zinc-950 p-4 text-[13px] leading-6 text-zinc-300">
                  平均より支出が重いなら固定費の止血を、平均より生存日数が短いならクエストで装備を増やすのが近道です。
                </div>

                <div className="mt-4">
                  <Link
                    href={strategyLink(snapshot, benchmark)}
                    className="inline-flex rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] font-semibold text-zinc-100 hover:border-white/20"
                  >
                    この差を埋める →
                  </Link>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
              <div className="text-[12px] font-semibold text-zinc-500">戦友の行動ログ</div>
              <div className="mt-2 text-sm font-semibold tracking-tight text-zinc-100">
                同じセグメントで今起きていること
              </div>
              <p className="mt-2 text-[13px] leading-6 text-zinc-400">
                誰かが先に動いた瞬間を、匿名のままリアルタイムで流します。
              </p>

              <div className="mt-5">
                <RealtimeBattleFeed
                  initialItems={initialFeed}
                  ageGroup={profile.age_group}
                  incomeBand={profile.income_band}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string;
  subtext: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-950 p-5">
      <div className="text-[12px] font-semibold text-zinc-500">{label}</div>
      <div className="mt-2 text-xl font-semibold tabular-nums text-zinc-100">{value}</div>
      <div className="mt-2 text-[12px] text-zinc-500">{subtext}</div>
    </div>
  );
}

function TrendCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-950 p-5">
      <div className="text-[12px] font-semibold text-zinc-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-zinc-100">
        {value.toLocaleString()}
      </div>
      <div className="mt-2 text-[12px] text-zinc-500">完了ログ</div>
    </div>
  );
}

