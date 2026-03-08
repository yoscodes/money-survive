export type SolutionPlacement = "triggers" | "quests" | "quest_detail" | "fp";
export type SolutionCategory = "poison" | "doping" | "shield" | "advice";
export type SolutionSubcategory =
  | "mobile"
  | "subscription"
  | "insurance"
  | "side_job"
  | "investment"
  | "loan"
  | null;

export type SolutionLink = {
  id: string;
  placement: SolutionPlacement;
  category: SolutionCategory;
  subcategory: SolutionSubcategory;
  label: string;
  description: string | null;
  url: string;
  cta_label: string | null;
  priority: number;
  is_active: boolean;
};

export const SOLUTION_PLACEMENTS = [
  "triggers",
  "quests",
  "quest_detail",
  "fp",
] as const satisfies readonly SolutionPlacement[];

export const SOLUTION_CATEGORIES = [
  "poison",
  "doping",
  "shield",
  "advice",
] as const satisfies readonly SolutionCategory[];

export const SOLUTION_SUBCATEGORIES = [
  "mobile",
  "subscription",
  "insurance",
  "side_job",
  "investment",
  "loan",
] as const satisfies readonly Exclude<SolutionSubcategory, null>[];

type SolutionLinkQuery = {
  in: (column: string, values: string[]) => {
    eq: (column: string, value: boolean) => {
      order: (
        column: string,
        options?: { ascending?: boolean },
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
  };
};

type SolutionLinkReadable = {
  from: (table: string) => {
    select: (query: string) => SolutionLinkQuery;
  };
};

const SUBCATEGORY_KEYWORDS: Record<
  Exclude<SolutionSubcategory, null>,
  string[]
> = {
  mobile: ["通信費", "sim", "スマホ", "携帯", "モバイル", "格安"],
  subscription: ["サブスク", "netflix", "spotify", "prime", "解約", "固定費"],
  insurance: ["保険", "保障", "医療", "盾", "見直し"],
  side_job: ["副業", "案件", "応募", "ポイ活", "収入"],
  investment: ["投資", "資産運用", "nisa", "積立"],
  loan: ["住宅ローン", "ローン", "借入"],
};

export async function loadSolutionLinks(
  supabase: unknown,
  placements: SolutionPlacement[],
) {
  const client = supabase as SolutionLinkReadable;
  const { data, error } = await client
    .from("solution_links")
    .select(
      "id, placement, category, subcategory, label, description, url, cta_label, priority, is_active",
    )
    .in("placement", placements)
    .eq("is_active", true)
    .order("priority", { ascending: true });

  if (error) {
    const missingTable =
      error.message.includes("relation") || error.message.includes("solution_links");
    return {
      links: [] as SolutionLink[],
      error: missingTable
        ? "solution_links テーブルが未作成です。README の SQL を実行してください。"
        : error.message,
    };
  }

  return {
    links: ((data ?? []) as SolutionLink[]) ?? [],
    error: null as string | null,
  };
}

export function inferSubcategory(input: {
  category: string;
  title?: string | null;
  description?: string | null;
  proofHint?: string | null;
}) {
  const haystack = `${input.title ?? ""} ${input.description ?? ""} ${input.proofHint ?? ""}`.toLowerCase();

  for (const [subcategory, keywords] of Object.entries(SUBCATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))) {
      return subcategory as Exclude<SolutionSubcategory, null>;
    }
  }

  if (input.category === "poison") return "subscription";
  if (input.category === "doping") return "side_job";
  if (input.category === "shield") return "insurance";
  return null;
}

export function isSolutionPlacement(value: string): value is SolutionPlacement {
  return SOLUTION_PLACEMENTS.includes(value as SolutionPlacement);
}

export function isSolutionCategory(value: string): value is SolutionCategory {
  return SOLUTION_CATEGORIES.includes(value as SolutionCategory);
}

export function isSolutionSubcategory(
  value: string,
): value is Exclude<SolutionSubcategory, null> {
  return SOLUTION_SUBCATEGORIES.includes(value as Exclude<SolutionSubcategory, null>);
}

export function normalizeSolutionSubcategory(value: string): SolutionSubcategory {
  return isSolutionSubcategory(value) ? value : null;
}

export function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function pickSolutionLinks(
  links: SolutionLink[],
  options: {
    placement: SolutionPlacement;
    category: SolutionCategory;
    subcategory?: SolutionSubcategory;
    limit?: number;
  },
) {
  const limit = options.limit ?? 2;
  const base = links.filter(
    (link) => link.placement === options.placement && link.category === options.category,
  );

  const exact =
    options.subcategory === null || options.subcategory === undefined
      ? []
      : base.filter((link) => link.subcategory === options.subcategory);
  const fallback = base.filter(
    (link) =>
      !exact.some((picked) => picked.id === link.id) &&
      (link.subcategory === null || options.subcategory === null || link.subcategory !== options.subcategory),
  );

  return [...exact, ...fallback].slice(0, limit);
}

export function pickFpLink(links: SolutionLink[]) {
  return (
    links.find((link) => link.placement === "fp" && link.category === "advice") ?? null
  );
}

export function externalUrlTarget(url: string) {
  return url.startsWith("http://") || url.startsWith("https://");
}
