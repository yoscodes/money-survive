import type { PropsWithChildren } from "react";
import { PageTransition } from "@/components/PageTransition";

export default function AuthLayout({ children }: PropsWithChildren) {
  return (
    <div className="min-h-dvh bg-[color:var(--app-bg)] text-[color:var(--app-fg)]">
      <div className="mx-auto flex min-h-dvh w-full max-w-md items-center px-5 py-10">
        <PageTransition>{children}</PageTransition>
      </div>
    </div>
  );
}

