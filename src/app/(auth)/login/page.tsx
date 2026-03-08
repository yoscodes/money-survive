import Link from "next/link";
import { LoginForm } from "@/app/(auth)/login/ui";

export default function LoginPage() {
  return (
    <div className="w-full">
      <div className="rounded-3xl border border-white/10 bg-zinc-950 p-7 shadow-sm shadow-black/30">
        <div className="text-sm font-semibold tracking-tight">Sign in</div>
        <p className="mt-2 text-[13px] leading-6 text-zinc-400">
          Supabase Auth（メール/パスワード）でログインします。
        </p>

        <div className="mt-6">
          <LoginForm />
        </div>

        <div className="mt-6 text-[13px] text-zinc-400">
          アカウントがない場合は{" "}
          <Link href="/signup" className="font-medium text-zinc-100">
            新規登録
          </Link>
        </div>
      </div>
    </div>
  );
}

