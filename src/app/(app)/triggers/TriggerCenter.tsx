"use client";

import { motion } from "framer-motion";
import { useMemo, useState, type ReactNode } from "react";
import { PrimaryButton, SubtleButton } from "@/components/ui";
import { SolutionLinkCard } from "@/components/monetization/SolutionLinkCard";
import { ProfessionalAdviceCard } from "@/components/monetization/ProfessionalAdviceCard";
import type { SolutionLink } from "@/lib/monetization/solutions";

function calcSurvivalDays(savings: number, avgMonthlyExpense: number | null) {
  if (!avgMonthlyExpense || avgMonthlyExpense <= 0) return null;
  const s = Math.max(0, savings);
  return Math.max(0, Math.floor((s / avgMonthlyExpense) * 30));
}

function deltaDaysLabel(delta: number | null) {
  if (delta === null) return "—";
  if (delta === 0) return "+0日";
  return delta > 0 ? `+${delta}日` : `${delta}日`;
}

export function TriggerCenter({
  savings,
  avgMonthlyExpense,
  initialCutFixed,
  initialBoostIncome,
  poisonLinks,
  dopingLinks,
  shieldLinks,
  fpBookingUrl,
  solutionError,
}: {
  savings: number;
  avgMonthlyExpense: number | null;
  initialCutFixed?: number;
  initialBoostIncome?: number;
  poisonLinks: SolutionLink[];
  dopingLinks: SolutionLink[];
  shieldLinks: SolutionLink[];
  fpBookingUrl: string | null;
  solutionError: string | null;
}) {
  const baseDays = useMemo(
    () => calcSurvivalDays(savings, avgMonthlyExpense),
    [savings, avgMonthlyExpense],
  );

  const [cutFixed, setCutFixed] = useState(() => initialCutFixed ?? 3000);
  const [boostIncome, setBoostIncome] = useState(() => initialBoostIncome ?? 5000);

  const afterCutDays = useMemo(() => {
    if (!avgMonthlyExpense) return null;
    return calcSurvivalDays(savings, Math.max(1, avgMonthlyExpense - cutFixed));
  }, [avgMonthlyExpense, cutFixed, savings]);

  const afterBoostDays = useMemo(() => {
    return calcSurvivalDays(savings + boostIncome, avgMonthlyExpense);
  }, [avgMonthlyExpense, boostIncome, savings]);

  const deltaCut =
    baseDays === null || afterCutDays === null ? null : afterCutDays - baseDays;
  const deltaBoost =
    baseDays === null || afterBoostDays === null ? null : afterBoostDays - baseDays;

  const avgLabel =
    avgMonthlyExpense === null
      ? "—"
      : `${Math.round(avgMonthlyExpense).toLocaleString()}円/月`;

  return (
    <div className="grid gap-5">
      <div className="rounded-[28px] border border-white/10 bg-zinc-950 p-7 shadow-sm shadow-black/30">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold tracking-tight">
              トリガー・センター
            </div>
            <p className="mt-2 max-w-2xl text-[13px] leading-6 text-zinc-400">
              危機回避の“武器屋”。やることを3つに絞って、実行前に「生存日数 +何日」をプレビューします。
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
            <div className="text-[12px] font-semibold text-zinc-500">
              平均月間支出
            </div>
            <div className="mt-1 text-sm font-semibold tabular-nums text-zinc-100">
              {avgLabel}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          <ActionCard
            title="毒消し（固定費削減）"
            subtitle="不要な固定費を1つ消す"
            accent="emerald"
            deltaLabel={deltaDaysLabel(deltaCut)}
          >
            <div className="grid gap-2">
              <div className="flex items-center justify-between text-[12px] text-zinc-500">
                <span>削減額（/月）</span>
                <span className="font-semibold tabular-nums text-zinc-200">
                  {cutFixed.toLocaleString()}円
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={30000}
                step={500}
                value={cutFixed}
                onChange={(e) => setCutFixed(Number(e.target.value))}
                className="w-full accent-(--app-emerald)"
              />

              <div className="mt-2 flex gap-2">
                <SubtleButton
                  type="button"
                  className="h-10 px-3 text-[13px]"
                  onClick={() => setCutFixed(0)}
                >
                  リセット
                </SubtleButton>
                {poisonLinks[0] ? (
                  <a
                    href={poisonLinks[0].url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-(--app-emerald) px-3 text-[13px] font-semibold text-black shadow-sm shadow-black/30"
                  >
                    {poisonLinks[0].cta_label?.trim() || "サブスク整理へ"}
                  </a>
                ) : (
                  <PrimaryButton type="button" disabled className="h-10 px-3 text-[13px]">
                    準備中
                  </PrimaryButton>
                )}
              </div>

              {poisonLinks.slice(1, 2).map((link) => (
                <SolutionLinkCard key={link.id} link={link} compact />
              ))}
            </div>
          </ActionCard>

          <ActionCard
            title="ドーピング（副業・ポイ活）"
            subtitle="稼ぐ力を少し足す"
            accent="emerald"
            deltaLabel={deltaDaysLabel(deltaBoost)}
          >
            <div className="grid gap-2">
              <div className="flex items-center justify-between text-[12px] text-zinc-500">
                <span>収入 +（/月）</span>
                <span className="font-semibold tabular-nums text-zinc-200">
                  {boostIncome.toLocaleString()}円
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={60000}
                step={1000}
                value={boostIncome}
                onChange={(e) => setBoostIncome(Number(e.target.value))}
                className="w-full accent-(--app-emerald)"
              />

              <div className="mt-2 flex gap-2">
                <SubtleButton
                  type="button"
                  className="h-10 px-3 text-[13px]"
                  onClick={() => setBoostIncome(0)}
                >
                  リセット
                </SubtleButton>
                {dopingLinks[0] ? (
                  <a
                    href={dopingLinks[0].url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-(--app-emerald) px-3 text-[13px] font-semibold text-black shadow-sm shadow-black/30"
                  >
                    {dopingLinks[0].cta_label?.trim() || "案件を見る"}
                  </a>
                ) : (
                  <PrimaryButton type="button" disabled className="h-10 px-3 text-[13px]">
                    準備中
                  </PrimaryButton>
                )}
              </div>

              {dopingLinks.slice(1, 2).map((link) => (
                <SolutionLinkCard key={link.id} link={link} compact />
              ))}
            </div>
          </ActionCard>

          <ActionCard
            title="盾（保険・投資）"
            subtitle="不意打ちに備える"
            accent="crimson"
            deltaLabel="(数値より安心)"
          >
            <div className="grid gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-[13px] text-zinc-300">
                「今すぐ増やす」より、まずは“致命傷”を防ぐ。大きい損失を避けると、生存日数は守れます。
              </div>
              <div className="flex gap-2">
                {shieldLinks[0] ? (
                  <a
                    href={shieldLinks[0].url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-(--app-emerald) px-3 text-[13px] font-semibold text-black shadow-sm shadow-black/30"
                  >
                    {shieldLinks[0].cta_label?.trim() || "盾を選ぶ"}
                  </a>
                ) : (
                  <PrimaryButton type="button" disabled className="h-10 px-3 text-[13px]">
                    準備中
                  </PrimaryButton>
                )}
                <SubtleButton type="button" className="h-10 px-3 text-[13px]">
                  後で
                </SubtleButton>
              </div>

              {shieldLinks.slice(1, 2).map((link) => (
                <SolutionLinkCard key={link.id} link={link} compact />
              ))}
            </div>
          </ActionCard>
        </div>

        {solutionError ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-(--app-crimson)/10 p-5 text-[13px] leading-6 text-zinc-200">
            {solutionError}
          </div>
        ) : null}

        <div className="mt-6 rounded-3xl border border-white/10 bg-black/30 p-5">
          <div className="text-[12px] font-semibold text-zinc-500">
            今のあなた（最小情報）
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <MiniStat label="すぐ使えるお金" value={`${Math.round(savings).toLocaleString()}円`} />
            <MiniStat
              label="生存日数"
              value={
                baseDays === null
                  ? "—"
                  : Number.isFinite(baseDays)
                    ? `${baseDays.toLocaleString()}日`
                    : "∞"
              }
            />
            <MiniStat label="やること" value="固定費1つ / 稼ぎ+1つ / 盾1つ" />
          </div>
        </div>

        <ProfessionalAdviceCard href={fpBookingUrl} />
      </div>
    </div>
  );
}

function ActionCard({
  title,
  subtitle,
  deltaLabel,
  accent,
  children,
}: {
  title: string;
  subtitle: string;
  deltaLabel: string;
  accent: "emerald" | "crimson";
  children: ReactNode;
}) {
  const badge =
    accent === "emerald"
      ? "bg-[color:var(--app-emerald)]/15 text-[color:var(--app-emerald)]"
      : "bg-[color:var(--app-crimson)]/15 text-[color:var(--app-crimson)]";

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="rounded-3xl border border-white/10 bg-black/30 p-5 shadow-sm shadow-black/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold tracking-tight text-zinc-100">
            {title}
          </div>
          <div className="mt-2 text-[13px] text-zinc-400">{subtitle}</div>
        </div>
        <div className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold ${badge}`}>
          {deltaLabel}
        </div>
      </div>

      <div className="mt-4">{children}</div>
    </motion.div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3">
      <div className="text-[12px] font-semibold text-zinc-500">{label}</div>
      <div className="mt-1 text-[13px] font-semibold text-zinc-100">{value}</div>
    </div>
  );
}

