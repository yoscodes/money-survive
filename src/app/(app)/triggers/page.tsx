import { createSupabaseServer } from "@/lib/supabase/server";
import { TriggerCenter } from "./TriggerCenter";
import type { Transaction } from "../dashboard/types";
import {
  loadSolutionLinks,
  pickFpLink,
  pickSolutionLinks,
} from "@/lib/monetization/solutions";

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

  const items = ((data ?? []) as Transaction[]) ?? [];
  const savings =
    items.reduce((acc, tx) => acc + (tx.type === "income" ? tx.amount : -tx.amount), 0) || 0;

  const daysWindow = 90;
  const now = items.length ? new Date(items[0].created_at) : new Date(0);
  const since = new Date(now.getTime() - daysWindow * 24 * 60 * 60 * 1000);
  const inWindow = items.filter((tx) => new Date(tx.created_at) >= since);
  const windowExpense = inWindow
    .filter((tx) => tx.type === "expense")
    .reduce((acc, tx) => acc + tx.amount, 0);
  const avgMonthlyExpense =
    windowExpense > 0 ? (windowExpense / daysWindow) * 30 : null;

  const initialCutFixed = readNumber(searchParams?.cutFixed, 3000, 0, 30000);
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
      savings={savings}
      avgMonthlyExpense={avgMonthlyExpense}
      initialCutFixed={initialCutFixed}
      initialBoostIncome={initialBoostIncome}
      poisonLinks={poisonLinks}
      dopingLinks={dopingLinks}
      shieldLinks={shieldLinks}
      fpBookingUrl={fpLink?.url ?? process.env.NEXT_PUBLIC_FP_BOOKING_URL ?? null}
      solutionError={solutionError}
    />
  );
}

