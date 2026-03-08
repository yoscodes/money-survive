export type Transaction = {
  id: string;
  created_at: string;
  type: "income" | "expense";
  amount: number;
  note: string | null;
};

