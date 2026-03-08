"use client";

import { useActionState } from "react";
import { signUp, type AuthActionState } from "@/app/(auth)/actions";
import { PrimaryButton, TextInput } from "@/components/ui";
import { AGE_GROUPS, INCOME_BANDS } from "@/lib/social/segment";

const initialState: AuthActionState = { error: null };

export function SignupForm() {
  const [state, action, pending] = useActionState(signUp, initialState);

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
          autoComplete="new-password"
          placeholder="6文字以上"
          required
          minLength={6}
        />
      </label>

      <label className="grid gap-1">
        <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
          年代
        </span>
        <select
          name="age_group"
          required
          defaultValue=""
          className="h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 text-[15px] text-zinc-100 outline-none focus:border-white/20 focus:ring-4 focus:ring-white/10"
        >
          <option value="" disabled>
            年代を選択
          </option>
          {AGE_GROUPS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1">
        <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
          年収帯
        </span>
        <select
          name="income_band"
          required
          defaultValue=""
          className="h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 text-[15px] text-zinc-100 outline-none focus:border-white/20 focus:ring-4 focus:ring-white/10"
        >
          <option value="" disabled>
            年収帯を選択
          </option>
          {INCOME_BANDS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      {state.error ? (
        <div className="rounded-xl border border-white/10 bg-(--app-crimson)/15 px-3 py-2 text-[13px] text-(--app-crimson)">
          {state.error}
        </div>
      ) : null}

      <PrimaryButton type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Creating..." : "Create account"}
      </PrimaryButton>
    </form>
  );
}

