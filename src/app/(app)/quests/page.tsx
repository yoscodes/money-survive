import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { QUEST_TEMPLATES, type QuestReward, type QuestTemplate } from "@/lib/quests/templates";
import { startQuest } from "@/app/(app)/quests/actions";
import { AiTriggerSection } from "./AiTriggerSection";
import {
  buildFinanceSnapshot,
  type FinanceTransaction,
} from "@/lib/finance/insights";
import {
  loadSolutionLinks,
  pickFpLink,
  pickSolutionLinks,
} from "@/lib/monetization/solutions";
import { SolutionLinkCard } from "@/components/monetization/SolutionLinkCard";
import { ProfessionalAdviceCard } from "@/components/monetization/ProfessionalAdviceCard";

type UserQuestRow = {
  id: string;
  template_key: string;
  title: string;
  category: string;
  status: "active" | "completed" | "abandoned";
  started_at: string;
  completed_at: string | null;
  reward: unknown;
  ai_trigger_id: string | null;
};

type Tab = "board" | "active" | "completed";

type AiTriggerViewRow = {
  id: string;
  title: string;
  description: string;
  category: "poison" | "doping" | "shield";
  proof_hint: string;
  recommended_cut_fixed: number | null;
  recommended_boost_income: number | null;
  estimated_delta_days: number;
  status: "generated" | "started" | "completed" | "abandoned";
};

function badge(category: string) {
  if (category === "poison") return "毒消し";
  if (category === "doping") return "ドーピング";
  if (category === "shield") return "盾";
  return "クエスト";
}

function asQuestReward(value: unknown): QuestReward {
  if (!value || typeof value !== "object") return {};
  const v = value as { shield?: unknown; armor?: unknown };
  const shield =
    v.shield === "basic" || v.shield === "ironwall" ? v.shield : undefined;
  const armor = typeof v.armor === "boolean" ? v.armor : undefined;
  return { shield, armor };
}

function templateList() {
  return Object.values(QUEST_TEMPLATES) as QuestTemplate[];
}

function categoryLabel(category: string) {
  if (category === "poison") return "毒消し（固定費/小口支出）";
  if (category === "doping") return "ドーピング（稼ぎ）";
  if (category === "shield") return "盾（守り）";
  return "クエスト";
}

export default async function QuestsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const tab = (
    searchParams?.tab === "active"
      ? "active"
      : searchParams?.tab === "completed"
        ? "completed"
        : "board"
  ) as Tab;

  const supabase = await createSupabaseServer();
  const { data: userData } = await supabase.auth.getUser();

  const user = userData.user;
  const { data, error } = await supabase
    .from("user_quests")
    .select("id, template_key, title, category, status, started_at, completed_at, reward, ai_trigger_id")
    .eq("user_id", user?.id ?? "")
    .in("status", ["active", "completed"])
    .order("started_at", { ascending: false })
    .limit(200);

  const items = ((data ?? []) as UserQuestRow[]) ?? [];
  const { data: txData } = await supabase
    .from("transactions")
    .select("id, created_at, type, amount, note")
    .eq("user_id", user?.id ?? "")
    .order("created_at", { ascending: false })
    .limit(240);
  const financeSnapshot = buildFinanceSnapshot(((txData ?? []) as FinanceTransaction[]) ?? []);

  const { data: aiData, error: aiError } = await supabase
    .from("ai_triggers")
    .select(
      "id, title, description, category, proof_hint, recommended_cut_fixed, recommended_boost_income, estimated_delta_days, status",
    )
    .eq("user_id", user?.id ?? "")
    .order("created_at", { ascending: false })
    .limit(6);
  const { links: solutionLinks, error: solutionError } = await loadSolutionLinks(supabase, [
    "quests",
    "fp",
  ]);

  const templates = templateList();
  const total = templates.length;

  const active = items.filter((q) => q.status === "active");
  const completed = items.filter((q) => q.status === "completed");

  const completedKeys = new Set(completed.map((q) => q.template_key));
  const completedCount = completedKeys.size;
  const activeCount = active.length;

  const level = Math.max(1, 1 + Math.floor(completedCount / 2));

  const rewards = completed.map((q) => asQuestReward(q.reward));
  const hasArmor = rewards.some((r) => !!r.armor);
  const shield = rewards.some((r) => r.shield === "ironwall")
    ? "ironwall"
    : rewards.some((r) => r.shield === "basic")
      ? "basic"
      : null;

  const activeByKey = new Map<string, UserQuestRow>();
  for (const q of active) {
    const prev = activeByKey.get(q.template_key);
    if (!prev || new Date(q.started_at) > new Date(prev.started_at)) activeByKey.set(q.template_key, q);
  }

  const completedByKey = new Map<string, UserQuestRow>();
  for (const q of completed) {
    const prev = completedByKey.get(q.template_key);
    const t = q.completed_at ? new Date(q.completed_at).getTime() : 0;
    const p = prev?.completed_at ? new Date(prev.completed_at).getTime() : 0;
    if (!prev || t > p) completedByKey.set(q.template_key, q);
  }

  const grouped = templates.reduce<Record<string, QuestTemplate[]>>((acc, t) => {
    acc[t.category] ??= [];
    acc[t.category]!.push(t);
    return acc;
  }, {});

  const aiDatabaseError = aiError
    ? aiError.message.includes("relation") || aiError.message.includes("ai_triggers")
      ? "AI提案を使うには `ai_triggers` テーブルの追加が必要です。README の SQL を実行してください。"
      : aiError.message
    : null;
  const questByAiTriggerId = new Map<string, UserQuestRow>();
  for (const q of items) {
    if (q.ai_trigger_id) questByAiTriggerId.set(q.ai_trigger_id, q);
  }
  const aiItems = (((aiData ?? []) as AiTriggerViewRow[]) ?? []).slice(0, 3).map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    category: item.category,
    proofHint: item.proof_hint,
    recommendedCutFixed: item.recommended_cut_fixed,
    recommendedBoostIncome: item.recommended_boost_income,
    estimatedDeltaDays: item.estimated_delta_days,
    status: item.status,
    linkedQuestId: questByAiTriggerId.get(item.id)?.id ?? null,
  }));
  const aiGuidance =
    financeSnapshot.expenseCount < 5 || financeSnapshot.avgMonthlyExpense === null
      ? "支出ログが少ないため、まだ診断精度は低めです。まずは支出を5件以上ためると、より個別具体的な提案になりやすいです。"
      : `平均月間支出 ${Math.round(financeSnapshot.avgMonthlyExpense).toLocaleString()}円、推定生存日数 ${
          financeSnapshot.survivalDays === null ? "—" : `${financeSnapshot.survivalDays}日`
        } をもとに、明日から着手できる具体策を提案します。`;
  const questSolutions = [
    ...pickSolutionLinks(solutionLinks, {
      placement: "quests",
      category: "poison",
      subcategory: "subscription",
      limit: 1,
    }),
    ...pickSolutionLinks(solutionLinks, {
      placement: "quests",
      category: "doping",
      subcategory: "side_job",
      limit: 1,
    }),
    ...pickSolutionLinks(solutionLinks, {
      placement: "quests",
      category: "shield",
      subcategory: "insurance",
      limit: 1,
    }),
  ].slice(0, 3);
  const fpLink = pickFpLink(solutionLinks);

  return (
    <div className="grid gap-5">
      <div className="rounded-[28px] border border-white/10 bg-zinc-950 p-7 shadow-sm shadow-black/30">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-semibold tracking-tight">クエストボード</div>
            <p className="mt-2 text-[13px] leading-6 text-zinc-400">
              すべての行動項目を一覧で管理し、達成の証（装備/レベル）で達成感を強調します。
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/quests"
              data-active={tab === "board"}
              className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] font-semibold text-zinc-100 hover:border-white/20 data-[active=true]:bg-white/10"
            >
              ボード
            </Link>
            <Link
              href="/quests?tab=active"
              data-active={tab === "active"}
              className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] font-semibold text-zinc-100 hover:border-white/20 data-[active=true]:bg-white/10"
            >
              進行中
            </Link>
            <Link
              href="/quests?tab=completed"
              data-active={tab === "completed"}
              className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] font-semibold text-zinc-100 hover:border-white/20 data-[active=true]:bg-white/10"
            >
              達成
            </Link>
          </div>
        </div>

        <div className="mt-6">
          {error ? (
            <div className="rounded-3xl border border-white/10 bg-(--app-crimson)/10 p-5 text-[13px] text-zinc-200">
              `user_quests` が未作成の可能性があります。README の SQL を実行してください。
              <pre className="mt-3 overflow-auto rounded-2xl bg-black/40 p-3 text-[12px] leading-5 text-zinc-300">
                {error.message}
              </pre>
            </div>
          ) : tab !== "board" ? (
            <ListView items={tab === "active" ? active : completed} />
          ) : (
            <div className="grid gap-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard label="達成" value={`${completedCount}/${total}`} />
                <StatCard label="進行中" value={`${activeCount}`} />
                <StatCard label="レベル" value={`Lv.${level}`} />
              </div>

              <AiTriggerSection
                items={aiItems}
                guidance={aiGuidance}
                databaseError={aiDatabaseError}
              />

              {solutionError ? (
                <div className="rounded-3xl border border-white/10 bg-(--app-crimson)/10 p-5 text-[13px] leading-6 text-zinc-200">
                  {solutionError}
                </div>
              ) : questSolutions.length > 0 ? (
                <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
                  <div className="text-[12px] font-semibold text-zinc-500">解決策への近道</div>
                  <div className="mt-2 text-sm font-semibold tracking-tight text-zinc-100">
                    クエストを始める前に、現実の選択肢も確認する
                  </div>
                  <div className="mt-5 grid gap-3 lg:grid-cols-3">
                    {questSolutions.map((link) => (
                      <SolutionLinkCard key={link.id} link={link} compact />
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[12px] font-semibold text-zinc-500">
                      バディの装備（達成の証）
                    </div>
                    <div className="mt-2 text-sm font-semibold tracking-tight text-zinc-100">
                      {shield ? `盾: ${shield}` : "盾: なし"} /{" "}
                      {hasArmor ? "鎧: あり" : "鎧: なし"}
                    </div>
                    <div className="mt-2 text-[13px] leading-6 text-zinc-400">
                      ここで積み上げた証拠が、バディの武装として反映されます。
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3">
                    <div className="text-[12px] font-semibold text-zinc-500">
                      進行状況
                    </div>
                    <div className="mt-2 h-2 w-40 overflow-hidden rounded-full border border-white/10 bg-black/40">
                      <div
                        className="h-full bg-(--app-emerald)/60"
                        style={{ width: `${total ? (completedCount / total) * 100 : 0}%` }}
                      />
                    </div>
                    <div className="mt-2 text-[12px] text-zinc-500">
                      次の達成でLvアップ
                    </div>
                  </div>
                </div>
              </div>

              {active.length ? (
                <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
                  <div className="text-[12px] font-semibold text-zinc-500">
                    進行中
                  </div>
                  <div className="mt-2 text-sm font-semibold tracking-tight text-zinc-100">
                    まずは“証明”を提出して装備を獲得
                  </div>
                  <div className="mt-4">
                    <ListView items={active} />
                  </div>
                </div>
              ) : null}

              <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
                <div className="text-[12px] font-semibold text-zinc-500">
                  すべての行動項目
                </div>
                <div className="mt-2 text-sm font-semibold tracking-tight text-zinc-100">
                  1つ選んで開始する
                </div>

                <div className="mt-5 grid gap-6">
                  {(["poison", "doping", "shield"] as const).map((cat) => (
                    <div key={cat}>
                      <div className="text-[12px] font-semibold text-zinc-500">
                        {categoryLabel(cat)}
                      </div>
                      <ul className="mt-3 grid gap-2 lg:grid-cols-2">
                        {(grouped[cat] ?? []).map((t) => {
                          const activeQ = activeByKey.get(t.key) ?? null;
                          const doneQ = completedByKey.get(t.key) ?? null;
                          const status =
                            activeQ?.status === "active"
                              ? "active"
                              : doneQ?.status === "completed"
                                ? "completed"
                                : "new";

                          return (
                            <li
                              key={t.key}
                              className="rounded-3xl border border-white/10 bg-zinc-950 p-5"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[11px] font-semibold text-zinc-300">
                                      {badge(t.category)}
                                    </span>
                                    <span
                                      className={[
                                        "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                                        status === "completed"
                                          ? "border-white/10 bg-(--app-emerald)/15 text-(--app-emerald)"
                                          : status === "active"
                                            ? "border-white/10 bg-white/10 text-zinc-100"
                                            : "border-white/10 bg-black/40 text-zinc-300",
                                      ].join(" ")}
                                    >
                                      {status === "completed"
                                        ? "達成"
                                        : status === "active"
                                          ? "進行中"
                                          : "未開始"}
                                    </span>
                                  </div>
                                  <div className="mt-2 text-[13px] font-semibold text-zinc-100">
                                    {t.title}
                                  </div>
                                  <div className="mt-2 text-[13px] leading-6 text-zinc-400">
                                    {t.description}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                <div className="text-[12px] text-zinc-500">
                                  報酬:{" "}
                                  <span className="font-semibold text-zinc-200">
                                    {t.reward.shield ? `盾:${t.reward.shield}` : "盾なし"}
                                  </span>
                                  <span className="ml-2 font-semibold text-zinc-200">
                                    {t.reward.armor ? "鎧あり" : "鎧なし"}
                                  </span>
                                </div>

                                {status === "active" && activeQ ? (
                                  <Link
                                    href={`/quests/${activeQ.id}`}
                                    className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] font-semibold text-zinc-100 hover:border-white/20"
                                  >
                                    証明する →
                                  </Link>
                                ) : status === "completed" && doneQ ? (
                                  <div className="flex items-center gap-2">
                                    <Link
                                      href={`/quests/${doneQ.id}`}
                                      className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] font-semibold text-zinc-100 hover:border-white/20"
                                    >
                                      証拠を見る
                                    </Link>
                                    <form action={startQuest.bind(null, t.key)}>
                                      <button
                                        type="submit"
                                        className="rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2 text-[13px] font-semibold text-zinc-100 hover:border-white/20"
                                      >
                                        もう一度
                                      </button>
                                    </form>
                                  </div>
                                ) : (
                                  <form action={startQuest.bind(null, t.key)}>
                                    <button
                                      type="submit"
                                      className="rounded-xl border border-white/10 bg-(--app-emerald)/20 px-3 py-2 text-[13px] font-semibold text-zinc-100 hover:border-white/20"
                                    >
                                      開始する →
                                    </button>
                                  </form>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              <ProfessionalAdviceCard href={fpLink?.url ?? process.env.NEXT_PUBLIC_FP_BOOKING_URL ?? null} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
      <div className="text-[12px] font-semibold text-zinc-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-zinc-100">
        {value}
      </div>
    </div>
  );
}

function ListView({ items }: { items: UserQuestRow[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-black/30 p-5 text-[13px] text-zinc-400">
        該当するクエストはありません。
      </div>
    );
  }

  return (
    <ul className="grid gap-2">
      {items.map((q) => (
        <li key={q.id} className="rounded-3xl border border-white/10 bg-black/30 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[11px] font-semibold text-zinc-300">
                  {badge(q.category)}
                </span>
                <div className="truncate text-[13px] font-semibold text-zinc-100">
                  {q.title}
                </div>
                <span
                  className={[
                    "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                    q.status === "completed"
                      ? "border-white/10 bg-(--app-emerald)/15 text-(--app-emerald)"
                      : "border-white/10 bg-white/10 text-zinc-100",
                  ].join(" ")}
                >
                  {q.status === "completed" ? "達成" : "進行中"}
                </span>
              </div>
              <div className="mt-2 text-[12px] text-zinc-500">
                {q.status === "active"
                  ? `開始: ${new Date(q.started_at).toLocaleString()}`
                  : `達成: ${q.completed_at ? new Date(q.completed_at).toLocaleString() : "—"}`}
              </div>
            </div>
            <Link
              href={`/quests/${q.id}`}
              className="rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-[13px] font-semibold text-zinc-100 hover:border-white/20"
            >
              開く
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}

