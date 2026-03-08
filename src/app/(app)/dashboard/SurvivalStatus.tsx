"use client";

import { motion } from "framer-motion";
import type { Transaction } from "./types";
import { BuddyAvatar, wealthFromSavings, type BuddyGear, type BuddyRisk } from "@/components/buddy/BuddyAvatar";

function formatDays(days: number | null) {
  if (days === null) return "—";
  if (!Number.isFinite(days)) return "∞";
  return `${days.toLocaleString()} 日`;
}

function buddyState(survivalDays: number | null) {
  if (survivalDays === null) return "unknown" as const;
  if (!Number.isFinite(survivalDays)) return "safe" as const;
  if (survivalDays <= 7) return "danger" as const;
  if (survivalDays <= 21) return "warn" as const;
  return "safe" as const;
}

function calcShrinkHours(amount: number, avgMonthlyExpense: number | null) {
  if (!avgMonthlyExpense || avgMonthlyExpense <= 0) return null;
  const daily = avgMonthlyExpense / 30;
  const hours = (amount / daily) * 24;
  if (!Number.isFinite(hours)) return null;
  return Math.round(hours);
}

export function SurvivalStatus({
  survivalDays,
  savings,
  avgMonthlyExpense,
  monthlySurplus,
  buddyLevel,
  buddyGear,
  recentExpenses,
}: {
  survivalDays: number | null;
  savings: number;
  avgMonthlyExpense: number | null;
  monthlySurplus: number | null;
  buddyLevel: number;
  buddyGear?: BuddyGear;
  recentExpenses: Transaction[];
}) {
  const state = buddyState(survivalDays);
  const risk = state as BuddyRisk;
  const wealth = wealthFromSavings(savings);

  const shake =
    state === "danger"
      ? {
          rotate: [0, -1.5, 1.5, -1.2, 1.2, 0],
          x: [0, -1, 1, -1, 1, 0],
        }
      : undefined;

  const aura =
    state === "safe"
      ? "shadow-[0_0_0_1px_rgba(16,185,129,0.18),0_20px_80px_rgba(0,0,0,0.45)]"
      : state === "warn"
        ? "shadow-[0_0_0_1px_rgba(255,255,255,0.10),0_20px_80px_rgba(0,0,0,0.45)]"
        : "shadow-[0_0_0_1px_rgba(220,20,60,0.25),0_20px_80px_rgba(0,0,0,0.55)]";

  const bigDays =
    survivalDays === null
      ? "—"
      : Number.isFinite(survivalDays)
        ? `${survivalDays.toLocaleString()}`
        : "∞";

  const formula =
    avgMonthlyExpense && avgMonthlyExpense > 0
      ? `（すぐ使えるお金 ÷ 平均月間支出）`
      : `（平均月間支出が未確定）`;

  const riskLabel =
    state === "danger" ? "危機" : state === "warn" ? "注意" : "安定";

  const riskColor =
    state === "danger"
      ? "text-[color:var(--app-crimson)]"
      : state === "warn"
        ? "text-zinc-200"
        : "text-[color:var(--app-emerald)]";

  return (
    <div className="grid gap-5">
      <div className={`rounded-[28px] border border-white/10 bg-zinc-950 p-7 ${aura}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[13px] font-semibold tracking-tight text-zinc-200">
              支出
            </div>
            <div className="mt-2 flex items-center gap-2 text-[13px] text-zinc-400">
              <span className={`font-semibold ${riskColor}`}>{riskLabel}</span>
              <span className="text-zinc-600">/</span>
              <span className="truncate">Survival &amp; Growth</span>
            </div>
          </div>

          <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[12px] text-zinc-300">
            バディ Lv.{buddyLevel}
          </div>
        </div>

        <div className="mt-7 grid items-center gap-6 lg:grid-cols-[1fr,240px]">
          <div>
            <div className="text-[12px] font-semibold text-zinc-400">
              生存可能日数
            </div>

            <div className="mt-2 flex items-end gap-3">
              <div className="text-6xl font-semibold leading-none tracking-tight tabular-nums text-zinc-50">
                あと {bigDays} 日
              </div>
            </div>

            <div className="mt-3 text-[13px] leading-6 text-zinc-400">
              {formula}
              <span className="ml-2 text-zinc-600">
                {avgMonthlyExpense && avgMonthlyExpense > 0
                  ? `= ${formatDays(survivalDays)}`
                  : ""}
              </span>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Metric
                label="今月の余力"
                value={
                  monthlySurplus === null
                    ? "—"
                    : `${Math.round(monthlySurplus).toLocaleString()}`
                }
                unit="円"
                accent={
                  monthlySurplus !== null && monthlySurplus < 0
                    ? "crimson"
                    : "emerald"
                }
              />
              <Metric
                label="バディレベル"
                value={`${buddyLevel}`}
                unit="Lv"
                accent={state === "danger" ? "crimson" : "emerald"}
              />
            </div>
          </div>

          <motion.div
            animate={shake}
            transition={
              state === "danger"
                ? { duration: 0.6, repeat: Infinity, repeatDelay: 1.4 }
                : { duration: 0.2 }
            }
            className="relative mx-auto flex h-[220px] w-[220px] items-center justify-center"
          >
            <BuddyAvatar risk={risk} wealth={wealth} gear={buddyGear} className="h-[220px] w-[220px]" />
          </motion.div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-sm shadow-black/30">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-sm font-semibold tracking-tight">
              危機アラート
            </div>
            <div className="mt-2 text-[13px] text-zinc-400">
              小さな支出でも寿命を削ります（“気づき”を短文で）。
            </div>
          </div>
        </div>

        <ul className="mt-5 grid gap-2">
          {recentExpenses.length === 0 ? (
            <li className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-[13px] text-zinc-400">
              まだ支出ログがありません。
            </li>
          ) : (
            recentExpenses.slice(0, 3).map((tx) => {
              const hours = calcShrinkHours(tx.amount, avgMonthlyExpense);
              const label = tx.note?.trim() ? tx.note.trim() : "支出";
              const msg =
                hours === null
                  ? `「${label}」で寿命が削れました`
                  : `「${label}」で寿命が ${hours} 時間縮まりました`;

              return (
                <li
                  key={tx.id}
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-[color:var(--app-crimson)]">
                        {msg}
                      </div>
                      <div className="mt-1 text-[12px] text-zinc-500">
                        {new Date(tx.created_at).toLocaleString()} / -
                        {Math.round(tx.amount).toLocaleString()}円
                      </div>
                    </div>
                    <div className="shrink-0 rounded-full border border-white/10 bg-[color:var(--app-crimson)]/15 px-2 py-1 text-[12px] font-semibold text-[color:var(--app-crimson)]">
                      警告
                    </div>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit: string;
  accent?: "crimson" | "emerald";
}) {
  const accentClass =
    accent === "crimson"
      ? "text-[color:var(--app-crimson)]"
      : accent === "emerald"
        ? "text-[color:var(--app-emerald)]"
        : "text-zinc-50";

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
      <div className="text-[12px] font-semibold text-zinc-400">{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className={`text-2xl font-semibold tabular-nums ${accentClass}`}>
          {value}
        </div>
        <div className="text-[12px] font-semibold text-zinc-500">{unit}</div>
      </div>
    </div>
  );
}

