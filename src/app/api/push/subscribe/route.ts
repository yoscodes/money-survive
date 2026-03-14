import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

type SubscriptionBody = {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

function isPushSetupError(message: string) {
  return (
    message.includes("push_subscriptions") ||
    message.includes("relation") ||
    message.includes("schema cache") ||
    message.includes("permission denied")
  );
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as SubscriptionBody;
  const endpoint = body.endpoint?.trim();
  const p256dh = body.keys?.p256dh?.trim();
  const auth = body.keys?.auth?.trim();

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userData.user.id,
      user_email: userData.user.email ?? null,
      endpoint,
      p256dh,
      auth,
      user_agent: request.headers.get("user-agent"),
      last_seen_at: new Date().toISOString(),
      disabled_at: null,
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    if (isPushSetupError(error.message)) {
      return NextResponse.json(
        {
          ok: false,
          disabled: true,
          reason: "push_subscriptions table is not ready",
        },
        { status: 200 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
