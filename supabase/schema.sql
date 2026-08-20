-- Crown Lizard global leaderboard. Run this once in the Supabase SQL editor.
create extension if not exists pgcrypto;

create table if not exists public.leaderboard_runs (
  id uuid primary key default gen_random_uuid(),
  difficulty text not null check (difficulty in ('chill', 'arcade', 'crowned')),
  game_version text not null check (game_version ~ '^\d+\.\d+\.\d+-\d+$'),
  ip_hash text not null check (char_length(ip_hash) = 64),
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create table if not exists public.leaderboard_scores (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null unique references public.leaderboard_runs(id) on delete restrict,
  initials text not null check (initials ~ '^[A-Z0-9]{3}$'),
  score integer not null check (score between 1 and 1000000000),
  difficulty text not null check (difficulty in ('chill', 'arcade', 'crowned')),
  duration_ms integer not null check (duration_ms between 3000 and 86400000),
  zone integer not null check (zone between 1 and 999),
  wardens integer not null check (wardens between 0 and 999),
  enemies integer not null check (enemies between 0 and 1000000),
  crates integer not null check (crates between 0 and 100000),
  best_combo integer not null check (best_combo between 1 and 100000),
  game_version text not null check (game_version ~ '^\d+\.\d+\.\d+-\d+$'),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists leaderboard_runs_rate_limit_idx
  on public.leaderboard_runs (ip_hash, created_at desc);

create index if not exists leaderboard_scores_rank_idx
  on public.leaderboard_scores (difficulty, score desc, created_at asc);

alter table public.leaderboard_runs enable row level security;
alter table public.leaderboard_scores enable row level security;

-- No public policies are intentional. Only the encrypted Supabase secret held by
-- the Cloudflare Pages Function may read or write leaderboard data.
