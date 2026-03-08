"use client";

import { motion } from "framer-motion";

export type BuddyRisk = "unknown" | "danger" | "warn" | "safe";
export type BuddyWealth = "broke" | "tight" | "ok" | "rich";
export type BuddyGear = {
  shield?: "basic" | "ironwall";
  armor?: boolean;
};

export function wealthFromSavings(savings: number): BuddyWealth {
  const s = Math.max(0, savings);
  if (s < 50_000) return "broke";
  if (s < 200_000) return "tight";
  if (s < 1_000_000) return "ok";
  return "rich";
}

function colors(risk: BuddyRisk, wealth: BuddyWealth) {
  const base = {
    skin: "#caa38e",
    outline: "rgba(255,255,255,0.12)",
    ink: "rgba(255,255,255,0.85)",
    muted: "rgba(255,255,255,0.55)",
    bg: "rgba(0,0,0,0.35)",
  };

  const suit =
    wealth === "rich"
      ? { main: "rgba(16,185,129,0.25)", edge: "rgba(16,185,129,0.65)" }
      : wealth === "ok"
        ? { main: "rgba(255,255,255,0.14)", edge: "rgba(255,255,255,0.35)" }
        : wealth === "tight"
          ? { main: "rgba(220,20,60,0.14)", edge: "rgba(220,20,60,0.35)" }
          : { main: "rgba(220,20,60,0.18)", edge: "rgba(220,20,60,0.55)" };

  const visor =
    risk === "danger"
      ? "rgba(220,20,60,0.22)"
      : risk === "warn"
        ? "rgba(255,255,255,0.12)"
        : "rgba(16,185,129,0.16)";

  return { ...base, suit, visor };
}

export function BuddyAvatar({
  risk,
  wealth,
  gear,
  className,
}: {
  risk: BuddyRisk;
  wealth: BuddyWealth;
  gear?: BuddyGear;
  className?: string;
}) {
  const c = colors(risk, wealth);
  const easeInOut = [0.42, 0, 0.58, 1] as const;

  const blink =
    risk === "danger"
      ? {
          scaleY: [1, 1, 0.1, 1],
          transition: { duration: 0.12, repeat: Infinity, repeatDelay: 2.4 },
        }
      : {
          scaleY: [1, 1, 0.1, 1],
          transition: { duration: 0.12, repeat: Infinity, repeatDelay: 3.8 },
        };

  const breathe = {
    y: [0, -1.2, 0],
    transition: { duration: 2.4, repeat: Infinity, ease: easeInOut },
  };

  const sweat = risk === "danger" || risk === "warn";
  const torn = wealth === "broke";
  const patched = wealth === "tight" || wealth === "broke";
  const sparkle = wealth === "rich" && risk !== "danger";
  const cape = wealth === "rich" && risk !== "danger";
  const scuffed = risk === "warn";
  const shield = gear?.shield ?? "none";
  const armor = !!gear?.armor;

  return (
    <motion.svg
      aria-label="buddy"
      role="img"
      viewBox="0 0 240 240"
      className={className}
      animate={breathe}
    >
      <defs>
        <radialGradient id="aura" cx="50%" cy="40%" r="60%">
          <stop
            offset="0%"
            stopColor={
              risk === "danger"
                ? "rgba(220,20,60,0.45)"
                : risk === "warn"
                  ? "rgba(255,255,255,0.16)"
                  : "rgba(16,185,129,0.40)"
            }
          />
          <stop offset="70%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
        <linearGradient id="visor" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c.visor} />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </linearGradient>
        <linearGradient id="suit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c.suit.edge} />
          <stop offset="100%" stopColor={c.suit.main} />
        </linearGradient>
      </defs>

      {/* aura */}
      <circle cx="120" cy="118" r="96" fill="url(#aura)" />

      {/* shadow plate */}
      <ellipse cx="120" cy="206" rx="62" ry="16" fill="rgba(0,0,0,0.55)" />

      {/* body */}
      <g>
        {/* cape (rich) */}
        {cape ? (
          <path
            d="M70 132c10-22 32-34 50-34s40 12 50 34c-12 6-30 12-50 12s-38-6-50-12z"
            fill="rgba(16,185,129,0.12)"
            stroke="rgba(16,185,129,0.35)"
          />
        ) : null}

        {/* backpack */}
        <path
          d="M62 138c0-30 20-54 46-54h24c26 0 46 24 46 54v28c0 14-10 26-24 28l-34 5-34-5c-14-2-24-14-24-28v-28z"
          fill="rgba(0,0,0,0.40)"
          stroke={c.outline}
        />

        {/* suit */}
        <path
          d="M78 144c0-22 18-40 40-40h4c22 0 40 18 40 40v36c0 14-10 26-24 28l-18 3-18-3c-14-2-24-14-24-28v-36z"
          fill="url(#suit)"
          stroke={c.outline}
        />

        {/* armor plate (quest reward) */}
        {armor ? (
          <g>
            <path
              d="M102 148c10-8 26-8 36 0 6 4 10 10 10 18v24c0 8-6 14-14 16l-14 3-14-3c-8-2-14-8-14-16v-24c0-8 4-14 10-18z"
              fill="rgba(255,255,255,0.06)"
              stroke="rgba(255,255,255,0.18)"
            />
            <path
              d="M120 154v48"
              stroke="rgba(255,255,255,0.14)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
        ) : null}

        {/* torn edges (broke) */}
        {torn ? (
          <g opacity="0.95">
            <path
              d="M86 192l10-8 7 10 10-9 9 10 10-9 7 10 10-8"
              fill="none"
              stroke="rgba(220,20,60,0.55)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M96 140c-2 10 6 12 2 20"
              fill="none"
              stroke="rgba(220,20,60,0.35)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
        ) : null}

        {/* patches (tight/broke) */}
        {patched ? (
          <g>
            <rect
              x="92"
              y="156"
              width="22"
              height="18"
              rx="6"
              fill="rgba(255,255,255,0.06)"
              stroke="rgba(255,255,255,0.18)"
            />
            <path
              d="M96 160l14 10"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M110 160l-14 10"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
        ) : null}

        {/* belt */}
        <path
          d="M88 180h64"
          stroke="rgba(0,0,0,0.50)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <rect
          x="114"
          y="176"
          width="12"
          height="10"
          rx="3"
          fill="rgba(255,255,255,0.10)"
          stroke={c.outline}
        />

        {/* medal (rich) */}
        {wealth === "rich" ? (
          <g>
            <circle
              cx="146"
              cy="160"
              r="8"
              fill="rgba(16,185,129,0.18)"
              stroke="rgba(16,185,129,0.45)"
            />
            <path
              d="M144 151l-6-10 8 2 6-2-6 10"
              fill="rgba(16,185,129,0.16)"
              stroke="rgba(16,185,129,0.35)"
              strokeLinejoin="round"
            />
          </g>
        ) : null}

        {/* shield icon (quest reward) */}
        {shield !== "none" ? (
          <g>
            <path
              d="M86 166c8-6 16-8 22-8s14 2 22 8v16c0 10-8 18-22 24-14-6-22-14-22-24v-16z"
              fill={
                shield === "ironwall"
                  ? "rgba(16,185,129,0.22)"
                  : "rgba(255,255,255,0.10)"
              }
              stroke={
                shield === "ironwall"
                  ? "rgba(16,185,129,0.55)"
                  : "rgba(255,255,255,0.22)"
              }
            />
            <path
              d="M108 168v34"
              stroke={
                shield === "ironwall"
                  ? "rgba(16,185,129,0.35)"
                  : "rgba(255,255,255,0.18)"
              }
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
        ) : null}
      </g>

      {/* head + helmet */}
      <g>
        <path
          d="M120 54c34 0 62 26 62 58 0 30-22 56-52 60h-20c-30-4-52-30-52-60 0-32 28-58 62-58z"
          fill="rgba(0,0,0,0.40)"
          stroke={c.outline}
        />
        <path
          d="M120 64c28 0 50 20 50 46 0 24-18 44-42 47h-16c-24-3-42-23-42-47 0-26 22-46 50-46z"
          fill="rgba(255,255,255,0.06)"
          stroke={c.outline}
        />

        {/* visor */}
        <path
          d="M86 110c10-18 44-22 68-10 10 5 16 11 18 18-8 10-22 16-40 18-24 3-45-4-46-26z"
          fill="url(#visor)"
          stroke={c.outline}
        />

        {/* face */}
        <circle cx="120" cy="120" r="26" fill={c.skin} opacity="0.95" />

        {/* eyes */}
        <g>
          <motion.g
            style={{ originX: "108px", originY: "118px" }}
            animate={blink}
          >
            <circle cx="108" cy="118" r="3.2" fill="rgba(0,0,0,0.55)" />
          </motion.g>
          <motion.g
            style={{ originX: "132px", originY: "118px" }}
            animate={blink}
          >
            <circle cx="132" cy="118" r="3.2" fill="rgba(0,0,0,0.55)" />
          </motion.g>
        </g>

        {/* mouth */}
        <path
          d={
            risk === "danger"
              ? "M110 135c6 6 14 6 20 0"
              : risk === "warn"
                ? "M112 136c6 3 10 3 16 0"
                : "M112 134c8 6 8 6 16 0"
          }
          fill="none"
          stroke="rgba(0,0,0,0.50)"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* bandage / dirt (broke) */}
        {wealth === "broke" ? (
          <g>
            <rect
              x="97"
              y="126"
              width="20"
              height="10"
              rx="4"
              fill="rgba(255,255,255,0.20)"
              stroke="rgba(255,255,255,0.25)"
            />
            <path
              d="M101 131h12"
              stroke="rgba(0,0,0,0.25)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="138" cy="134" r="3" fill="rgba(0,0,0,0.18)" />
            <circle cx="130" cy="140" r="2.5" fill="rgba(0,0,0,0.14)" />
          </g>
        ) : null}

        {/* crack on helmet (danger) */}
        {risk === "danger" ? (
          <path
            d="M150 78l-10 10 8 10-12 8 8 10"
            fill="none"
            stroke="rgba(220,20,60,0.55)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {/* scuffs (warn) */}
        {scuffed ? (
          <g opacity="0.7">
            <path
              d="M84 98l10 4"
              stroke="rgba(255,255,255,0.22)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M160 104l-12 6"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
        ) : null}

        {/* sweat */}
        {sweat ? (
          <g opacity={risk === "danger" ? 0.95 : 0.6}>
            <path
              d="M154 118c6 8 4 18-2 22-6-4-10-14-6-22 2-4 4-6 8 0z"
              fill="rgba(120,200,255,0.22)"
              stroke="rgba(255,255,255,0.12)"
            />
          </g>
        ) : null}
      </g>

      {/* rich sparkle */}
      {sparkle ? (
        <g>
          {[
            { x: 54, y: 86, s: 1 },
            { x: 188, y: 96, s: 0.9 },
            { x: 170, y: 58, s: 0.7 },
          ].map((p, i) => (
            <motion.g
              key={i}
              initial={{ opacity: 0.2, scale: 0.9 }}
              animate={{ opacity: [0.2, 0.8, 0.2], scale: [0.9, 1.05, 0.9] }}
              transition={{
                duration: 2.2 + i * 0.3,
                repeat: Infinity,
                ease: easeInOut,
              }}
              transform={`translate(${p.x} ${p.y}) scale(${p.s})`}
            >
              <path
                d="M0 8l4-4 4 4-4 4-4-4zm4-8l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z"
                fill="rgba(16,185,129,0.55)"
              />
            </motion.g>
          ))}
        </g>
      ) : null}

      {/* label */}
      <text
        x="120"
        y="232"
        textAnchor="middle"
        fontSize="12"
        fill={c.muted}
        style={{ letterSpacing: "0.04em" }}
      >
        BUDDY
      </text>
    </motion.svg>
  );
}

