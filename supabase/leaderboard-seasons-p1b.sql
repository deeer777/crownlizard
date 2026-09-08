begin;

-- Preserve every historical result while moving new verified runs onto an
-- explicit server-owned competitive season.
alter table public.leaderboard_runs
  add column if not exists season_id text not null default 'preseason';
alter table public.leaderboard_scores
  add column if not exists season_id text not null default 'preseason';

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
     where conname = 'leaderboard_runs_season_id_check'
       and conrelid = 'public.leaderboard_runs'::regclass
  ) then
    alter table public.leaderboard_runs
      add constraint leaderboard_runs_season_id_check
      check (season_id ~ '^[a-z0-9][a-z0-9-]{0,31}$');
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint
     where conname = 'leaderboard_scores_season_id_check'
       and conrelid = 'public.leaderboard_scores'::regclass
  ) then
    alter table public.leaderboard_scores
      add constraint leaderboard_scores_season_id_check
      check (season_id ~ '^[a-z0-9][a-z0-9-]{0,31}$');
  end if;
end
$$;

create index if not exists leaderboard_runs_season_rate_idx
  on public.leaderboard_runs (season_id, ip_hash, created_at desc);
create index if not exists leaderboard_scores_season_rank_idx
  on public.leaderboard_scores (season_id, difficulty, score desc, created_at asc);

-- The default deliberately remains preseason during a rolling deployment.
-- Only the new edge API supplies season-1, so an older Worker cannot place an
-- old build onto the active board between the migration and API deployment.
drop function if exists public.start_verified_run(uuid,text,text,text,text);
create function public.start_verified_run(
  p_user_id uuid,
  p_difficulty text,
  p_game_version text,
  p_ip_hash text,
  p_checkpoint_token_hash text,
  p_season_id text default 'preseason'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare new_run public.leaderboard_runs%rowtype;
begin
  if p_difficulty not in ('chill','arcade','crowned')
     or p_checkpoint_token_hash !~ '^[0-9a-f]{64}$'
     or p_season_id !~ '^[a-z0-9][a-z0-9-]{0,31}$' then
    return jsonb_build_object('error','INVALID_RUN');
  end if;

  perform public.expire_stale_verified_runs(100);
  perform public.prune_stale_run_checkpoints(50);

  if p_user_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('run:' || p_user_id::text, 0));
    update public.leaderboard_runs set status = 'abandoned'
      where user_id = p_user_id and status = 'active';
  end if;
  insert into public.leaderboard_runs(user_id,difficulty,game_version,season_id,ip_hash,status,expires_at,checkpoint_token_hash)
  values(p_user_id,p_difficulty,p_game_version,p_season_id,p_ip_hash,'active',now()+interval '8 hours',p_checkpoint_token_hash)
  returning * into new_run;
  return jsonb_build_object(
    'id',new_run.id,
    'season',new_run.season_id,
    'startedAt',new_run.created_at,
    'expiresAt',new_run.expires_at
  );
end $$;
revoke all on function public.start_verified_run(uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.start_verified_run(uuid,text,text,text,text,text) to service_role;

create or replace function public.submit_verified_score(p_run_id uuid,p_user_id uuid,p_initials text,p_player_name text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.leaderboard_runs%rowtype; existing_id uuid; score_id uuid; s jsonb;
begin
  select * into r from public.leaderboard_runs where id=p_run_id for update;
  if not found then return jsonb_build_object('error','RUN_NOT_FOUND'); end if;
  if r.user_id is distinct from p_user_id then return jsonb_build_object('error','RUN_OWNER_MISMATCH'); end if;
  select id into existing_id from public.leaderboard_scores where run_id=p_run_id;
  if existing_id is not null then return jsonb_build_object('id',existing_id,'duplicate',true); end if;
  if r.status<>'completed' or r.approved_summary is null or r.used_at is not null then return jsonb_build_object('error','RUN_NOT_VERIFIED'); end if;
  s:=r.approved_summary;
  insert into public.leaderboard_scores(run_id,initials,user_id,player_name,score,difficulty,duration_ms,zone,wardens,enemies,crates,best_combo,game_version,season_id)
  values(p_run_id,p_initials,p_user_id,p_player_name,(s->>'score')::integer,r.difficulty,(s->>'elapsedMs')::integer,
    (s->>'zone')::integer,(s->>'wardens')::integer,(s->>'enemies')::integer,(s->>'crates')::integer,(s->>'bestCombo')::integer,r.game_version,r.season_id)
  returning id into score_id;
  update public.leaderboard_runs set used_at=now() where id=p_run_id;
  return jsonb_build_object('id',score_id,'duplicate',false,'season',r.season_id);
end $$;
revoke all on function public.submit_verified_score(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.submit_verified_score(uuid,uuid,text,text) to service_role;

commit;
