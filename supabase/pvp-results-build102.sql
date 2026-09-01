-- Build 102 / PvP Pass 4: verified, idempotent duel history.

create table if not exists public.pvp_match_results (
  challenge_id uuid not null references public.pvp_challenges(id) on delete cascade,
  round integer not null check (round between 1 and 1000),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  guest_user_id uuid not null references auth.users(id) on delete cascade,
  host_score integer not null check (host_score between 0 and 1000000000),
  guest_score integer not null check (guest_score between 0 and 1000000000),
  winner_user_id uuid references auth.users(id) on delete set null,
  outcome text not null check (outcome in ('host', 'guest', 'draw', 'no_contest')),
  completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (challenge_id, round),
  check (host_user_id <> guest_user_id),
  check (winner_user_id is null or winner_user_id in (host_user_id, guest_user_id))
);

create index if not exists pvp_match_results_host_idx on public.pvp_match_results (host_user_id, completed_at desc);
create index if not exists pvp_match_results_guest_idx on public.pvp_match_results (guest_user_id, completed_at desc);
alter table public.pvp_match_results enable row level security;
revoke all on table public.pvp_match_results from public, anon, authenticated;

create or replace function public.record_pvp_match_result(
  p_challenge_id uuid, p_round integer, p_host_user_id uuid, p_guest_user_id uuid,
  p_host_score integer, p_guest_score integer, p_winner_role text, p_completed_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare existing public.pvp_match_results%rowtype;
declare outcome_value text;
declare winner_value uuid;
begin
  if p_challenge_id is null or p_round < 1 or p_host_user_id is null or p_guest_user_id is null
     or p_host_user_id = p_guest_user_id or p_host_score < 0 or p_guest_score < 0
     or p_winner_role not in ('host', 'guest', 'draw', 'no_contest') or p_completed_at is null then
    return jsonb_build_object('error', 'INVALID_DUEL_RESULT');
  end if;
  if not exists (
    select 1 from public.pvp_challenges c
     where c.id = p_challenge_id and c.host_user_id = p_host_user_id and c.guest_user_id = p_guest_user_id
  ) then return jsonb_build_object('error', 'DUEL_MEMBERSHIP_MISMATCH'); end if;

  outcome_value := p_winner_role;
  winner_value := case p_winner_role when 'host' then p_host_user_id when 'guest' then p_guest_user_id else null end;
  insert into public.pvp_match_results (
    challenge_id, round, host_user_id, guest_user_id, host_score, guest_score, winner_user_id, outcome, completed_at
  ) values (
    p_challenge_id, p_round, p_host_user_id, p_guest_user_id, p_host_score, p_guest_score, winner_value, outcome_value, p_completed_at
  ) on conflict (challenge_id, round) do nothing;

  select * into existing from public.pvp_match_results where challenge_id = p_challenge_id and round = p_round;
  return jsonb_build_object('recorded', true, 'duplicateRequest', existing.created_at < now() - interval '10 milliseconds');
end;
$$;

create or replace function public.public_pvp_history(p_public_id uuid, p_limit integer default 5)
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  with target as (
    select p.user_id from public.player_profiles p where p.public_id = p_public_id and p.is_public = true
  ), rows as (
    select r.*, target.user_id,
      case when r.host_user_id = target.user_id then r.guest_user_id else r.host_user_id end as opponent_id,
      case when r.host_user_id = target.user_id then r.host_score else r.guest_score end as own_score,
      case when r.host_user_id = target.user_id then r.guest_score else r.host_score end as rival_score
    from public.pvp_match_results r join target on target.user_id in (r.host_user_id, r.guest_user_id)
    order by r.completed_at desc limit least(greatest(coalesce(p_limit, 5), 1), 10)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'outcome', case when rows.outcome = 'no_contest' then 'no_contest' when rows.outcome = 'draw' then 'draw'
      when rows.winner_user_id = rows.user_id then 'win' else 'loss' end,
    'score', rows.own_score, 'rivalScore', rows.rival_score,
    'opponent', opponent.display_name,
    'opponentPublicId', case when opponent.is_public then opponent.public_id else null end,
    'completedAt', rows.completed_at
  ) order by rows.completed_at desc), '[]'::jsonb)
  from rows join public.player_profiles opponent on opponent.user_id = rows.opponent_id;
$$;

revoke all on function public.record_pvp_match_result(uuid, integer, uuid, uuid, integer, integer, text, timestamptz) from public, anon, authenticated;
revoke all on function public.public_pvp_history(uuid, integer) from public, anon, authenticated;
grant execute on function public.record_pvp_match_result(uuid, integer, uuid, uuid, integer, integer, text, timestamptz) to service_role;
grant execute on function public.public_pvp_history(uuid, integer) to service_role;
