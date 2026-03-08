"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  generateAiTriggersAction,
  startAiTriggerQuest,
  type AiTriggerActionState,
} from "@/app/(app)/quests/actions";
import { PrimaryButton, SubtleButton } from "@/components/ui";

type AiTriggerListItem = {
  id: string;
  title: string;
  description: string;
  category: "poison" | "doping" | "shield";
  proofHint: string;
  recommendedCutFixed: number | null;
  recommendedBoostIncome: number | null;
  estimatedDeltaDays: number;
  status: "generated" | "started" | "completed" | "abandoned";
  linkedQuestId: string | null;
};

const initialState: AiTriggerActionState = {
  error: null,
  success: null,
};

function categoryLabel(category: AiTriggerListItem["category"]) {
  if (category === "poison") return "毒消し";
  if (category === "doping") return "ドーピング";
  return "盾";
}

function statusLabel(status: AiTriggerListItem["status"]) {
  if (status === "started") return "開始済み";
  if (status === "completed") return "達成済み";
  if (status === "abandoned") return "中断";
  return "未開始";
}

export function AiTriggerSection({
  items,
  guidance,
  databaseError,
}: {
  items: AiTriggerListItem[];
  guidance: string;
  databaseError: string | null;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(generateAiTriggersAction, initialState);

  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);

  return (
    <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[12px] font-semibold text-zinc-500">あなた専用の攻略本</div>
          <div className="mt-2 text-sm font-semibold tracking-tight text-zinc-100">
            AIが「明日からできる3つのトリガー」を提案
          </div>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-zinc-400">{guidance}</p>
        </div>

        <form action={action}>
          <PrimaryButton
            type="submit"
            disabled={pending || !!databaseError}
            className="w-full lg:w-auto"
          >
            {pending ? "診断中..." : "AI家計診断を実行"}
          </PrimaryButton>
        </form>
      </div>

      {databaseError ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-(--app-crimson)/10 px-4 py-3 text-[13px] leading-6 text-zinc-200">
          {databaseError}
        </div>
      ) : null}

      {state.error ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-(--app-crimson)/10 px-4 py-3 text-[13px] leading-6 text-zinc-200">
          {state.error}
        </div>
      ) : null}

      {state.success ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-(--app-emerald)/15 px-4 py-3 text-[13px] leading-6 text-zinc-100">
          {state.success}
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {items.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-zinc-950 p-5 text-[13px] leading-6 text-zinc-400 lg:col-span-3">
            まだAI提案はありません。支出ログがたまっていれば、上のボタンから生成できます。
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-3xl border border-white/10 bg-zinc-950 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[11px] font-semibold text-zinc-300">
                      {categoryLabel(item.category)}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-zinc-100">
                      {statusLabel(item.status)}
                    </span>
                  </div>
                  <div className="mt-2 text-[13px] font-semibold text-zinc-100">{item.title}</div>
                </div>

                <div className="shrink-0 rounded-full border border-white/10 bg-(--app-emerald)/15 px-2 py-1 text-[12px] font-semibold text-(--app-emerald)">
                  +{item.estimatedDeltaDays}日
                </div>
              </div>

              <p className="mt-3 text-[13px] leading-6 text-zinc-400">{item.description}</p>

              <div className="mt-4 grid gap-2 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-[12px] text-zinc-300">
                <div>
                  目安:
                  <span className="ml-2 font-semibold text-zinc-100">
                    {item.recommendedCutFixed !== null
                      ? `固定費 -${item.recommendedCutFixed.toLocaleString()}円/月`
                      : item.recommendedBoostIncome !== null
                        ? `収入 +${item.recommendedBoostIncome.toLocaleString()}円/月`
                        : "守りの行動"}
                  </span>
                </div>
                <div>
                  証明:
                  <span className="ml-2 text-zinc-400">{item.proofHint}</span>
                </div>
              </div>

              <div className="mt-4">
                {item.linkedQuestId ? (
                  <a
                    href={`/quests/${item.linkedQuestId}`}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-black/40 px-4 text-[15px] font-medium text-zinc-100 shadow-sm shadow-black/20"
                  >
                    クエストを開く
                  </a>
                ) : (
                  <form action={startAiTriggerQuest.bind(null, item.id)}>
                    <SubtleButton type="submit" className="w-full">
                      この提案で始める
                    </SubtleButton>
                  </form>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
