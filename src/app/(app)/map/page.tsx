import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { RivalBenchmark } from "./RivalBenchmark";
import type { Transaction } from "../dashboard/types";
import {
  createBattleFeedItem,
  type BattleFeedItem,
  type SegmentBenchmark,
  type UserProfile,
} from "@/lib/social/segment";
import { buildFinanceSnapshot } from "@/lib/finance/insights";

export default async function MapPage() {
  const supabase = await createSupabaseServer();
  const { data: userData } = await supabase.auth.getUser();
  const admin = createSupabaseAdmin();

  const user = userData.user;
  const { data } = await supabase
    .from("transactions")
    .select("id, created_at, type, amount, note")
    .eq("user_id", user?.id ?? "")
    .order("created_at", { ascending: false })
    .limit(200);

  const items = ((data ?? []) as Transaction[]) ?? [];
  const snapshot = buildFinanceSnapshot(items);

  const { data: profileData } = await admin
    .from("user_profiles")
    .select("user_id, age_group, income_band, created_at, updated_at")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();

  const profile = (profileData as UserProfile | null) ?? null;

  let benchmark: SegmentBenchmark | null = null;
  let rpcError: string | null = null;
  let initialFeed: BattleFeedItem[] = [];

  if (user?.id && profile) {
    const { data: rpcData, error: benchmarkError } = await admin.rpc("get_segment_benchmark", {
      p_user_id: user.id,
      p_age_group: profile.age_group,
      p_income_band: profile.income_band,
    });

    if (benchmarkError) {
      rpcError = benchmarkError.message;
    } else {
      const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      benchmark = (row as SegmentBenchmark | null) ?? null;
    }

    const { data: profileRows } = await admin
      .from("user_profiles")
      .select("user_id, age_group, income_band")
      .eq("age_group", profile.age_group)
      .eq("income_band", profile.income_band)
      .limit(200);

    const segmentUserIds = ((profileRows ?? []) as Array<{ user_id: string }>)
      .map((row) => row.user_id)
      .filter((id) => id !== user.id);

    if (segmentUserIds.length > 0) {
      const { data: feedRows } = await admin
        .from("user_quests")
        .select("id, user_id, title, category, reward, completed_at, status")
        .in("user_id", segmentUserIds)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(8);

      initialFeed = (((feedRows ?? []) as Array<{
        id: string;
        user_id: string;
        title: string;
        category: string;
        reward: unknown;
        completed_at: string | null;
        status: string;
      }>) ?? [])
        .map((row) =>
          createBattleFeedItem({
            id: row.id,
            title: row.title,
            category: row.category,
            reward: row.reward,
            completed_at: row.completed_at,
            age_group: profile.age_group,
            income_band: profile.income_band,
          }),
        );
    }
  }

  return (
    <RivalBenchmark
      profile={profile}
      benchmark={benchmark}
      rpcError={rpcError}
      snapshot={snapshot}
      initialFeed={initialFeed}
    />
  );
}

