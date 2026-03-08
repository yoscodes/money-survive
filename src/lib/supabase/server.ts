import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

export async function createSupabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components では cookies() が読み取り専用の場合があるため握りつぶす。
          }
        },
      },
    },
  );
}

