import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/admin/guard";
import {
  SOLUTION_CATEGORIES,
  SOLUTION_PLACEMENTS,
  SOLUTION_SUBCATEGORIES,
  type SolutionLink,
} from "@/lib/monetization/solutions";
import {
  createSolutionLink,
  toggleSolutionLink,
  updateSolutionLink,
} from "./actions";

type SearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(
  searchParams: SearchParams | undefined,
  key: string,
) {
  const value = searchParams?.[key];
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function InputLabel({ title }: { title: string }) {
  return <span className="text-[12px] font-semibold text-zinc-500">{title}</span>;
}

export default async function SolutionLinksAdminPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireAdminUser();
  const params = searchParams ? await searchParams : undefined;
  const success = readSearchParam(params, "success");
  const error = readSearchParam(params, "error");

  const admin = createSupabaseAdmin();
  const { data, error: queryError } = await admin
    .from("solution_links")
    .select(
      "id, placement, category, subcategory, label, description, url, cta_label, priority, is_active, created_at",
    )
    .order("priority", { ascending: true });

  const items = ((data ?? []) as Array<
    SolutionLink & { created_at?: string | null }
  >) ?? [];

  return (
    <div className="grid gap-5">
      <div className="rounded-[28px] border border-white/10 bg-zinc-950 p-7 shadow-sm shadow-black/30">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold tracking-tight">
              提携リンク管理
            </div>
            <p className="mt-2 max-w-2xl text-[13px] leading-6 text-zinc-400">
              `solution_links` をアプリ内から更新します。削除はせず、まずは有効/無効の切り替えで運用します。
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-[12px] text-zinc-300">
            登録数: {items.length}
          </div>
        </div>

        {success ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-(--app-emerald)/15 px-4 py-3 text-[13px] text-zinc-100">
            {success}
          </div>
        ) : null}
        {error ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-(--app-crimson)/10 px-4 py-3 text-[13px] text-zinc-200">
            {error}
          </div>
        ) : null}
        {queryError ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-(--app-crimson)/10 px-4 py-3 text-[13px] text-zinc-200">
            {queryError.message}
          </div>
        ) : null}

        <section className="mt-6 rounded-3xl border border-white/10 bg-black/30 p-6">
          <div className="text-[12px] font-semibold text-zinc-500">新規追加</div>
          <div className="mt-2 text-sm font-semibold tracking-tight text-zinc-100">
            新しい提携リンクを登録する
          </div>
          <SolutionLinkForm action={createSolutionLink} submitLabel="追加する" />
        </section>

        <section className="mt-6 rounded-3xl border border-white/10 bg-black/30 p-6">
          <div className="text-[12px] font-semibold text-zinc-500">既存リンク</div>
          <div className="mt-2 text-sm font-semibold tracking-tight text-zinc-100">
            既存の導線を編集する
          </div>

          {items.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3 text-[13px] text-zinc-400">
              まだ提携リンクはありません。
            </div>
          ) : (
            <div className="mt-5 grid gap-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-3xl border border-white/10 bg-zinc-950 p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge label={item.placement} />
                      <Badge label={item.category} />
                      <Badge label={item.subcategory ?? "subなし"} />
                      <Badge label={`priority:${item.priority}`} />
                      <Badge label={item.is_active ? "active" : "inactive"} />
                    </div>

                    <form action={toggleSolutionLink.bind(null, item.id, !item.is_active)}>
                      <button
                        type="submit"
                        className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] font-semibold text-zinc-100 hover:border-white/20"
                      >
                        {item.is_active ? "無効化" : "有効化"}
                      </button>
                    </form>
                  </div>

                  <SolutionLinkForm
                    action={updateSolutionLink}
                    submitLabel="更新する"
                    initial={item}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SolutionLinkForm({
  action,
  submitLabel,
  initial,
}: {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  initial?: SolutionLink;
}) {
  return (
    <form action={action} className="mt-5 grid gap-4">
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <label className="grid gap-1">
          <InputLabel title="placement" />
          <select
            name="placement"
            defaultValue={initial?.placement ?? "triggers"}
            className="h-11 rounded-xl border border-white/10 bg-black/40 px-3 text-[14px] text-zinc-100 outline-none focus:ring-4 focus:ring-white/10"
          >
            {SOLUTION_PLACEMENTS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1">
          <InputLabel title="category" />
          <select
            name="category"
            defaultValue={initial?.category ?? "poison"}
            className="h-11 rounded-xl border border-white/10 bg-black/40 px-3 text-[14px] text-zinc-100 outline-none focus:ring-4 focus:ring-white/10"
          >
            {SOLUTION_CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1">
          <InputLabel title="subcategory" />
          <select
            name="subcategory"
            defaultValue={initial?.subcategory ?? ""}
            className="h-11 rounded-xl border border-white/10 bg-black/40 px-3 text-[14px] text-zinc-100 outline-none focus:ring-4 focus:ring-white/10"
          >
            <option value="">なし</option>
            {SOLUTION_SUBCATEGORIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="grid gap-1">
          <InputLabel title="label" />
          <input
            name="label"
            defaultValue={initial?.label ?? ""}
            required
            className="h-11 rounded-xl border border-white/10 bg-black/40 px-3 text-[14px] text-zinc-100 outline-none focus:ring-4 focus:ring-white/10"
          />
        </label>

        <label className="grid gap-1">
          <InputLabel title="cta_label" />
          <input
            name="cta_label"
            defaultValue={initial?.cta_label ?? ""}
            className="h-11 rounded-xl border border-white/10 bg-black/40 px-3 text-[14px] text-zinc-100 outline-none focus:ring-4 focus:ring-white/10"
          />
        </label>
      </div>

      <label className="grid gap-1">
        <InputLabel title="description" />
        <textarea
          name="description"
          defaultValue={initial?.description ?? ""}
          rows={3}
          className="rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-[14px] text-zinc-100 outline-none focus:ring-4 focus:ring-white/10"
        />
      </label>

      <div className="grid gap-4 lg:grid-cols-[1fr,140px,140px]">
        <label className="grid gap-1">
          <InputLabel title="url" />
          <input
            name="url"
            type="url"
            defaultValue={initial?.url ?? ""}
            required
            className="h-11 rounded-xl border border-white/10 bg-black/40 px-3 text-[14px] text-zinc-100 outline-none focus:ring-4 focus:ring-white/10"
          />
        </label>

        <label className="grid gap-1">
          <InputLabel title="priority" />
          <input
            name="priority"
            type="number"
            min="0"
            defaultValue={String(initial?.priority ?? 100)}
            className="h-11 rounded-xl border border-white/10 bg-black/40 px-3 text-[14px] text-zinc-100 outline-none focus:ring-4 focus:ring-white/10"
          />
        </label>

        <label className="flex items-center gap-2 pt-6 text-[14px] text-zinc-300">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={initial?.is_active ?? true}
          />
          active
        </label>
      </div>

      <div>
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-(--app-emerald) px-4 text-[15px] font-semibold text-black shadow-sm shadow-black/30"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[11px] font-semibold text-zinc-300">
      {label}
    </span>
  );
}
