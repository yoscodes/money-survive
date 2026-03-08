import { BuddyRoastCard } from "./BuddyRoastCard";
import { generateMonthlyBuddyRoast } from "@/lib/ai/openai";

type MonthlyBuddyRoastSectionProps = {
  monthLabel: string;
  savings: number;
  monthlySurplus: number | null;
  avgMonthlyExpense: number | null;
  survivalDays: number | null;
  expenses: Array<{ label: string; amount: number; createdAt: string }>;
  incomes: Array<{ label: string; amount: number; createdAt: string }>;
};

export async function MonthlyBuddyRoastSection({
  monthLabel,
  savings,
  monthlySurplus,
  avgMonthlyExpense,
  survivalDays,
  expenses,
  incomes,
}: MonthlyBuddyRoastSectionProps) {
  if (expenses.length < 2) {
    return <BuddyRoastCard roast={null} monthLabel={monthLabel} />;
  }

  let roast = null;
  try {
    roast = await generateMonthlyBuddyRoast({
      monthLabel,
      savings,
      monthlySurplus,
      avgMonthlyExpense,
      survivalDays,
      expenses,
      incomes,
    });
  } catch {
    roast = null;
  }

  return <BuddyRoastCard roast={roast} monthLabel={monthLabel} failure={!roast} />;
}
