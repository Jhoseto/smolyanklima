-- 0092_application_changelog.sql
-- История на GitHub commit-и с AI описание на български за екрана „За приложението“.

create table if not exists public.application_changelog (
  commit_sha text primary key,
  committed_at timestamptz not null,
  author_name text,
  message_original text not null,
  title_bg text,
  summary_bg text,
  branches text[] not null default '{}',
  github_url text not null,
  files_changed int,
  insertions int,
  deletions int,
  sync_status text not null default 'pending'
    check (sync_status in ('pending', 'ready', 'failed')),
  sync_error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_application_changelog_committed_at_desc
  on public.application_changelog (committed_at desc);

create index if not exists idx_application_changelog_sync_status
  on public.application_changelog (sync_status)
  where sync_status != 'ready';

comment on table public.application_changelog is
  'GitHub commit history with Bulgarian client-facing summaries (admin /admin/about).';

alter table public.application_changelog enable row level security;
