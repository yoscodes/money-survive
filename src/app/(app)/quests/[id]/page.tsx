import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { QuestDetail } from "./ui";
import {
  inferSubcategory,
  loadSolutionLinks,
  pickFpLink,
  pickSolutionLinks,
  type SolutionLink,
} from "@/lib/monetization/solutions";

type UserQuestRow = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: "active" | "completed" | "abandoned";
  template_key: string;
  source: "template" | "ai" | null;
  proof_note: string | null;
  proof_hint: string | null;
  proof_path: string | null;
  proof_mime: string | null;
  reward: unknown;
  recommended_cut_fixed: number | null;
  recommended_boost_income: number | null;
  ai_trigger_id: string | null;
  started_at: string;
  completed_at: string | null;
};

export default async function QuestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { data: userData } = await supabase.auth.getUser();

  const user = userData.user;
  const { data, error } = await supabase
    .from("user_quests")
    .select(
      "id, title, description, category, status, template_key, source, proof_note, proof_hint, proof_path, proof_mime, reward, recommended_cut_fixed, recommended_boost_income, ai_trigger_id, started_at, completed_at",
    )
    .eq("id", id)
    .eq("user_id", user?.id ?? "")
    .single();

  if (error || !data) notFound();
  const q = data as UserQuestRow;
  const { links: solutionLinks } = await loadSolutionLinks(supabase, ["quest_detail", "fp"]);
  const subcategory = inferSubcategory({
    category: q.category,
    title: q.title,
    description: q.description,
    proofHint: q.proof_hint,
  });
  const contextualLinks = pickSolutionLinks(solutionLinks, {
    placement: "quest_detail",
    category:
      q.category === "poison" || q.category === "doping" || q.category === "shield"
        ? q.category
        : "shield",
    subcategory,
    limit: 2,
  });
  const fpLink = pickFpLink(solutionLinks);

  return (
    <div className="grid gap-5">
      <div className="rounded-[28px] border border-white/10 bg-zinc-950 p-7 shadow-sm shadow-black/30">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[12px] font-semibold text-zinc-500">
              Proof of Action
            </div>
            <div className="mt-2 truncate text-lg font-semibold tracking-tight text-zinc-100">
              {q.title}
            </div>
            <div className="mt-2 text-[13px] text-zinc-400">
              ステータス:{" "}
              <span className="font-semibold text-zinc-200">{q.status}</span>
            </div>
          </div>

          <Link
            href="/quests"
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] font-semibold text-zinc-100 hover:border-white/20"
          >
            一覧へ
          </Link>
        </div>

        <div className="mt-6">
          <QuestDetail
            quest={q}
            solutionLinks={contextualLinks as SolutionLink[]}
            fpBookingUrl={fpLink?.url ?? process.env.NEXT_PUBLIC_FP_BOOKING_URL ?? null}
          />
        </div>
      </div>
    </div>
  );
}

