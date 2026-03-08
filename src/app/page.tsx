import { createSupabaseServer } from "@/lib/supabase/server";
import { LandingHero } from "@/app/LandingHero";

export default async function Home() {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getUser();

  return <LandingHero signedIn={!!data.user} email={data.user?.email} />;
}
