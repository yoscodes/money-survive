"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PropsWithChildren } from "react";
import { PageTransition } from "@/components/PageTransition";
import { SubtleButton } from "@/components/ui";
import { signOut } from "@/app/actions";

export function AppShell({
  userEmail,
  isAdmin = false,
  children,
}: PropsWithChildren<{ userEmail?: string | null; isAdmin?: boolean }>) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-(--app-bg) text-(--app-fg)">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-black/50 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-4">
            <Link href="/" className="font-semibold tracking-tight">
              money-survive
            </Link>
            <nav className="hidden items-center gap-1 text-[13px] text-zinc-400 sm:flex">
              <Link
                href="/dashboard"
                data-active={pathname === "/dashboard"}
                className="rounded-lg px-2 py-1 hover:bg-white/10 data-[active=true]:bg-white/10 data-[active=true]:text-zinc-100"
              >
                バディ
              </Link>
              <Link
                href="/map"
                data-active={pathname === "/map"}
                className="rounded-lg px-2 py-1 hover:bg-white/10 data-[active=true]:bg-white/10 data-[active=true]:text-zinc-100"
              >
                ライバル
              </Link>
              <Link
                href="/triggers"
                data-active={pathname === "/triggers"}
                className="rounded-lg px-2 py-1 hover:bg-white/10 data-[active=true]:bg-white/10 data-[active=true]:text-zinc-100"
              >
                トリガー
              </Link>
              <Link
                href="/quests"
                data-active={pathname.startsWith("/quests")}
                className="rounded-lg px-2 py-1 hover:bg-white/10 data-[active=true]:bg-white/10 data-[active=true]:text-zinc-100"
              >
                クエスト
              </Link>
              {isAdmin ? (
                <Link
                  href="/admin/solution-links"
                  data-active={pathname.startsWith("/admin/solution-links")}
                  className="rounded-lg px-2 py-1 hover:bg-white/10 data-[active=true]:bg-white/10 data-[active=true]:text-zinc-100"
                >
                  提携リンク管理
                </Link>
              ) : null}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {userEmail ? (
              <span className="hidden text-[13px] text-zinc-400 sm:inline">
                {userEmail}
              </span>
            ) : null}
            <form action={signOut}>
              <SubtleButton type="submit" className="h-9 px-3 text-[13px]">
                Sign out
              </SubtleButton>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-5 py-10">
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}

