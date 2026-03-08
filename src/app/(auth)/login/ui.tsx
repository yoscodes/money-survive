"use client";

import { useActionState } from "react";
import { signIn, type AuthActionState } from "@/app/(auth)/actions";
import { PrimaryButton, TextInput } from "@/components/ui";

const initialState: AuthActionState = { error: null };

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, initialState);

  return (
    <form action={action} className="grid gap-3">
      <label className="grid gap-1">
        <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
          Email
        </span>
        <TextInput
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
        />
      </label>

      <label className="grid gap-1">
        <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
          Password
        </span>
        <TextInput
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
          minLength={6}
        />
      </label>

      {state.error ? (
        <div className="rounded-xl border border-white/10 bg-[color:var(--app-crimson)]/15 px-3 py-2 text-[13px] text-[color:var(--app-crimson)]">
          {state.error}
        </div>
      ) : null}

      <PrimaryButton type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Signing in..." : "Sign in"}
      </PrimaryButton>
    </form>
  );
}

