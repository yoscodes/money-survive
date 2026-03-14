import { createSupabaseServer } from "@/lib/supabase/server";
import { TriggerCenter } from "./TriggerCenter";
import {
  loadSolutionLinks,
  pickFpLink,
  pickSolutionLinks,
} from "@/lib/monetization/solutions";
import {
  buildFinanceSnapshot,
  type ExpensePattern,
  type FinanceTransaction,
} from "@/lib/finance/insights";

function readNumber(
  v: string | string[] | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  const s = Array.isArray(v) ? v[0] : v;
  const n = Number(s);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export default async function TriggersPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const supabase = await createSupabaseServer();
  const { data: userData } = await supabase.auth.getUser();

  const user = userData.user;
  const { data } = await supabase
    .from("transactions")
    .select("id, created_at, type, amount, note")
    .eq("user_id", user?.id ?? "")
    .order("created_at", { ascending: false })
    .limit(200);

  const items = ((data ?? []) as FinanceTransaction[]) ?? [];
  const snapshot = buildFinanceSnapshot(items);
  const poisonTargets = pickTargets(
    snapshot.heavyRecurringExpenses.length > 0
      ? snapshot.heavyRecurringExpenses
      : snapshot.recurringExpenseCandidates,
  );
  const defaultCutFixed =
    poisonTargets.reduce((sum, target) => sum + target.amount, 0) ||
    snapshot.recurringExpenseCandidates[0]?.averageAmount ||
    3000;
  const shieldTarget = snapshot.unusualExpenseItems[0] ?? snapshot.highExpenseItems[0] ?? null;
  const shieldPreviewLabel = shieldTarget
    ? `急な「${shieldTarget.label} ${shieldTarget.amount.toLocaleString()}円級」の出費でも、致命傷を避ける備え。`
    : "急な医療費や修理代が来ても、生存日数を削られにくくする守り。";

  const initialCutFixed = readNumber(searchParams?.cutFixed, defaultCutFixed, 0, 30000);
  const initialBoostIncome = readNumber(searchParams?.boostIncome, 5000, 0, 60000);
  const { links: solutionLinks, error: solutionError } = await loadSolutionLinks(supabase, [
    "triggers",
    "fp",
  ]);
  const poisonLinks = pickSolutionLinks(solutionLinks, {
    placement: "triggers",
    category: "poison",
    subcategory: initialCutFixed >= 3500 ? "mobile" : "subscription",
    limit: 2,
  });
  const dopingLinks = pickSolutionLinks(solutionLinks, {
    placement: "triggers",
    category: "doping",
    subcategory: "side_job",
    limit: 2,
  });
  const shieldLinks = pickSolutionLinks(solutionLinks, {
    placement: "triggers",
    category: "shield",
    subcategory: "insurance",
    limit: 2,
  });
  const fpLink = pickFpLink(solutionLinks);

  return (
    <TriggerCenter
      savings={snapshot.savings}
      avgMonthlyExpense={snapshot.avgMonthlyExpense}
      initialCutFixed={initialCutFixed}
      initialBoostIncome={initialBoostIncome}
      poisonTargets={poisonTargets}
      shieldPreviewLabel={shieldPreviewLabel}
      poisonLinks={poisonLinks}
      dopingLinks={dopingLinks}
      shieldLinks={shieldLinks}
      fpBookingUrl={fpLink?.url ?? process.env.NEXT_PUBLIC_FP_BOOKING_URL ?? null}
      solutionError={solutionError}
    />
  );
}

function pickTargets(items: ExpensePattern[]) {
  return items.slice(0, 2).map((item) => ({
    label: item.label,
    amount: item.averageAmount,
  }));
}

