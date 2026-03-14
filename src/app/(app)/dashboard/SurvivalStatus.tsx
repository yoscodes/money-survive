"use client";

import { motion } from "framer-motion";
import { type FinanceSnapshot } from "@/lib/finance/insights";
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

function formatHoursSince(hours: number | null) {
  if (hours === null) return null;
  if (hours >= 24) return `${Math.floor(hours / 24)}日`;
  if (hours >= 1) return `${hours}時間`;
  return "1時間未満";
}

export function SurvivalStatus({
  snapshot,
  buddyGear,
}: {
  snapshot: FinanceSnapshot;
  buddyGear?: BuddyGear;
}) {
  const { survivalDays, savings, avgMonthlyExpense, monthlySurplus } = snapshot;
  const state = buddyState(survivalDays);
  const risk = state as BuddyRisk;
  const wealth = wealthFromSavings(savings);
  const stamina = snapshot.buddyStamina;
  const lastLoggedLabel = formatHoursSince(snapshot.hoursSinceLastTransaction);

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
  const hungerLabel =
    stamina === null
      ? "未記録"
      : stamina <= 20
        ? "空腹"
        : stamina <= 50
          ? "消耗中"
          : stamina <= 80
            ? "やや空腹"
            : "元気";

  return (
    <div className={`rounded-[28px] border border-white/10 bg-zinc-950 p-7 ${aura}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[13px] font-semibold tracking-tight text-zinc-200">
              Result
            </div>
            <div className="mt-2 flex items-center gap-2 text-[13px] text-zinc-400">
              <span className={`font-semibold ${riskColor}`}>{riskLabel}</span>
              <span className="text-zinc-600">/</span>
              <span className="truncate">Survival &amp; Growth</span>
            </div>
          </div>

          <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[12px] text-zinc-300">
            いまの危機度
          </div>
        </div>

        <div className="mt-7 grid items-center gap-6 lg:grid-cols-[1fr,240px]">
          <div>
            <div className="text-[12px] font-semibold text-zinc-400">生存可能日数</div>

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
              <MetricCard
                label="今月の余力"
                value={monthlySurplus === null ? "—" : `${Math.round(monthlySurplus).toLocaleString()}`}
                unit="円"
                accent={monthlySurplus !== null && monthlySurplus < 0 ? "crimson" : "emerald"}
                helper={monthlySurplus === null ? "今月データ不足" : monthlySurplus < 0 ? "赤字" : "黒字"}
              />
              <MetricCard
                label="総貯蓄"
                value={`${Math.round(savings).toLocaleString()}`}
                unit="円"
                accent={savings < 0 ? "crimson" : "emerald"}
                helper={savings < 0 ? "要改善" : "使える残高"}
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
        <div className="mt-6 flex flex-wrap items-center gap-3 text-[12px] text-zinc-500">
          <span>平均月間支出: {avgMonthlyExpense === null ? "—" : `${Math.round(avgMonthlyExpense).toLocaleString()}円`}</span>
          <span className="text-zinc-700">/</span>
          <span>
            最終記録: {lastLoggedLabel ? `${lastLoggedLabel}前` : "未記録"}
          </span>
          <span className="text-zinc-700">/</span>
          <span>バディ状態: {hungerLabel}</span>
        </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  unit,
  helper,
  accent,
}: {
  label: string;
  value: string;
  unit: string;
  helper: string;
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
      <div className="mt-2 text-[12px] text-zinc-500">{helper}</div>
    </div>
  );
}

