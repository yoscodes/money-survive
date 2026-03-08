"use client";

import { motion } from "framer-motion";
import type { ComponentProps } from "react";

export function TextInput(props: ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={[
        "h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 text-[15px] text-zinc-100 outline-none",
        "placeholder:text-zinc-500",
        "focus:border-white/20 focus:ring-4 focus:ring-white/10",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

export function PrimaryButton({
  className,
  ...props
}: ComponentProps<typeof motion.button>) {
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      {...props}
      className={[
        "inline-flex h-11 items-center justify-center rounded-xl bg-[color:var(--app-emerald)] px-4 text-[15px] font-semibold text-black",
        "shadow-sm shadow-black/30",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className ?? "",
      ].join(" ")}
    />
  );
}

export function SubtleButton({
  className,
  ...props
}: ComponentProps<typeof motion.button>) {
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      {...props}
      className={[
        "inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-black/40 px-4 text-[15px] font-medium text-zinc-100",
        "shadow-sm shadow-black/20",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className ?? "",
      ].join(" ")}
    />
  );
}

