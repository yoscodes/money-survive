export type QuestCategory = "poison" | "doping" | "shield";

export type QuestReward = {
  shield?: "basic" | "ironwall";
  armor?: boolean;
};

export type QuestTemplate = {
  key: string;
  title: string;
  description: string;
  category: QuestCategory;
  proofHint: string;
  recommended?: {
    cutFixed?: number;
    boostIncome?: number;
  };
  reward: QuestReward;
};

export const QUEST_TEMPLATES: Record<string, QuestTemplate> = {
  cancel_subscription: {
    key: "cancel_subscription",
    title: "サブスクを1つ解約せよ",
    description:
      "不要なサブスクを1つだけ消す。小さくても確実な“毒消し”。",
    category: "poison",
    proofHint:
      "設定画面の解約完了スクショ、または解約済みの申告（メモ）",
    recommended: { cutFixed: 3000 },
    reward: { armor: true },
  },
  reduce_mobile_plan: {
    key: "reduce_mobile_plan",
    title: "通信費を見直せ（-4,000円/月）",
    description:
      "スマホ料金プランを見直して固定費を削る。成功すると生存日数が伸びやすい。",
    category: "poison",
    proofHint: "料金プラン画面のスクショ（プラン名/金額がわかるもの）",
    recommended: { cutFixed: 4000 },
    reward: { armor: true },
  },
  no_conbini_3days: {
    key: "no_conbini_3days",
    title: "コンビニ入店を3日我慢せよ",
    description:
      "小口支出の連打を止める。難しいなら“3日だけ”でいい。",
    category: "poison",
    proofHint: "申告（メモ）でもOK。達成できた理由を1行で。",
    recommended: { cutFixed: 1500 },
    reward: { armor: true },
  },
  emergency_fund: {
    key: "emergency_fund",
    title: "鉄壁の盾を作れ（緊急資金の置き場所）",
    description:
      "不意打ち出費で即死しない仕組みを作る（口座/封筒/別財布など）。",
    category: "shield",
    proofHint: "設定画面のスクショ or 申告（どこに置いたか）",
    reward: { shield: "ironwall" },
  },
  apply_side_job: {
    key: "apply_side_job",
    title: "副業案件に1つ応募せよ",
    description:
      "稼ぐ力を増やす。まずは“1応募”でいい（完璧主義を捨てる）。",
    category: "doping",
    proofHint: "応募完了画面のスクショ or 申告（どの案件か）",
    recommended: { boostIncome: 8000 },
    reward: { shield: "basic" },
  },
};

export function getQuestTemplate(key: string): QuestTemplate | null {
  return QUEST_TEMPLATES[key] ?? null;
}

