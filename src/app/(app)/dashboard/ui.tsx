"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useActionState } from "react";
import { addTransaction, deleteTransaction, type TxActionState } from "./actions";
import { PrimaryButton, SubtleButton, TextInput } from "@/components/ui";

import type { Transaction } from "./types";

const initialState: TxActionState = { error: null };

export function AddTransactionCard() {
  const [state, action, pending] = useActionState(addTransaction, initialState);

  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-sm shadow-black/30">
      <div className="text-sm font-semibold tracking-tight">ログを追加</div>
      <p className="mt-2 text-[13px] leading-6 text-zinc-400">
        いまの現実を1行で記録します。
      </p>

      <form action={action} className="mt-5 grid gap-3">
        <div className="grid gap-1">
          <span className="text-[13px] font-medium text-zinc-300">
            種類
          </span>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px]">
              <input type="radio" name="type" value="income" defaultChecked />
              収入
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px]">
              <input type="radio" name="type" value="expense" />
              支出
            </label>
          </div>
        </div>

        <label className="grid gap-1">
          <span className="text-[13px] font-medium text-zinc-300">
            金額
          </span>
          <TextInput
            name="amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="例: 1200"
            required
          />
        </label>

        <label className="grid gap-1">
          <span className="text-[13px] font-medium text-zinc-300">
            メモ（任意）
          </span>
          <TextInput name="note" placeholder="例: ランチ" />
        </label>

        {state.error ? (
        <div className="rounded-xl border border-white/10 bg-[color:var(--app-crimson)]/15 px-3 py-2 text-[13px] text-[color:var(--app-crimson)]">
            {state.error}
          </div>
        ) : null}

        <PrimaryButton type="submit" disabled={pending} className="mt-2">
          {pending ? "追加中..." : "追加する"}
        </PrimaryButton>
      </form>
    </div>
  );
}

export function TransactionList({ items }: { items: Transaction[] }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-sm shadow-black/30">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-sm font-semibold tracking-tight">最近のログ</div>
          <div className="mt-2 text-[13px] text-zinc-400">
            {items.length}件
          </div>
        </div>
      </div>

      <ul className="mt-5 grid gap-2">
        <AnimatePresence initial={false}>
          {items.map((tx) => (
            <motion.li
              key={tx.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={[
                      "inline-flex h-6 items-center rounded-full px-2 text-[12px] font-medium",
                      tx.type === "income"
                        ? "bg-[color:var(--app-emerald)]/15 text-[color:var(--app-emerald)]"
                        : "bg-[color:var(--app-crimson)]/15 text-[color:var(--app-crimson)]",
                    ].join(" ")}
                  >
                    {tx.type === "income" ? "収入" : "支出"}
                  </span>
                  <span className="truncate text-[13px] text-zinc-400">
                    {tx.note ?? "—"}
                  </span>
                </div>
                <div className="mt-1 text-[12px] text-zinc-500">
                  {new Date(tx.created_at).toLocaleString()}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="text-right text-sm font-semibold tabular-nums">
                  {tx.type === "expense" ? "-" : "+"}
                  {tx.amount.toLocaleString()}
                </div>
                <form action={deleteTransaction.bind(null, tx.id)}>
                  <SubtleButton type="submit" className="h-9 px-3 text-[13px]">
                    削除
                  </SubtleButton>
                </form>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

