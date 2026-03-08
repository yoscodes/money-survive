import type { SolutionLink } from "@/lib/monetization/solutions";

export function SolutionLinkCard({
  link,
  compact = false,
}: {
  link: SolutionLink;
  compact?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-3xl border border-white/10 bg-zinc-950",
        compact ? "p-4" : "p-5",
      ].join(" ")}
    >
      <div className="text-[12px] font-semibold text-zinc-500">提携ソリューション</div>
      <div className="mt-2 text-[13px] font-semibold text-zinc-100">{link.label}</div>
      {link.description ? (
        <p className="mt-2 text-[13px] leading-6 text-zinc-400">{link.description}</p>
      ) : null}

      <div className="mt-4">
        <a
          href={link.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] font-semibold text-zinc-100 hover:border-white/20"
        >
          {link.cta_label?.trim() || "詳細を見る"}
        </a>
      </div>
    </div>
  );
}
