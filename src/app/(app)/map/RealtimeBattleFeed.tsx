"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/browser";
import type { AgeGroup, BattleFeedItem, IncomeBand } from "@/lib/social/segment";

export function RealtimeBattleFeed({
  initialItems,
  ageGroup,
  incomeBand,
}: {
  initialItems: BattleFeedItem[];
  ageGroup: AgeGroup;
  incomeBand: IncomeBand;
}) {
  const [items, setItems] = useState<BattleFeedItem[]>(initialItems);
  const supabase = useMemo(() => createSupabaseBrowser(), []);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    const channel = supabase
      .channel(`segment-feed:${ageGroup}:${incomeBand}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_quests",
          filter: "status=eq.completed",
        },
        async (payload) => {
          const id =
            typeof payload.new === "object" &&
            payload.new !== null &&
            "id" in payload.new &&
            typeof (payload.new as { id?: unknown }).id === "string"
              ? (payload.new as { id: string }).id
              : null;
          if (!id) return;

          const res = await fetch(`/api/map/feed-event?questId=${encodeURIComponent(id)}`, {
            cache: "no-store",
          });
          if (!res.ok) return;

          const next = (await res.json()) as BattleFeedItem | null;
          if (!next) return;

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
  }, [ageGroup, incomeBand, supabase]);

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-zinc-950 px-4 py-3 text-[13px] text-zinc-400">
        まだ同セグメントの戦友ログはありません。
      </div>
    );
  }

  return (
    <ul className="grid gap-2">
      {items.map((item) => (
        <li key={item.id} className="rounded-3xl border border-white/10 bg-zinc-950 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 text-[13px] leading-6 text-zinc-200">{item.message}</div>
            <span className="shrink-0 text-[12px] text-zinc-500">
              {new Date(item.completedAt).toLocaleString()}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
