export function ProfessionalAdviceCard({
  href,
  title = "プロの助言",
  body = "住宅ローンや高度な資産運用のように、AIだけでは判断しづらい悩みはFPへ相談してください。",
}: {
  href: string | null;
  title?: string;
  body?: string;
}) {
  if (!href) return null;

  return (
    <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
      <div className="text-[12px] font-semibold text-zinc-500">{title}</div>
      <p className="mt-2 text-[13px] leading-6 text-zinc-300">{body}</p>
      <div className="mt-4">
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-[13px] font-semibold text-zinc-100 hover:border-white/20"
        >
          FPに相談予約する
        </a>
      </div>
    </div>
  );
}
