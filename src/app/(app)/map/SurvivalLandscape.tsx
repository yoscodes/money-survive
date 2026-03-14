"use client";

import { useMemo, useState } from "react";
import { BuddyAvatar, wealthFromSavings, type BuddyRisk } from "@/components/buddy/BuddyAvatar";
import type { SegmentMapPoint, SegmentMapView } from "@/lib/social/segment";

function riskFromSurvivalDays(survivalDays: number): BuddyRisk {
  if (!Number.isFinite(survivalDays)) return "unknown";
  if (survivalDays <= 7) return "danger";
  if (survivalDays <= 21) return "warn";
  return "safe";
}

function formatSurplus(value: number | null) {
  if (value === null) return "—";
  const rounded = Math.round(value);
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded.toLocaleString()}円`;
}

function normalizePoints(points: SegmentMapPoint[]) {
  const xValues = points.map((point) => point.survivalDays);
  const yValues = points.map((point) => point.monthlySurplus);
  const maxX = Math.max(30, ...xValues, 1);
  const minY = Math.min(-30000, ...yValues, 0);
  const maxY = Math.max(30000, ...yValues, 1);
  const yRange = Math.max(1, maxY - minY);

  return points.map((point) => ({
    ...point,
    x: (point.survivalDays / maxX) * 100,
    y: ((point.monthlySurplus - minY) / yRange) * 100,
  }));
}

export function SurvivalLandscape({ mapViews }: { mapViews: SegmentMapView[] }) {
  const visibleViews = useMemo(() => {
    if (mapViews.length <= 2) return mapViews;
    const current = mapViews.find((view) => view.id === "current") ?? mapViews[0];
    const nextView =
      mapViews.find((view) => view.id === "expense-cut") ??
      mapViews.find((view) => view.id !== current.id) ??
      current;
    return current.id === nextView.id ? [current] : [current, nextView];
  }, [mapViews]);
  const [selectedId, setSelectedId] = useState(visibleViews[0]?.id ?? "");
  const selectedView = visibleViews.find((view) => view.id === selectedId) ?? visibleViews[0];

  const { myPoint, visiblePoints } = useMemo(() => {
    if (!selectedView) {
      return {
        myPoint: null as (SegmentMapPoint & { x: number; y: number }) | null,
        visiblePoints: [] as Array<SegmentMapPoint & { x: number; y: number }>,
      };
    }

    const normalized = normalizePoints(selectedView.points);
    const self = normalized.find((point) => point.isSelf) ?? null;
    const visibleRankBorder =
      self?.rank && self.rank > 0 ? Math.max(1, self.rank - 3) : null;
    const visible = normalized.filter(
      (point) => point.isSelf || visibleRankBorder === null || (point.rank ?? Infinity) >= visibleRankBorder,
    );

    return { myPoint: self, visiblePoints: visible };
  }, [selectedView]);

  if (!selectedView) return null;

  return (
    <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[12px] font-semibold text-zinc-500">サバイバル・マップ</div>
          <div className="mt-2 text-sm font-semibold tracking-tight text-zinc-100">
            今いる場所と、次に狙う景色
          </div>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-zinc-400">
            横軸は生存日数、縦軸は月間余力です。まずは今の位置を見て、次にどこへ動くかだけ分かるようにしています。
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {visibleViews.map((view) => (
            <button
              key={view.id}
              type="button"
              onClick={() => setSelectedId(view.id)}
              className={`rounded-xl border px-3 py-2 text-[12px] font-semibold transition ${
                view.id === selectedView.id
                  ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                  : "border-white/10 bg-zinc-950 text-zinc-300 hover:border-white/20"
              }`}
            >
              {view.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-[28px] border border-white/10 bg-zinc-950/80 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[13px] font-semibold text-zinc-100">{selectedView.label}</div>
            <div className="mt-1 text-[12px] leading-5 text-zinc-400">{selectedView.description}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[12px] text-zinc-300">
            少し先に {selectedView.hiddenCount.toLocaleString()} 人
          </div>
        </div>

        <div className="relative mt-4 h-[360px] overflow-hidden rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_bottom_left,rgba(220,20,60,0.22),transparent_38%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.18),transparent_36%),linear-gradient(180deg,rgba(24,24,27,0.96),rgba(10,10,12,0.98))]">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_top,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:20%_20%]" />
          <div className="absolute bottom-3 left-4 text-[11px] font-semibold tracking-[0.24em] text-zinc-600">
            荒野
          </div>
          <div className="absolute bottom-3 right-4 text-[11px] font-semibold tracking-[0.24em] text-zinc-600">
            楽園
          </div>
          <div className="absolute left-4 top-4 text-[11px] font-semibold tracking-[0.24em] text-zinc-600">
            稼ぐ力
          </div>
          <div className="absolute bottom-14 right-4 text-[11px] font-semibold tracking-[0.24em] text-zinc-600">
            守る力
          </div>

          {visiblePoints.map((point) => {
            const isSelf = point.isSelf;
            return (
              <div
                key={point.id}
                className="absolute -translate-x-1/2 translate-y-1/2"
                style={{ left: `${point.x}%`, bottom: `${point.y}%` }}
              >
                {isSelf ? (
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-emerald-400/20 blur-xl" />
                    <div className="relative rounded-full border border-emerald-300/40 bg-zinc-950/90 p-1 shadow-[0_0_24px_rgba(16,185,129,0.32)]">
                      <BuddyAvatar
                        risk={riskFromSurvivalDays(point.survivalDays)}
                        wealth={wealthFromSavings(point.savings)}
                        className="h-10 w-10"
                      />
                    </div>
                    <div className="mt-2 rounded-full border border-white/10 bg-black/70 px-2 py-1 text-center text-[10px] font-semibold text-zinc-200">
                      YOU
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <div
                      className={`h-3.5 w-3.5 rounded-full border ${
                        point.monthlySurplus >= 0
                          ? "border-emerald-300/40 bg-emerald-400/60"
                          : "border-red-300/40 bg-red-400/50"
                      }`}
                    />
                    <div className="mt-2 rounded-full border border-white/10 bg-black/70 px-2 py-1 text-center text-[10px] text-zinc-300">
                      {point.label}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <div className="absolute right-0 top-0 h-[58%] w-[44%] bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),rgba(10,10,12,0.78)_55%,rgba(10,10,12,0.96))] backdrop-blur-[2px]" />
          <div className="absolute right-5 top-5 rounded-2xl border border-white/10 bg-black/45 px-3 py-2 text-right text-[11px] leading-5 text-zinc-300">
            今は少し先の戦友だけを表示
            <br />
            次に抜く相手が見える設計です
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <StatChip label="平均生存日数" value={selectedView.avgSurvivalDays === null ? "—" : `${Math.round(selectedView.avgSurvivalDays)}日`} />
          <StatChip label="平均月間余力" value={formatSurplus(selectedView.avgMonthlySurplus)} />
          <StatChip
            label="最短導線"
            value={selectedView.topQuestTitle ? `次は ${selectedView.topQuestTitle}` : selectedView.ctaLabel}
          />
        </div>

        {myPoint ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-4 text-[13px] leading-6 text-zinc-300">
            あなたは現在 <span className="font-semibold text-zinc-100">{myPoint.survivalDays}日</span> の守る力と
            <span className="font-semibold text-zinc-100"> {formatSurplus(myPoint.monthlySurplus)}</span> の月間余力にいます。
            {selectedView.isProjection
              ? " 固定費を削ると、同じ景色の中で自分だけが一歩右上へ動きます。"
              : " まずは一番近い戦友を1人抜くことに集中すれば十分です。"}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
      <div className="text-[11px] font-semibold text-zinc-500">{label}</div>
      <div className="mt-2 text-[14px] font-semibold text-zinc-100">{value}</div>
    </div>
  );
}
