"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { PrimaryButton, SubtleButton } from "@/components/ui";

export function LandingHero({
  signedIn,
}: {
  signedIn: boolean;
  email?: string | null;
}) {
  return (
    <div className="min-h-dvh bg-[color:var(--app-bg)] text-[color:var(--app-fg)]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-5 py-16">
        <div className="flex items-center justify-between">
          <div className="font-semibold tracking-tight">money-survive</div>
          <div className="flex items-center gap-2">
            {signedIn ? (
              <Link href="/dashboard">
                <PrimaryButton className="h-10 px-3 text-[13px]">
                  家計簿へ
                </PrimaryButton>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <SubtleButton className="h-10 px-3 text-[13px]">
                    Sign in
                  </SubtleButton>
                </Link>
                <Link href="/signup">
                  <PrimaryButton className="h-10 px-3 text-[13px]">
                    Create account
                  </PrimaryButton>
                </Link>
              </>
            )}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="rounded-3xl border border-white/10 bg-zinc-950 p-8 shadow-sm shadow-black/30"
        >
          <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            お金のログを、気持ちよく続ける。
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-[15px] leading-7 text-zinc-400">
            Next.js + Tailwind CSS + Framer Motion + Supabase で構成した最小構成のサンプル。
            認証・保護ページ・シンプルなCRUD（収支）までひと通り動きます。
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              {
                title: "Supabase Auth",
                body: "メール/パスワードでサインイン。",
              },
              { title: "RLS前提のCRUD", body: "自分のデータだけを読み書き。" },
              { title: "Framer Motion", body: "遷移/カード/リストが滑らか。" },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-white/10 bg-black/40 p-4"
              >
                <div className="text-sm font-medium">{f.title}</div>
                <div className="mt-1 text-[13px] leading-6 text-zinc-400">
                  {f.body}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {signedIn ? (
              <Link href="/dashboard" className="w-full sm:w-auto">
                <PrimaryButton className="w-full sm:w-auto">
                  家計簿へ
                </PrimaryButton>
              </Link>
            ) : (
              <>
                <Link href="/signup" className="w-full sm:w-auto">
                  <PrimaryButton className="w-full sm:w-auto">
                    無料で始める
                  </PrimaryButton>
                </Link>
                <Link href="/login" className="w-full sm:w-auto">
                  <SubtleButton className="w-full sm:w-auto">
                    すでにアカウントがある
                  </SubtleButton>
                </Link>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

