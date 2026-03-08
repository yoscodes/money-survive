import Link from "next/link";
import { SignupForm } from "@/app/(auth)/signup/ui";

export default function SignupPage() {
  return (
    <div className="w-full">
      <div className="rounded-3xl border border-white/10 bg-zinc-950 p-7 shadow-sm shadow-black/30">
        <div className="text-sm font-semibold tracking-tight">Create account</div>
        <p className="mt-2 text-[13px] leading-6 text-zinc-400">
          Supabase Auth（メール/パスワード）で新規登録します。
        </p>

        <div className="mt-6">
          <SignupForm />
        </div>

        <div className="mt-6 text-[13px] text-zinc-400">
          すでにアカウントがある場合は{" "}
          <Link href="/login" className="font-medium text-zinc-100">
            ログイン
          </Link>
        </div>
      </div>
    </div>
  );
}

