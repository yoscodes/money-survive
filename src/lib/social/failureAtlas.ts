import type { SolutionSubcategory } from "@/lib/monetization/solutions";

export type FailureAtlasStory = {
  id: string;
  category: "poison" | "doping" | "shield";
  subcategory: Exclude<SolutionSubcategory, null>;
  title: string;
  levelLabel: string;
  before: string;
  turningPoint: string;
  after: string;
  lesson: string;
};

const STORIES: FailureAtlasStory[] = [
  {
    id: "subscription-reset",
    category: "poison",
    subcategory: "subscription",
    title: "コンビニ依存とサブスク沼から戻ったAさん",
    levelLabel: "Lv.1 -> Lv.3",
    before: "帰宅前のコンビニと気づかない月額課金で、毎月1万円以上が静かに漏れていました。",
    turningPoint: "まず1週間のレシートを並べ、見覚えのない固定費を2つ止めました。",
    after: "支出の流れが止まり、生存日数が伸びたことで『我慢』ではなく『回復』として続けられました。",
    lesson: "毒消しは根性より可視化。漏れの名前が見えた瞬間に止血しやすくなります。",
  },
  {
    id: "mobile-plan-recovery",
    category: "poison",
    subcategory: "mobile",
    title: "通信費を見直して立て直したBさん",
    levelLabel: "Lv.0 -> Lv.2",
    before: "ギガ不足が怖くて高いプランのまま放置し、毎月の固定費を『仕方ない』で済ませていました。",
    turningPoint: "使用量を1か月だけ確認し、最安ではなく『十分な下位プラン』へ変更。",
    after: "無理なく固定費が落ち、余った分を緊急資金に回せるようになりました。",
    lesson: "通信費は完璧に削るより、続くラインまで下げる方が勝ちやすいです。",
  },
  {
    id: "sidejob-first-step",
    category: "doping",
    subcategory: "side_job",
    title: "副業応募1本で流れを変えたCさん",
    levelLabel: "Lv.1 -> Lv.2",
    before: "収入を増やしたいのに、準備だけして応募ゼロのまま数か月止まっていました。",
    turningPoint: "『週末に1件だけ応募』をクエスト化し、証拠提出までやり切りました。",
    after: "初月から大きくは増えなくても、収入を増やす筋肉がつきました。",
    lesson: "ドーピング系は成果より着手回数。1件出すと次の応募が軽くなります。",
  },
  {
    id: "insurance-shield",
    category: "shield",
    subcategory: "insurance",
    title: "急病で崩れかけてから盾を持ったDさん",
    levelLabel: "Lv.2 -> Lv.3",
    before: "『まだ大丈夫』で備えを後回しにし、急な通院費で一気にメンタルまで削られました。",
    turningPoint: "保障の重複と不足を整理し、緊急資金の置き場所も同時に決めました。",
    after: "次のトラブルで即死しない安心ができ、攻めのクエストにも戻りやすくなりました。",
    lesson: "盾は数字を増やす装備ではなく、負け筋を消す装備です。",
  },
  {
    id: "investment-calm",
    category: "shield",
    subcategory: "investment",
    title: "積立の習慣で不安を薄めたEさん",
    levelLabel: "Lv.1 -> Lv.2",
    before: "余裕ができた月も使い切ってしまい、将来への不安だけが残っていました。",
    turningPoint: "少額でも毎月自動で積み立てる設定を先に作りました。",
    after: "大金ではなくても、未来に回るお金があることで浪費の勢いが弱まりました。",
    lesson: "投資は一発逆転ではなく、散財を減らすための固定ルートにもなります。",
  },
];

export function getFailureAtlasStories(input: {
  category: string;
  subcategory: SolutionSubcategory;
}) {
  const exact = STORIES.filter(
    (story) => story.category === input.category && story.subcategory === input.subcategory,
  );
  if (exact.length > 0) return exact.slice(0, 2);
  return STORIES.filter((story) => story.category === input.category).slice(0, 2);
}
