import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? "";
}

export function isAdminEmail(email: string | null | undefined) {
  const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL);
  if (!adminEmail) return false;
  return normalizeEmail(email) === adminEmail;
}

export async function requireAdminUser() {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) redirect("/dashboard");

  return { supabase, user };
}
