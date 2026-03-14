# money-survive

Next.js（App Router） + Tailwind CSS + Framer Motion + Supabase の最小構成サンプルです。

- **Auth**: Supabase Auth（メール/パスワード）
- **Protected route**: `/dashboard` はログイン必須
- **CRUD**: `transactions` テーブル（RLS前提）
- **Motion**: 画面遷移/リストのアニメーション

## セットアップ

### 1) Supabase プロジェクト作成

Supabaseでプロジェクトを作り、以下を取得します。

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2) 環境変数

`.env.local.example` をコピーして `.env.local` を作成し、値を設定してください。

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@example.com
CRON_SECRET=...
RESEND_API_KEY=...
RESEND_FROM_EMAIL=onboarding@resend.dev
NEXT_PUBLIC_FP_BOOKING_URL=...
ADMIN_EMAIL=...
```

Web Push を使う場合は、以下で VAPID 鍵を作成してください。

```bash
npx web-push generate-vapid-keys
```

### 3) DB（transactions）を作成

Supabase の SQL Editor で実行してください。

```sql
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  amount numeric not null check (amount > 0),
  note text,
  created_at timestamptz not null default now()
);

alter table public.transactions enable row level security;

create policy "transactions_select_own"
on public.transactions
for select
using (auth.uid() = user_id);

create policy "transactions_insert_own"
on public.transactions
for insert
with check (auth.uid() = user_id);

create policy "transactions_update_own"
on public.transactions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "transactions_delete_own"
on public.transactions
for delete
using (auth.uid() = user_id);
```

### 4) DB（user_quests）を作成（Proof of Action）

`/triggers` の「クエストを開始する」や `/quests` を動かすために必要です。

```sql
create table if not exists public.user_quests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  template_key text not null,
  title text not null,
  description text,
  category text not null check (category in ('poison', 'doping', 'shield')),
  status text not null check (status in ('active', 'completed', 'abandoned')),
  source text not null default 'template' check (source in ('template', 'ai')),

  reward jsonb not null default '{}'::jsonb,
  recommended_cut_fixed integer,
  recommended_boost_income integer,

  proof_note text,
  proof_hint text,
  proof_path text,
  proof_mime text,
  ai_trigger_id uuid,

  started_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.user_quests enable row level security;

create policy "user_quests_select_own"
on public.user_quests
for select
using (auth.uid() = user_id);

create policy "user_quests_insert_own"
on public.user_quests
for insert
with check (auth.uid() = user_id);

create policy "user_quests_update_own"
on public.user_quests
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "user_quests_delete_own"
on public.user_quests
for delete
using (auth.uid() = user_id);
```

既存テーブルがある場合は、以下の `alter table` でも追記できます。

```sql
alter table public.user_quests
  add column if not exists description text,
  add column if not exists source text not null default 'template' check (source in ('template', 'ai')),
  add column if not exists proof_hint text,
  add column if not exists ai_trigger_id uuid;
```

### 5) DB（ai_triggers）を作成（AI家計診断の提案保存）

`/quests` の「AI家計診断」を動かすために必要です。

```sql
create table if not exists public.ai_triggers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null,
  category text not null check (category in ('poison', 'doping', 'shield')),
  proof_hint text not null,
  recommended_cut_fixed integer,
  recommended_boost_income integer,
  estimated_delta_days integer not null default 5,
  status text not null default 'generated' check (status in ('generated', 'started', 'completed', 'abandoned')),
  source_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ai_triggers enable row level security;

create policy "ai_triggers_select_own"
on public.ai_triggers
for select
using (auth.uid() = user_id);

create policy "ai_triggers_insert_own"
on public.ai_triggers
for insert
with check (auth.uid() = user_id);

create policy "ai_triggers_update_own"
on public.ai_triggers
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "ai_triggers_delete_own"
on public.ai_triggers
for delete
using (auth.uid() = user_id);
```

### 6) Storage（proofs）を作成（証拠スクショのアップロード）

`/quests/[id]` でスクショ等をアップロードするために必要です。

1. Supabase の Storage で **`proofs`** バケットを作成（推奨: Private）
2. SQL Editor でポリシーを追加

```sql
-- 自分の uid フォルダ配下のみアクセス可
-- 例: proofs/<uid>/<questId>/... にアップロードされます

create policy "proofs_select_own_folder"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'proofs'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "proofs_insert_own_folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'proofs'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "proofs_update_own_folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'proofs'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'proofs'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "proofs_delete_own_folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'proofs'
  and auth.uid()::text = (storage.foldername(name))[1]
);
```

### 7) DB（push_subscriptions）を作成（Web Push購読）

Web Push 通知を送るために必要です。

```sql
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  last_seen_at timestamptz not null default now(),
  disabled_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_select_own"
on public.push_subscriptions
for select
using (auth.uid() = user_id);

create policy "push_subscriptions_insert_own"
on public.push_subscriptions
for insert
with check (auth.uid() = user_id);

create policy "push_subscriptions_update_own"
on public.push_subscriptions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "push_subscriptions_delete_own"
on public.push_subscriptions
for delete
using (auth.uid() = user_id);
```

### 8) DB（notification_events）を作成（通知履歴）

即時通知と週次レポートの重複防止、配信ログ保存に使います。

```sql
create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('immediate_survival', 'immediate_waste', 'weekly_report')),
  channel text not null check (channel in ('push', 'email_stub')),
  status text not null check (status in ('sent', 'failed', 'skipped')),
  dedupe_key text not null,
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.notification_events enable row level security;

create policy "notification_events_select_own"
on public.notification_events
for select
using (auth.uid() = user_id);

create policy "notification_events_insert_own"
on public.notification_events
for insert
with check (auth.uid() = user_id);

create policy "notification_events_update_own"
on public.notification_events
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

### 9) 週次レポートのCron設定

毎週月曜日に次の endpoint を叩くと、Push とメールスタブの週次レポートが実行されます。

```bash
curl -X POST "http://localhost:3000/api/cron/weekly-report" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -X POST "http://localhost:3000/api/cron/monthly-report" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -X POST "http://localhost:3000/api/cron/liveness-pulse" \
  -H "Authorization: Bearer $CRON_SECRET"
```

本番では Vercel Cron や外部 Cron から同じように叩いてください。

### 10) DB（user_profiles）を作成（比較用プロフィール）

`/map` の実データ比較に必要です。新規登録時に `age_group` と `income_band` を保存します。

```sql
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  age_group text not null check (age_group in ('20代', '30代', '40代', '50代', '60代+')),
  income_band text not null check (income_band in ('300万層', '400万層', '500万層', '600万層', '700万層+')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy "user_profiles_select_own"
on public.user_profiles
for select
using (auth.uid() = user_id);

create policy "user_profiles_insert_own"
on public.user_profiles
for insert
with check (auth.uid() = user_id);

create policy "user_profiles_update_own"
on public.user_profiles
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

既存ユーザーに対しては、必要に応じて手動で1件ずつ作成してください。

```sql
insert into public.user_profiles (user_id, age_group, income_band)
values ('<your-user-id>', '30代', '400万層')
on conflict (user_id) do update
set
  age_group = excluded.age_group,
  income_band = excluded.income_band,
  updated_at = now();
```

### 11) RPC（匿名セグメント集計）を作成

`/map` で同年代・同年収帯の平均値と順位を出すための関数です。

```sql
create or replace function public.get_segment_benchmark(
  p_user_id uuid,
  p_age_group text,
  p_income_band text
)
returns table (
  segment_size integer,
  avg_savings numeric,
  avg_survival_days numeric,
  avg_monthly_expense numeric,
  my_savings numeric,
  my_survival_days integer,
  my_avg_monthly_expense numeric,
  my_rank integer,
  poison_completed integer,
  doping_completed integer,
  shield_completed integer
)
language sql
security definer
set search_path = public
as $$
with segment_users as (
  select up.user_id
  from public.user_profiles up
  where up.age_group = p_age_group
    and up.income_band = p_income_band
),
tx_base as (
  select
    su.user_id,
    t.type,
    t.amount,
    t.created_at
  from segment_users su
  left join public.transactions t
    on t.user_id = su.user_id
),
tx_rollup as (
  select
    user_id,
    coalesce(sum(case when type = 'income' then amount else -amount end), 0) as savings,
    coalesce(sum(case when type = 'expense' and created_at >= now() - interval '90 day' then amount else 0 end), 0) as expense_90
  from tx_base
  group by user_id
),
metrics as (
  select
    user_id,
    savings,
    case when expense_90 > 0 then (expense_90 / 90.0) * 30 else null end as avg_monthly_expense,
    case
      when expense_90 > 0
        then greatest(0, floor((greatest(0, savings) / ((expense_90 / 90.0) * 30)) * 30))::int
      else null
    end as survival_days
  from tx_rollup
),
ranks as (
  select
    m.*,
    row_number() over (order by m.savings desc nulls last) as savings_rank
  from metrics m
),
quest_rollup as (
  select
    q.user_id,
    count(*) filter (where q.status = 'completed' and q.category = 'poison')::int as poison_completed,
    count(*) filter (where q.status = 'completed' and q.category = 'doping')::int as doping_completed,
    count(*) filter (where q.status = 'completed' and q.category = 'shield')::int as shield_completed
  from public.user_quests q
  where q.user_id in (select user_id from segment_users)
  group by q.user_id
)
select
  count(*)::int as segment_size,
  avg(r.savings) as avg_savings,
  avg(r.survival_days) as avg_survival_days,
  avg(r.avg_monthly_expense) as avg_monthly_expense,
  max(case when r.user_id = p_user_id then r.savings end) as my_savings,
  max(case when r.user_id = p_user_id then r.survival_days end) as my_survival_days,
  max(case when r.user_id = p_user_id then r.avg_monthly_expense end) as my_avg_monthly_expense,
  max(case when r.user_id = p_user_id then r.savings_rank end)::int as my_rank,
  coalesce(sum(q.poison_completed), 0)::int as poison_completed,
  coalesce(sum(q.doping_completed), 0)::int as doping_completed,
  coalesce(sum(q.shield_completed), 0)::int as shield_completed
from ranks r
left join quest_rollup q on q.user_id = r.user_id;
$$;

grant execute on function public.get_segment_benchmark(uuid, text, text) to authenticated;
```

### 12) Realtime（戦友フィード）を有効化

`/map` の戦友フィードは、`user_quests` を全件監視する代わりに、
セグメント別の配信用テーブル `map_segment_events` を購読します。
クエスト達成時にサーバー側でこのテーブルへ 1 件追加され、クライアントは自分の
セグメントだけを Realtime で受け取ります。

```sql
create table if not exists public.map_segment_events (
  id uuid primary key default gen_random_uuid(),
  segment_key text not null,
  age_group text not null check (age_group in ('20代', '30代', '40代', '50代', '60代+')),
  income_band text not null check (income_band in ('300万層', '400万層', '500万層', '600万層', '700万層+')),
  user_id uuid not null references auth.users(id) on delete cascade,
  quest_id uuid not null references public.user_quests(id) on delete cascade,
  title text not null,
  message text not null,
  category text not null check (category in ('poison', 'doping', 'shield')),
  reward jsonb not null default '{}'::jsonb,
  delta_days integer not null default 0,
  recommended_cut_fixed integer,
  recommended_boost_income integer,
  completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (quest_id)
);

create index if not exists map_segment_events_segment_key_completed_at_idx
  on public.map_segment_events (segment_key, completed_at desc);

create index if not exists map_segment_events_user_id_idx
  on public.map_segment_events (user_id);

alter table public.map_segment_events enable row level security;

create policy "map_segment_events_select_same_segment"
on public.map_segment_events
for select
to authenticated
using (
  exists (
    select 1
    from public.user_profiles up
    where up.user_id = auth.uid()
      and up.age_group = map_segment_events.age_group
      and up.income_band = map_segment_events.income_band
  )
);

alter publication supabase_realtime add table public.map_segment_events;
```

すでに追加済みでエラーになる場合は、そのままで大丈夫です。

### 13) DB（solution_links）を作成（提携リンク / 収益導線）

`/triggers` と `/quests` の外部ソリューション導線に使います。

```sql
create table if not exists public.solution_links (
  id uuid primary key default gen_random_uuid(),
  placement text not null check (placement in ('triggers', 'quests', 'quest_detail', 'fp')),
  category text not null check (category in ('poison', 'doping', 'shield', 'advice')),
  subcategory text,
  label text not null,
  description text,
  url text not null,
  cta_label text,
  priority integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.solution_links enable row level security;

create policy "solution_links_select_authenticated"
on public.solution_links
for select
to authenticated
using (is_active = true);
```

初期データ例:

```sql
insert into public.solution_links
  (placement, category, subcategory, label, description, url, cta_label, priority)
values
  (
    'triggers',
    'poison',
    'mobile',
    '格安SIM比較',
    '通信費の止血に使える比較サイトです。',
    'https://example.com/mobile',
    '通信費を見直す',
    10
  ),
  (
    'triggers',
    'poison',
    'subscription',
    'サブスク棚卸しサービス',
    '固定費の整理を始めるための外部サービスです。',
    'https://example.com/subscription',
    'サブスク整理へ',
    20
  ),
  (
    'triggers',
    'doping',
    'side_job',
    '副業案件ボード',
    '小さく収入を増やすための案件一覧です。',
    'https://example.com/sidejob',
    '案件を見る',
    10
  ),
  (
    'triggers',
    'shield',
    'insurance',
    '保険の見直し比較',
    '守りを固めるための比較導線です。',
    'https://example.com/insurance',
    '保険を見直す',
    10
  ),
  (
    'quests',
    'poison',
    'subscription',
    '固定費見直しガイド',
    'クエストの前に現実の削減手段も確認できます。',
    'https://example.com/poison-guide',
    '削減策を見る',
    10
  ),
  (
    'quests',
    'doping',
    'side_job',
    '副業スタートガイド',
    '収入アップ系クエストの前に使える外部導線です。',
    'https://example.com/doping-guide',
    '収入アップ策を見る',
    20
  ),
  (
    'quests',
    'shield',
    'insurance',
    '守りの家計ガイド',
    '保険や備えの選択肢を確認できます。',
    'https://example.com/shield-guide',
    '守りを固める',
    30
  ),
  (
    'quest_detail',
    'poison',
    'mobile',
    '通信費比較サービス',
    'このクエストに近い外部ソリューションです。',
    'https://example.com/mobile-quest',
    '通信費を比較する',
    10
  ),
  (
    'quest_detail',
    'shield',
    'insurance',
    '保険相談の比較先',
    '盾系クエストからそのまま比較できます。',
    'https://example.com/shield-quest',
    '保険を比較する',
    10
  ),
  (
    'fp',
    'advice',
    null,
    'ファイナンシャルプランナー相談',
    '住宅ローンや資産運用など、複雑な悩みはプロに相談します。',
    'https://example.com/fp-booking',
    'FPに相談予約する',
    10
  );
```

`fp` のリンクを DB に入れない場合は、`.env.local` の `NEXT_PUBLIC_FP_BOOKING_URL` を使って外部予約リンクを表示できます。

### 14) 管理画面（提携リンク管理）

`solution_links` はアプリ内の管理画面から編集できます。

- 画面URL: `/admin/solution-links`
- 対象: `ADMIN_EMAIL` に設定したメールアドレスでログインしたユーザーのみ

`.env.local` 例:

```env
ADMIN_EMAIL=you@example.com
```

できること:

- 一覧表示
- 新規追加
- 既存リンクの編集
- `is_active` の有効/無効切り替え

初期版では誤操作を避けるため、削除ではなく `is_active = false` で無効化運用にしています。

## 起動

```bash
npm run dev
```

- トップ: `http://localhost:3000`
- ログイン: `/login`
- 新規登録: `/signup`
- ダッシュボード: `/dashboard`
- トリガー: `/triggers`
- クエスト: `/quests`
- AI家計診断: `/quests` の「あなた専用の攻略本」
- Pulse通知: ログイン後に Push 登録、`/api/cron/weekly-report` と `/api/cron/monthly-report` でレポート、`/api/cron/liveness-pulse` で生存確認
- Social Proof: 新規登録時のプロフィール保存 + `/map` の匿名セグメント比較
- Exit Strategy: `/triggers` と `/quests` の提携リンク、FP相談導線
- 管理画面: `/admin/solution-links` で提携リンクをノーコード更新

