import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function hasSupabaseBrowserEnv() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function createSupabaseBrowser() {
  if (!supabaseUrl) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseAnonKey) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createBrowserClient(
    supabaseUrl,
    supabaseAnonKey,
  );
}

export function createSupabaseBrowserOrNull() {
  if (!hasSupabaseBrowserEnv()) return null;
  return createSupabaseBrowser();
}

