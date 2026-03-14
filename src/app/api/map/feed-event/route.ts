import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  createBattleFeedItem,
  type AgeGroup,
  type IncomeBand,
  type UserProfile,
} from "@/lib/social/segment";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const questId = searchParams.get("questId");
  if (!questId) {
    return NextResponse.json({ error: "questId is required" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createSupabaseAdmin();
    const { data: me } = await admin
      .from("user_profiles")
      .select("user_id, age_group, income_band")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (!me) return NextResponse.json(null);
    const myProfile = me as UserProfile;

    const { data: quest } = await admin
      .from("user_quests")
      .select(
        "id, user_id, title, category, reward, completed_at, status, recommended_cut_fixed, recommended_boost_income",
      )
      .eq("id", questId)
      .eq("status", "completed")
      .maybeSingle();

    if (!quest) return NextResponse.json(null);
    if (quest.user_id === userData.user.id) return NextResponse.json(null);

    const { data: otherProfile } = await admin
      .from("user_profiles")
      .select("age_group, income_band")
      .eq("user_id", quest.user_id)
      .maybeSingle();

    if (!otherProfile) return NextResponse.json(null);
    if (
      otherProfile.age_group !== myProfile.age_group ||
      otherProfile.income_band !== myProfile.income_band
    ) {
      return NextResponse.json(null);
    }

    return NextResponse.json(
      createBattleFeedItem({
        id: quest.id,
        title: quest.title,
        category: quest.category,
        completed_at: quest.completed_at,
        reward: quest.reward,
        recommended_cut_fixed: quest.recommended_cut_fixed,
        recommended_boost_income: quest.recommended_boost_income,
        age_group: otherProfile.age_group as AgeGroup,
        income_band: otherProfile.income_band as IncomeBand,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "feed lookup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
