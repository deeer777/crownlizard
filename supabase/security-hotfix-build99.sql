-- Build 99 production hotfix: leaderboard_scores.id is UUID, not bigint.
-- Safe to apply repeatedly after security-hardening-build99.sql.
begin;

create or replace function public.submit_verified_score(
  p_run_id uuid,
  p_user_id uuid,
  p_initials text,
  p_player_name text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.leaderboard_runs%rowtype;
  existing_id uuid;
  score_id uuid;
  s jsonb;
begin
  select * into r from public.leaderboard_runs where id = p_run_id for update;
  if not found then return jsonb_build_object('error', 'RUN_NOT_FOUND'); end if;
  if r.user_id is distinct from p_user_id then return jsonb_build_object('error', 'RUN_OWNER_MISMATCH'); end if;

  select id into existing_id from public.leaderboard_scores where run_id = p_run_id;
  if existing_id is not null then return jsonb_build_object('id', existing_id, 'duplicate', true); end if;
  if r.status <> 'completed' or r.approved_summary is null or r.used_at is not null then
    return jsonb_build_object('error', 'RUN_NOT_VERIFIED');
  end if;

  s := r.approved_summary;
  insert into public.leaderboard_scores(
    run_id, initials, user_id, player_name, score, difficulty, duration_ms,
    zone, wardens, enemies, crates, best_combo, game_version
  ) values (
    p_run_id, p_initials, p_user_id, p_player_name, (s->>'score')::integer,
    r.difficulty, (s->>'elapsedMs')::integer, (s->>'zone')::integer,
    (s->>'wardens')::integer, (s->>'enemies')::integer, (s->>'crates')::integer,
    (s->>'bestCombo')::integer, r.game_version
  ) returning id into score_id;

  update public.leaderboard_runs set used_at = now() where id = p_run_id;
  return jsonb_build_object('id', score_id, 'duplicate', false);
end;
$$;

revoke all on function public.submit_verified_score(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.submit_verified_score(uuid,uuid,text,text) to service_role;

commit;
