import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--app-bg)",
        fg: "var(--app-fg)",
        crimson: "var(--app-crimson)",
        emerald: "var(--app-emerald)",
      },
    },
  },
} satisfies Config;

