"use client";

import Link from "next/link";
import { BuddyAvatar, wealthFromSavings, type BuddyRisk } from "@/components/buddy/BuddyAvatar";
import { RealtimeBattleFeed } from "./RealtimeBattleFeed";
import { SurvivalLandscape } from "./SurvivalLandscape";
import type { FinanceSnapshot } from "@/lib/finance/insights";
import {
  formatDelta,
  segmentLabel,
  type BattleFeedItem,
  type SegmentBenchmark,
  type SegmentMapView,
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

function supportMessage(snapshot: FinanceSnapshot, benchmark: SegmentBenchmark | null) {
  if (!benchmark) {
    return "最初の一歩を選べば、荒野の景色はすぐに変わり始めます。";
  }

  const rank = benchmark.my_rank ?? benchmark.segment_size;
  const lowerHalf =
    benchmark.segment_size > 0 && rank !== null && rank > Math.ceil(benchmark.segment_size * 0.6);

  if (lowerHalf && (snapshot.monthlySurplus ?? 0) > 0) {
    return "順位はまだ下でも、今月が黒字なら伸びしろは大きいです。止血か副収入の一手で景色が変わります。";
  }

  if (
    lowerHalf &&
    snapshot.avgMonthlyExpense !== null &&
    benchmark.avg_monthly_expense !== null &&
    snapshot.avgMonthlyExpense <= benchmark.avg_monthly_expense
  ) {
    return "今の順位よりも、支出コントロールは平均以上です。守りの筋が良いので、次は一段だけ右上を狙えます。";
  }

  if (
    snapshot.survivalDays !== null &&
    benchmark.avg_survival_days !== null &&
    snapshot.survivalDays >= benchmark.avg_survival_days
  ) {
    return "守る力はもう平均圏です。次は月間余力を少し押し上げて、楽園側へ寄せる局面です。";
  }

  return "今は少し上の戦友を1人だけ抜くことに集中すると、マップの霧が一気に晴れやすくなります。";
}

export function RivalBenchmark({
  profile,
  benchmark,
  rpcError,
  snapshot,
  initialFeed,
  mapViews,
  recommendedQuestTitle,
  demoMode,
}: {
  profile: UserProfile | null;
  benchmark: SegmentBenchmark | null;
  rpcError: string | null;
  snapshot: FinanceSnapshot;
  initialFeed: BattleFeedItem[];
  mapViews: SegmentMapView[];
  recommendedQuestTitle: string | null;
  demoMode: boolean;
}) {
  const risk = riskFromSurvivalDays(snapshot.survivalDays);
  const wealth = wealthFromSavings(snapshot.savings);
  const segmentName = profile ? segmentLabel(profile) : null;
  const enoughSegmentData = (benchmark?.segment_size ?? 0) >= 3;
  const canRenderBenchmark = Boolean(benchmark) && enoughSegmentData;
  const primaryHref = recommendedQuestTitle ? "/quests" : strategyLink(snapshot, benchmark);
  const primaryCta = recommendedQuestTitle ? `「${recommendedQuestTitle}」を見る` : "次の一手を見る";

  return (
    <div className="grid gap-5">
      <div className="rounded-[28px] border border-white/10 bg-zinc-950 p-7 shadow-sm shadow-black/30">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-semibold tracking-tight">近しい境遇の匿名セグメント</div>
            <p className="mt-2 max-w-2xl text-[13px] leading-6 text-zinc-400">
              同じ年代・年収帯の匿名集計を、サバイバルマップとして見せます。少し先を行く戦友の成功と、
              自分が右上へ進む未来をひと目で掴める構成です。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {demoMode ? (
              <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-[13px] font-semibold text-emerald-200">
                demo=1
              </div>
            ) : null}
            <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-[13px] text-zinc-200">
              {segmentName ?? "プロフィール未設定"}
            </div>
          </div>
        </div>

        {!profile ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-(--app-crimson)/10 p-5 text-[13px] leading-6 text-zinc-200">
            比較に使うプロフィールが未設定です。今後の新規登録では年代・年収帯を保存します。既存ユーザーは
            `user_profiles` に自分の属性を追加するとこの画面が使えます。
          </div>
        ) : (
          <div className="mt-6 grid gap-5">
            {mapViews.length > 0 ? <SurvivalLandscape mapViews={mapViews} /> : null}

            {rpcError ? (
              <div className="rounded-3xl border border-white/10 bg-(--app-crimson)/10 p-5 text-[13px] leading-6 text-zinc-200">
                セグメント集計の一部取得に失敗しました。マップ表示は継続していますが、順位と平均との差は不完全な可能性があります。
                <pre className="mt-3 overflow-auto rounded-2xl bg-black/40 p-3 text-[12px] leading-5 text-zinc-300">
                  {rpcError}
                </pre>
              </div>
            ) : null}

            {!enoughSegmentData ? (
              <div className="rounded-3xl border border-white/10 bg-black/30 p-5 text-[13px] leading-6 text-zinc-300">
                同じセグメントの人数がまだ少ないため、順位比較は控えめ表示です。マップで景色を確認しつつ、
                次のクエスト導線から最初の一歩を選べます。
              </div>
            ) : null}

            <div className="grid gap-5 lg:grid-cols-[1.1fr,0.9fr]">
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
                          {canRenderBenchmark ? benchmark?.my_rank : "—"} /{" "}
                          {canRenderBenchmark ? benchmark?.segment_size : "—"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <MetricCard
                      label="生存日数"
                      value={snapshot.survivalDays === null ? "—" : `${snapshot.survivalDays}日`}
                      subtext={
                        canRenderBenchmark
                          ? `平均との差 ${formatDelta(
                              snapshot.survivalDays,
                              benchmark?.avg_survival_days ?? null,
                              "日",
                            )}`
                          : "比較データを待っています"
                      }
                    />
                    <MetricCard
                      label="すぐ使えるお金"
                      value={formatCurrency(snapshot.savings)}
                      subtext={
                        canRenderBenchmark
                          ? `平均との差 ${formatDelta(
                              snapshot.savings,
                              benchmark?.avg_savings ?? null,
                              "円",
                            )}`
                          : "地力をためるフェーズです"
                      }
                    />
                    <MetricCard
                      label="平均月間支出"
                      value={formatCurrency(snapshot.avgMonthlyExpense)}
                      subtext={
                        canRenderBenchmark
                          ? `平均との差 ${formatDelta(
                              snapshot.avgMonthlyExpense,
                              benchmark?.avg_monthly_expense ?? null,
                              "円",
                            )}`
                          : "支出の景色はマップで確認できます"
                      }
                    />
                  </div>

                  <div className="mt-5 rounded-3xl border border-emerald-400/15 bg-emerald-400/5 p-4 text-[13px] leading-6 text-zinc-200">
                    {supportMessage(snapshot, benchmark)}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
                  <div className="text-[12px] font-semibold text-zinc-500">次の一手</div>
                  <div className="mt-2 text-sm font-semibold tracking-tight text-zinc-100">
                    今この画面で決めること
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <ActionCard
                      label="おすすめ"
                      value={recommendedQuestTitle ?? "固定費の止血か装備クエスト"}
                      note="迷ったらまずここから"
                    />
                    <ActionCard
                      label="優先理由"
                      value={
                        snapshot.avgMonthlyExpense !== null &&
                        benchmark?.avg_monthly_expense !== null &&
                        snapshot.avgMonthlyExpense > benchmark.avg_monthly_expense
                          ? "支出が平均より重い"
                          : snapshot.survivalDays !== null &&
                              benchmark?.avg_survival_days !== null &&
                              snapshot.survivalDays < benchmark.avg_survival_days
                            ? "生存日数が平均より短い"
                            : "今の勢いを維持したい"
                      }
                      note="最短で右上に寄る判断"
                    />
                  </div>

                  <div className="mt-5 rounded-3xl border border-white/10 bg-zinc-950 p-4 text-[13px] leading-6 text-zinc-300">
                    {recommendedQuestTitle
                      ? `同セグメントでいちばん動かれているのは「${recommendedQuestTitle}」です。`
                      : "平均より支出が重いなら固定費の止血を、平均より生存日数が短いならクエスト強化が近道です。"}
                  </div>

                  <div className="mt-4">
                    <Link
                      href={primaryHref}
                      className="inline-flex rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] font-semibold text-zinc-100 hover:border-white/20"
                    >
                      {primaryCta}
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
                  誰かが先に動いた瞬間を、匿名のまま流します。ここでは「何をして、何日伸びたか」だけに絞って見せます。
                </p>

                <div className="mt-5">
                  <RealtimeBattleFeed
                    initialItems={initialFeed}
                    ageGroup={profile.age_group}
                    incomeBand={profile.income_band}
                    currentUserId={profile.user_id}
                  />
                </div>
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

function ActionCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-950 p-5">
      <div className="text-[12px] font-semibold text-zinc-500">{label}</div>
      <div className="mt-2 text-[15px] font-semibold text-zinc-100">{value}</div>
      <div className="mt-2 text-[12px] text-zinc-500">{note}</div>
    </div>
  );
}

