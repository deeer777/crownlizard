-- Build 114: one competitive position per registered pilot, plus a server-owned
-- personal-best snapshot for the active leaderboard season.

create or replace function public.leaderboard_snapshot(
  p_season_id text,
  p_difficulty text,
  p_user_id uuid default null,
  p_entry_id uuid default null,
  p_limit integer default 25
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with eligible as (
    select
      score.*,
      row_number() over (
        partition by case
          when score.user_id is not null then 'user:' || score.user_id::text
          else 'guest:' || score.id::text
        end
        order by score.score desc, score.created_at asc, score.id asc
      ) as personal_order
    from public.leaderboard_scores score
    where score.season_id = p_season_id
      and score.difficulty = p_difficulty
      and score.is_hidden = false
  ), best_scores as (
    select * from eligible where personal_order = 1
  ), ranked as (
    select
      best_scores.*,
      row_number() over (order by score desc, created_at asc, id asc)::integer as rank,
      count(*) over ()::integer as total
    from best_scores
  ), entries as (
    select
      ranked.rank,
      ranked.total,
      ranked.user_id,
      ranked.id,
      jsonb_build_object(
        'id', ranked.id,
        'rank', ranked.rank,
        'playerName', coalesce(profile.display_name, ranked.player_name, ranked.initials, '---'),
        'initials', coalesce(profile.display_name, ranked.player_name, ranked.initials, '---'),
        'publicProfileId', case when profile.is_public then profile.public_id else null end,
        'score', ranked.score,
        'difficulty', ranked.difficulty,
        'zone', ranked.zone,
        'wardens', ranked.wardens,
        'createdAt', ranked.created_at
      ) as entry
    from ranked
    left join public.player_profiles profile on profile.user_id = ranked.user_id
  ), personal as (
    select *
    from entries
    where (p_user_id is not null and user_id = p_user_id)
       or (p_user_id is null and p_entry_id is not null and id = p_entry_id)
    order by rank
    limit 1
  )
  select jsonb_build_object(
    'scores', coalesce((
      select jsonb_agg(entry order by rank)
      from entries
      where rank <= greatest(1, least(coalesce(p_limit, 25), 100))
    ), '[]'::jsonb),
    'total', coalesce((select max(total) from entries), 0),
    'personal', (
      select jsonb_build_object(
        'rank', personal.rank,
        'entry', personal.entry,
        'above', (select entry from entries where rank = personal.rank - 1),
        'below', (select entry from entries where rank = personal.rank + 1)
      )
      from personal
    )
  );
$$;

revoke all on function public.leaderboard_snapshot(text, text, uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.leaderboard_snapshot(text, text, uuid, uuid, integer) to service_role;
