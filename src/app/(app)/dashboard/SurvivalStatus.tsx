"use client";

import { motion } from "framer-motion";
import type { FinanceSnapshot } from "@/lib/finance/insights";
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

function buildPriorityMessage(snapshot: FinanceSnapshot) {
  if (snapshot.transactionCount === 0) {
    return {
      title: "最初の3件を記録する",
      body: "収入か支出を3件ほど入れると、危険度や改善候補がかなり具体的になります。",
      tone: "neutral" as const,
    };
  }

  if (snapshot.monthlySurplus !== null && snapshot.monthlySurplus < 0) {
    const recurring = snapshot.recurringExpenseCandidates[0];
    if (recurring) {
      return {
        title: `固定費候補「${recurring.label}」を見直す`,
        body: `${recurring.count}回出ている支出です。まずは平均 ${Math.round(recurring.averageAmount).toLocaleString()}円の固定化を疑うと、今月の余力を戻しやすいです。`,
        tone: "danger" as const,
      };
    }
  }

  const hotspot = snapshot.smallExpenseHotspots[0];
  if (hotspot) {
    return {
      title: `小口支出「${hotspot.label}」を止血する`,
      body: `${hotspot.count}回の積み重ねが効いています。1回の金額は小さくても、頻度を半分にするだけで体感が変わります。`,
      tone: "warn" as const,
    };
  }

  const highExpense = snapshot.highExpenseItems[0];
  if (highExpense) {
    return {
      title: `高額支出「${highExpense.label}」の再発防止`,
      body: `${Math.round(highExpense.amount).toLocaleString()}円クラスの支出は1回で重く効きます。次回条件を先に決めると安定しやすいです。`,
      tone: "warn" as const,
    };
  }

  return {
    title: "記録を続けて精度を上げる",
    body: "支出名が揃ってくるほど、固定費候補や削減ポイントを具体的に提案できるようになります。",
    tone: "neutral" as const,
  };
}

export function SurvivalStatus({
  snapshot,
  buddyLevel,
  buddyGear,
}: {
  snapshot: FinanceSnapshot;
  buddyLevel: number;
  buddyGear?: BuddyGear;
}) {
  const { survivalDays, savings, avgMonthlyExpense, monthlySurplus } = snapshot;
  const state = buddyState(survivalDays);
  const risk = state as BuddyRisk;
  const wealth = wealthFromSavings(savings);
  const priority = buildPriorityMessage(snapshot);

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
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="生存可能日数"
          value={survivalDays === null ? "—" : Number.isFinite(survivalDays) ? `${survivalDays}` : "∞"}
          unit="日"
          accent={state === "danger" ? "crimson" : "emerald"}
          helper={riskLabel}
        />
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
        <MetricCard
          label="平均月間支出"
          value={avgMonthlyExpense === null ? "—" : `${Math.round(avgMonthlyExpense).toLocaleString()}`}
          unit="円"
          helper={avgMonthlyExpense === null ? "直近90日不足" : "直近90日から推定"}
        />
      </div>

      <div className={`rounded-[28px] border border-white/10 bg-zinc-950 p-7 ${aura}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[13px] font-semibold tracking-tight text-zinc-200">
              状況サマリー
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

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-[12px] font-semibold text-zinc-500">次にやる1アクション</div>
              <div className="mt-2 text-[15px] font-semibold text-zinc-50">{priority.title}</div>
              <p className="mt-2 text-[13px] leading-6 text-zinc-400">{priority.body}</p>
              <div
                className={[
                  "mt-3 inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold",
                  priority.tone === "danger"
                    ? "bg-(--app-crimson)/15 text-(--app-crimson)"
                    : priority.tone === "warn"
                      ? "bg-white/10 text-zinc-100"
                      : "bg-(--app-emerald)/15 text-(--app-emerald)",
                ].join(" ")}
              >
                {priority.tone === "danger"
                  ? "最優先"
                  : priority.tone === "warn"
                    ? "優先度高"
                    : "まずはここから"}
              </div>
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

