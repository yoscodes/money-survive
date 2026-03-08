import OpenAI from "openai";
import type { FinanceSnapshot } from "@/lib/finance/insights";
import type { QuestCategory, QuestReward } from "@/lib/quests/templates";

export type AiTriggerDraft = {
  title: string;
  description: string;
  category: QuestCategory;
  proofHint: string;
  recommendedCutFixed: number | null;
  recommendedBoostIncome: number | null;
  estimatedDeltaDays: number;
};

export type MonthlyBuddyRoast = {
  headline: string;
  body: string;
  focus: string;
};

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function getClient() {
  return new OpenAI({
    apiKey: getEnv("OPENAI_API_KEY"),
  });
}

function modelName() {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

function clampText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function clampNumber(value: unknown, min: number, max: number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function isCategory(value: unknown): value is QuestCategory {
  return value === "poison" || value === "doping" || value === "shield";
}

function parseSuggestions(input: string): AiTriggerDraft[] {
  const raw = JSON.parse(input) as { suggestions?: unknown };
  const list = Array.isArray(raw.suggestions) ? raw.suggestions : [];

  return list
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const category = isCategory(row.category) ? row.category : null;
      if (!category) return null;

      const title = clampText(row.title, 60);
      const description = clampText(row.description, 220);
      const proofHint = clampText(row.proofHint, 120);
      const estimatedDeltaDays = clampNumber(row.estimatedDeltaDays, 1, 90);
      const recommendedCutFixed = clampNumber(row.recommendedCutFixed, 0, 100000);
      const recommendedBoostIncome = clampNumber(row.recommendedBoostIncome, 0, 100000);

      if (!title || !description || !proofHint || estimatedDeltaDays === null) return null;

      return {
        title,
        description,
        category,
        proofHint,
        recommendedCutFixed:
          category === "poison" ? (recommendedCutFixed ?? 0) : recommendedCutFixed,
        recommendedBoostIncome:
          category === "doping" ? (recommendedBoostIncome ?? 0) : recommendedBoostIncome,
        estimatedDeltaDays,
      } satisfies AiTriggerDraft;
    })
    .filter((item): item is AiTriggerDraft => !!item)
    .slice(0, 3);
}

function parseMonthlyRoast(input: string): MonthlyBuddyRoast | null {
  const raw = JSON.parse(input) as Record<string, unknown>;
  const headline = clampText(raw.headline, 80);
  const body = clampText(raw.body, 220);
  const focus = clampText(raw.focus, 80);
  if (!headline || !body || !focus) return null;
  return { headline, body, focus };
}

function tendencyLabel(tendency: FinanceSnapshot["spendingTendency"]) {
  if (tendency === "small") return "小口支出が多い";
  if (tendency === "fixed") return "固定費寄り";
  if (tendency === "spiky") return "波が大きい";
  return "まだ不明";
}

function buildPrompt(snapshot: FinanceSnapshot) {
  const recurringLines =
    snapshot.recurringExpenseCandidates.length > 0
      ? snapshot.recurringExpenseCandidates
          .map(
            (item) =>
              `- ${item.label}: ${item.count}回 / 平均${item.averageAmount.toLocaleString()}円`,
          )
          .join("\n")
      : "- 特に強い recurring 候補はまだ不明";

  const hotspotLines =
    snapshot.smallExpenseHotspots.length > 0
      ? snapshot.smallExpenseHotspots
          .map(
            (item) =>
              `- ${item.label}: ${item.count}回 / 平均${item.averageAmount.toLocaleString()}円`,
          )
          .join("\n")
      : "- 小口支出の偏りはまだ不明";

  const highExpenseLines =
    snapshot.highExpenseItems.length > 0
      ? snapshot.highExpenseItems
          .map(
            (item) =>
              `- ${item.label}: ${item.amount.toLocaleString()}円 (${new Date(item.createdAt).toLocaleDateString()})`,
          )
          .join("\n")
      : "- 高額支出データなし";

  const recentExpenseLines =
    snapshot.recentExpenses.length > 0
      ? snapshot.recentExpenses
          .map(
            (item) =>
              `- ${item.label}: ${item.amount.toLocaleString()}円 (${new Date(item.createdAt).toLocaleDateString()})`,
          )
          .join("\n")
      : "- 最近の支出なし";

  return [
    "あなたは家計改善コーチです。出力は必ずJSONのみで返してください。",
    "目的: 明日から着手できて、生存日数を少なくとも+5日相当で改善しやすい具体策を3件返す。",
    "禁止: 抽象論、長い前置き、保険商品の固有名詞、投機的な投資助言、違法な提案。",
    "日本語で短く具体的に書くこと。",
    "",
    "出力JSONスキーマ:",
    '{ "suggestions": [{ "title": string, "description": string, "category": "poison" | "doping" | "shield", "proofHint": string, "recommendedCutFixed": number | null, "recommendedBoostIncome": number | null, "estimatedDeltaDays": number }] }',
    "",
    "ルール:",
    "- 3件ちょうど返す",
    "- titleは60文字以内",
    "- descriptionは220文字以内で、ユーザーの支出傾向に触れる",
    "- proofHintは現実で行動した証拠になるものにする",
    "- category=poison は固定費や小口支出の改善。recommendedCutFixed をできるだけ入れる",
    "- category=doping は収入増。recommendedBoostIncome をできるだけ入れる",
    "- category=shield は守りの行動。金額が曖昧なら recommendedCutFixed / recommendedBoostIncome は null でもよい",
    "- estimatedDeltaDays は 5 以上を基本にする",
    "- 同じ方向性の提案を重複させない",
    "",
    "ユーザーの家計サマリー:",
    `- 取引件数: ${snapshot.transactionCount}`,
    `- 収入件数: ${snapshot.incomeCount}`,
    `- 支出件数: ${snapshot.expenseCount}`,
    `- 直近30日の支出件数: ${snapshot.expenseCount30}`,
    `- 貯蓄: ${Math.round(snapshot.savings).toLocaleString()}円`,
    `- 平均月間支出: ${
      snapshot.avgMonthlyExpense === null
        ? "不明"
        : `${Math.round(snapshot.avgMonthlyExpense).toLocaleString()}円`
    }`,
    `- 今月の余力: ${
      snapshot.monthlySurplus === null
        ? "不明"
        : `${Math.round(snapshot.monthlySurplus).toLocaleString()}円`
    }`,
    `- 生存日数: ${
      snapshot.survivalDays === null ? "不明" : `${snapshot.survivalDays.toLocaleString()}日`
    }`,
    `- 支出傾向: ${tendencyLabel(snapshot.spendingTendency)}`,
    "",
    "Recurring候補:",
    recurringLines,
    "",
    "小口支出ホットスポット:",
    hotspotLines,
    "",
    "高額支出:",
    highExpenseLines,
    "",
    "最近の支出:",
    recentExpenseLines,
  ].join("\n");
}

export function rewardForCategory(category: QuestCategory): QuestReward {
  if (category === "poison") return { armor: true };
  if (category === "doping") return { shield: "basic" };
  return { shield: "ironwall" };
}

function buildMonthlyRoastPrompt(input: {
  monthLabel: string;
  savings: number;
  monthlySurplus: number | null;
  avgMonthlyExpense: number | null;
  survivalDays: number | null;
  expenses: Array<{ label: string; amount: number; createdAt: string }>;
  incomes: Array<{ label: string; amount: number; createdAt: string }>;
}) {
  const expenseLines =
    input.expenses.length > 0
      ? input.expenses
          .map(
            (item) =>
              `- ${item.label}: ${Math.round(item.amount).toLocaleString()}円 (${new Date(item.createdAt).toLocaleDateString()})`,
          )
          .join("\n")
      : "- 支出データなし";
  const incomeLines =
    input.incomes.length > 0
      ? input.incomes
          .map(
            (item) =>
              `- ${item.label}: ${Math.round(item.amount).toLocaleString()}円 (${new Date(item.createdAt).toLocaleDateString()})`,
          )
          .join("\n")
      : "- 収入データなし";

  return [
    "あなたは家計アプリの毒舌だが建設的な相棒『バディ』です。出力は必ずJSONのみで返してください。",
    "目的: 今月の家計を見て、1つの短いダメ出しを返す。",
    "口調ルール:",
    "- 少し辛口でよいが、人格否定や過度な攻撃はしない",
    "- ユーザーが次に何を直せばよいかが分かること",
    "- 日本語で短く書く",
    "",
    "出力JSONスキーマ:",
    '{ "headline": string, "body": string, "focus": string }',
    "",
    "追加ルール:",
    "- headline は 40文字以内",
    "- body は 140文字以内",
    "- focus は 30文字以内で、今月まず直す1点を書く",
    "- 今月の支出内容に具体的に触れる",
    "- 収入が弱いのか、固定費が重いのか、小口支出が多いのかを見て判断する",
    "",
    `対象月: ${input.monthLabel}`,
    `- 貯蓄: ${Math.round(input.savings).toLocaleString()}円`,
    `- 今月の余力: ${
      input.monthlySurplus === null ? "不明" : `${Math.round(input.monthlySurplus).toLocaleString()}円`
    }`,
    `- 平均月間支出: ${
      input.avgMonthlyExpense === null
        ? "不明"
        : `${Math.round(input.avgMonthlyExpense).toLocaleString()}円`
    }`,
    `- 生存日数: ${
      input.survivalDays === null ? "不明" : `${input.survivalDays.toLocaleString()}日`
    }`,
    "",
    "今月の主な支出:",
    expenseLines,
    "",
    "今月の主な収入:",
    incomeLines,
  ].join("\n");
}

export async function generateAiTriggers(snapshot: FinanceSnapshot) {
  const client = getClient();
  const completion = await client.chat.completions.create({
    model: modelName(),
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "家計改善の具体策を、短く行動可能な日本語でJSONのみ返すアシスタントです。",
      },
      {
        role: "user",
        content: buildPrompt(snapshot),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("OpenAI response was empty");

  const suggestions = parseSuggestions(content);
  if (suggestions.length !== 3) {
    throw new Error("AI suggestions could not be validated");
  }

  return suggestions;
}

export async function generateMonthlyBuddyRoast(input: {
  monthLabel: string;
  savings: number;
  monthlySurplus: number | null;
  avgMonthlyExpense: number | null;
  survivalDays: number | null;
  expenses: Array<{ label: string; amount: number; createdAt: string }>;
  incomes: Array<{ label: string; amount: number; createdAt: string }>;
}) {
  const client = getClient();
  const completion = await client.chat.completions.create({
    model: modelName(),
    temperature: 0.9,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "家計アプリの相棒として、少し毒舌だが建設的な短文アドバイスをJSONのみで返すアシスタントです。",
      },
      {
        role: "user",
        content: buildMonthlyRoastPrompt(input),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("OpenAI roast response was empty");

  const roast = parseMonthlyRoast(content);
  if (!roast) throw new Error("Monthly roast could not be validated");
  return roast;
}
