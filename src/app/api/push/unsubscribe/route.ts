import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

type UnsubscribeBody = {
  endpoint?: string;
};

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as UnsubscribeBody;
  const endpoint = body.endpoint?.trim();
  if (!endpoint) {
    return NextResponse.json({ error: "Endpoint is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .update({ disabled_at: new Date().toISOString() })
    .eq("user_id", userData.user.id)
    .eq("endpoint", endpoint);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
