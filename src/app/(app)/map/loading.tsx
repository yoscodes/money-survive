export default function Loading() {
  return (
    <div className="grid gap-5">
      <div className="rounded-[28px] border border-white/10 bg-zinc-950 p-7 shadow-sm shadow-black/30">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid gap-3">
            <div className="h-4 w-48 animate-pulse rounded-full bg-white/10" />
            <div className="h-3 w-80 max-w-full animate-pulse rounded-full bg-white/10" />
            <div className="h-3 w-72 max-w-full animate-pulse rounded-full bg-white/10" />
          </div>
          <div className="h-11 w-40 animate-pulse rounded-xl bg-white/10" />
        </div>

        <div className="mt-6 grid gap-5">
          <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
            <div className="flex gap-2">
              <div className="h-9 w-24 animate-pulse rounded-xl bg-white/10" />
              <div className="h-9 w-28 animate-pulse rounded-xl bg-white/10" />
              <div className="h-9 w-32 animate-pulse rounded-xl bg-white/10" />
            </div>
            <div className="mt-5 h-[360px] animate-pulse rounded-[24px] bg-white/5" />
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.1fr,0.9fr]">
            <div className="grid gap-5">
              <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="h-32 animate-pulse rounded-3xl bg-white/5" />
                  <div className="h-32 animate-pulse rounded-3xl bg-white/5" />
                  <div className="h-32 animate-pulse rounded-3xl bg-white/5" />
                </div>
              </div>
              <div className="h-56 animate-pulse rounded-3xl border border-white/10 bg-black/30" />
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
              <div className="grid gap-2">
                <div className="h-20 animate-pulse rounded-3xl bg-white/5" />
                <div className="h-20 animate-pulse rounded-3xl bg-white/5" />
                <div className="h-20 animate-pulse rounded-3xl bg-white/5" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
