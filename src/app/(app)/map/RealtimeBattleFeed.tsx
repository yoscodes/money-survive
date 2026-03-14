"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserOrNull, hasSupabaseBrowserEnv } from "@/lib/supabase/browser";
import { mapSegmentEventToBattleFeedItem } from "@/lib/social/mapEvents";
import { segmentChannelKey, type AgeGroup, type BattleFeedItem, type IncomeBand } from "@/lib/social/segment";

function formatRelativeTime(value: string, nowMs: number) {
  const targetMs = new Date(value).getTime();
  const diffSeconds = Math.max(0, Math.floor((nowMs - targetMs) / 1000));

  if (diffSeconds < 60) return "たった今";
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}分前`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}時間前`;
  return `${Math.floor(diffSeconds / 86400)}日前`;
}

function categoryLabel(category: BattleFeedItem["category"]) {
  if (category === "poison") return "毒消し";
  if (category === "doping") return "ドーピング";
  return "盾";
}

export function RealtimeBattleFeed({
  initialItems,
  ageGroup,
  incomeBand,
  currentUserId,
}: {
  initialItems: BattleFeedItem[];
  ageGroup: AgeGroup;
  incomeBand: IncomeBand;
  currentUserId: string;
}) {
  const [items, setItems] = useState<BattleFeedItem[]>(initialItems);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const supabase = useMemo(() => createSupabaseBrowserOrNull(), []);
  const realtimeReady = hasSupabaseBrowserEnv();
  const segmentKey = useMemo(() => segmentChannelKey(ageGroup, incomeBand), [ageGroup, incomeBand]);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel(`segment-feed:${segmentKey}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "map_segment_events",
          filter: `segment_key=eq.${segmentKey}`,
        },
        (payload) => {
          const row =
            typeof payload.new === "object" &&
            payload.new !== null &&
            "id" in payload.new
              ? (payload.new as {
                  id: string;
                  user_id?: string;
                  quest_id?: string;
                  title?: string;
                  message?: string;
                  category?: string;
                  completed_at?: string | null;
                  delta_days?: number | null;
                  age_group?: AgeGroup;
                  income_band?: IncomeBand;
                })
              : null;
          if (!row?.id || !row.message || row.user_id === currentUserId) return;
          const next = mapSegmentEventToBattleFeedItem({
            id: row.id,
            user_id: row.user_id ?? "",
            quest_id: row.quest_id ?? row.id,
            title: row.title ?? "",
            message: row.message,
            category: row.category ?? "shield",
            completed_at: row.completed_at ?? null,
            delta_days: row.delta_days ?? 4,
            age_group: row.age_group ?? ageGroup,
            income_band: row.income_band ?? incomeBand,
          });

          setItems((current) => {
            const deduped = current.filter((item) => item.id !== next.id);
            return [next, ...deduped].slice(0, 8);
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [ageGroup, currentUserId, incomeBand, segmentKey, supabase]);

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-zinc-950 px-4 py-3 text-[13px] text-zinc-400">
        まだ同セグメントの戦友ログはありません。
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {!realtimeReady ? (
        <div className="rounded-3xl border border-yellow-400/20 bg-yellow-400/5 px-4 py-3 text-[12px] leading-5 text-yellow-100">
          Realtime は現在オフです。`NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY`
          を反映するため、開発サーバーを再起動してください。
        </div>
      ) : null}

      <ul className="grid gap-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-3xl border border-white/10 bg-zinc-950 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold text-zinc-300">
                {categoryLabel(item.category)}
              </span>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[11px] font-semibold text-emerald-200">
                生存日数 +{item.deltaDays}日
              </span>
              <span className="ml-auto text-[12px] text-zinc-500">
                {formatRelativeTime(item.completedAt, nowMs)}
              </span>
            </div>

            <div className="mt-3 flex items-start justify-between gap-3">
              <div className="min-w-0 text-[13px] leading-6 text-zinc-200">{item.message}</div>
              <span className="shrink-0 text-[11px] text-zinc-600">
                {new Date(item.completedAt).toLocaleTimeString("ja-JP", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
