"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  addTransaction,
  deleteTransaction,
  updateTransaction,
  type TxActionState,
} from "./actions";
import { PrimaryButton, SubtleButton, TextInput } from "@/components/ui";
import { formatLifetimeLoss } from "@/lib/finance/insights";

import type { Transaction } from "./types";

const initialState: TxActionState = { error: null, success: false, fieldErrors: {} };
const dashboardToastStorageKey = "dashboard:transaction-toast";
const dashboardToastEventName = "dashboard:toast";
const dashboardToastDurationMs = 2500;

type DashboardToastPayload = {
  tone: "success" | "error";
  title: string;
  message: string;
};

function emitDashboardToast(payload: DashboardToastPayload) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(dashboardToastStorageKey, JSON.stringify(payload));
  window.dispatchEvent(new CustomEvent(dashboardToastEventName, { detail: payload }));
}

function consumeDashboardToast() {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(dashboardToastStorageKey);
  if (!raw) return null;
  window.sessionStorage.removeItem(dashboardToastStorageKey);
  try {
    const parsed = JSON.parse(raw) as Partial<DashboardToastPayload>;
    if (
      (parsed.tone === "success" || parsed.tone === "error") &&
      typeof parsed.title === "string" &&
      typeof parsed.message === "string"
    ) {
      return parsed as DashboardToastPayload;
    }
  } catch {
    // ignore broken payload
  }
  return null;
}

export function AddTransactionCard({ hasTransactions }: { hasTransactions: boolean }) {
  const [state, action, pending] = useActionState(addTransaction, initialState);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (!state.success) return;
    emitDashboardToast({ tone: "success", title: "ログ追加", message: "追加しました" });
    formRef.current?.reset();
  }, [state.success]);

  useEffect(() => {
    if (!state.error) return;
    emitDashboardToast({ tone: "error", title: "ログ追加に失敗", message: state.error });
  }, [state.error]);

  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-sm shadow-black/30">
      <div className="text-sm font-semibold tracking-tight">ログを追加</div>
      <p className="mt-2 text-[13px] leading-6 text-zinc-400">
        {hasTransactions
          ? "今日の収支を素早く記録して、変化を見える化します。"
          : "まずは家賃を入れて、バディを土俵際に立たせましょう。危機が見えると改善も始めやすくなります。"}
      </p>

      <form ref={formRef} action={action} className="mt-5 grid gap-3">
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
          <FieldError message={state.fieldErrors?.type} />
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
          <FieldError message={state.fieldErrors?.amount} />
        </label>

        <label className="grid gap-1">
          <span className="text-[13px] font-medium text-zinc-300">
            メモ（任意）
          </span>
          <TextInput name="note" placeholder="例: ランチ" />
          <div className="text-[12px] text-zinc-500">80文字まで。あとから検索しやすい名前がおすすめです。</div>
          <FieldError message={state.fieldErrors?.note} />
        </label>

        <ActionErrorMessage state={state} />

        <PrimaryButton type="submit" disabled={pending} className="mt-2">
          {pending ? "追加中..." : "追加する"}
        </PrimaryButton>
      </form>
    </div>
  );
}

export function TransactionList({
  items,
  avgMonthlyExpense,
}: {
  items: Transaction[];
  avgMonthlyExpense: number | null;
}) {
  const [toast, setToast] = useState<DashboardToastPayload | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const showToast = (payload: DashboardToastPayload) => {
      setToast(payload);
      if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = window.setTimeout(() => {
        setToast((current) => (current?.message === payload.message ? null : current));
      }, dashboardToastDurationMs);
    };

    const payload = consumeDashboardToast();
    if (payload) {
      const showTimer = window.setTimeout(() => showToast(payload), 0);
      return () => {
        window.clearTimeout(showTimer);
        if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
      };
    }

    const handleToast = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail : null;
      const isValidPayload =
        !!detail &&
        typeof detail === "object" &&
        (detail.tone === "success" || detail.tone === "error") &&
        typeof detail.title === "string" &&
        typeof detail.message === "string";
      if (!isValidPayload) return;
      showToast(detail as DashboardToastPayload);
    };

    window.addEventListener(dashboardToastEventName, handleToast);
    return () => {
      window.removeEventListener(dashboardToastEventName, handleToast);
      if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
    };
  }, []);

  return (
    <div className="relative flex max-h-[70vh] min-h-[420px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-sm shadow-black/30">
      <AnimatePresence>
        {toast ? <DashboardToast key={`${toast.tone}:${toast.title}:${toast.message}`} toast={toast} /> : null}
      </AnimatePresence>

      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-sm font-semibold tracking-tight">最近のログ</div>
          <div className="mt-2 text-[13px] text-zinc-400">
            全{String(items.length)}件
            <span className="ml-2 text-zinc-500">スクロールして確認</span>
          </div>
        </div>
      </div>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
        <ul className="grid gap-2">
          <AnimatePresence initial={false}>
            {items.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} avgMonthlyExpense={avgMonthlyExpense} />
            ))}
          </AnimatePresence>
        </ul>
      </div>

      {items.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/30 px-4 py-5 text-[13px] text-zinc-400">
          まだログがありません。最初の儀式として、家賃や給料を1件入れて現実を起動しましょう。
        </div>
      ) : null}
    </div>
  );
}

function DashboardToast({ toast }: { toast: DashboardToastPayload }) {
  const isError = toast.tone === "error";
  const iconClass = isError
    ? "bg-(--app-crimson)/15 text-(--app-crimson)"
    : "bg-(--app-emerald)/15 text-(--app-emerald)";
  const textClass = isError ? "text-(--app-crimson)" : "text-(--app-emerald)";
  const barClass = isError ? "bg-(--app-crimson)" : "bg-(--app-emerald)";

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="absolute right-4 top-4 z-10 min-w-[240px] overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 shadow-lg shadow-black/30 backdrop-blur"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconClass}`}>
          {isError ? (
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm-3.28-5.78a.75.75 0 1 0 1.06 1.06L10 11.06l2.22 2.22a.75.75 0 1 0 1.06-1.06L11.06 10l2.22-2.22a.75.75 0 0 0-1.06-1.06L10 8.94 7.78 6.72a.75.75 0 0 0-1.06 1.06L8.94 10l-2.22 2.22Z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.78-9.72a.75.75 0 0 0-1.06-1.06L9.25 10.69 7.78 9.22a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l4-4Z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>
        <div className="min-w-0">
          <div className="text-[12px] font-medium text-zinc-500">{toast.title}</div>
          <div className={`truncate text-[13px] font-semibold ${textClass}`}>{toast.message}</div>
        </div>
      </div>

      <div className="h-1 w-full bg-white/5">
        <motion.div
          initial={{ width: "100%" }}
          animate={{ width: 0 }}
          transition={{ duration: dashboardToastDurationMs / 1000, ease: "linear" }}
          className={`h-full ${barClass}`}
        />
      </div>
    </motion.div>
  );
}

function TransactionRow({
  tx,
  avgMonthlyExpense,
}: {
  tx: Transaction;
  avgMonthlyExpense: number | null;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const lifetimeLoss = tx.type === "expense" ? formatLifetimeLoss(tx.amount, avgMonthlyExpense) : null;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
      className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3"
    >
      {isEditing ? (
        <EditTransactionForm tx={tx} onDone={() => setIsEditing(false)} />
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={[
                  "inline-flex h-6 items-center rounded-full px-2 text-[12px] font-medium",
                  tx.type === "income"
                    ? "bg-(--app-emerald)/15 text-(--app-emerald)"
                    : "bg-(--app-crimson)/15 text-(--app-crimson)",
                ].join(" ")}
              >
                {tx.type === "income" ? "収入" : "支出"}
              </span>
              <span className="truncate text-[13px] text-zinc-400">{tx.note ?? "—"}</span>
            </div>
            <div className="mt-1 text-[12px] text-zinc-500">
              {new Date(tx.created_at).toLocaleString("ja-JP")}
            </div>
            {lifetimeLoss ? (
              <div className="mt-1 text-[12px] font-medium text-(--app-crimson)">
                この支出で寿命が {lifetimeLoss} 縮みました
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right text-sm font-semibold tabular-nums">
              {tx.type === "expense" ? "-" : "+"}
              {Math.round(tx.amount).toLocaleString()}円
            </div>
            <SubtleButton
              type="button"
              className="h-9 px-3 text-[13px]"
              onClick={() => setIsEditing(true)}
            >
              編集
            </SubtleButton>
            <DeleteTransactionButton id={tx.id} />
          </div>
        </div>
      )}
    </motion.li>
  );
}

function EditTransactionForm({
  tx,
  onDone,
}: {
  tx: Transaction;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(updateTransaction, initialState);

  useEffect(() => {
    if (!state.success) return;
    emitDashboardToast({ tone: "success", title: "ログ更新", message: "更新しました" });
    onDone();
  }, [onDone, state.success]);

  useEffect(() => {
    if (!state.error) return;
    emitDashboardToast({ tone: "error", title: "ログ更新に失敗", message: state.error });
  }, [state.error]);

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="id" value={tx.id} />

      <div className="grid gap-1">
        <span className="text-[13px] font-medium text-zinc-300">種類</span>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px]">
            <input type="radio" name="type" value="income" defaultChecked={tx.type === "income"} />
            収入
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px]">
            <input type="radio" name="type" value="expense" defaultChecked={tx.type === "expense"} />
            支出
          </label>
        </div>
        <FieldError message={state.fieldErrors?.type} />
      </div>

      <label className="grid gap-1">
        <span className="text-[13px] font-medium text-zinc-300">金額</span>
        <TextInput name="amount" type="number" step="0.01" min="0" defaultValue={tx.amount} required />
        <FieldError message={state.fieldErrors?.amount} />
      </label>

      <label className="grid gap-1">
        <span className="text-[13px] font-medium text-zinc-300">メモ</span>
        <TextInput name="note" defaultValue={tx.note ?? ""} placeholder="例: ランチ" />
        <FieldError message={state.fieldErrors?.note} />
      </label>

      <div className="text-[12px] text-zinc-500">{new Date(tx.created_at).toLocaleString("ja-JP")}</div>

      <ActionErrorMessage state={state} />

      <div className="flex flex-wrap items-center gap-2">
        <PrimaryButton type="submit" disabled={pending} className="h-9 px-3 text-[13px]">
          {pending ? "更新中..." : "保存"}
        </PrimaryButton>
        <SubtleButton type="button" className="h-9 px-3 text-[13px]" onClick={onDone}>
          キャンセル
        </SubtleButton>
      </div>
    </form>
  );
}

function DeleteTransactionButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(deleteTransaction, initialState);

  useEffect(() => {
    if (!state.success) return;
    emitDashboardToast({ tone: "success", title: "ログ削除", message: "削除しました" });
  }, [state.success]);

  useEffect(() => {
    if (!state.error) return;
    emitDashboardToast({ tone: "error", title: "ログ削除に失敗", message: state.error });
  }, [state.error]);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <SubtleButton type="submit" disabled={pending} className="h-9 px-3 text-[13px]">
        {pending ? "削除中..." : "削除"}
      </SubtleButton>
    </form>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <div className="text-[12px] text-(--app-crimson)">{message}</div>;
}

function ActionErrorMessage({ state }: { state: TxActionState }) {
  const hasFieldErrors = Object.keys(state.fieldErrors ?? {}).length > 0;
  if (!state.error || hasFieldErrors) return null;
  return (
    <div className="rounded-2xl border border-(--app-crimson)/30 bg-(--app-crimson)/10 px-3 py-2 text-[12px] text-(--app-crimson)">
      {state.error}
    </div>
  );
}

