begin;

-- Short post-Build 99 stabilization: bound maintenance work and keep audit rows.
create or replace function public.expire_stale_verified_runs(p_limit integer default 100)
returns integer language plpgsql security definer set search_path = public as $$
declare expired_count integer := 0;
begin
  with candidates as (
    select id
      from public.leaderboard_runs
     where status = 'active' and expires_at <= now()
     order by expires_at
     limit greatest(1, least(coalesce(p_limit, 100), 500))
     for update skip locked
  ), expired as (
    update public.leaderboard_runs r
       set status = 'expired'
      from candidates c
     where r.id = c.id
    returning r.id
  )
  select count(*) into expired_count from expired;
  return expired_count;
end $$;
revoke all on function public.expire_stale_verified_runs(integer) from public, anon, authenticated;
grant execute on function public.expire_stale_verified_runs(integer) to service_role;

create or replace function public.prune_stale_run_checkpoints(p_limit integer default 50)
returns integer language plpgsql security definer set search_path = public as $$
declare deleted_count integer := 0;
begin
  with candidates as (
    select c.run_id, c.sequence
      from public.run_checkpoints c
      join public.leaderboard_runs r on r.id = c.run_id
     where r.status in ('expired', 'abandoned')
       and r.created_at < now() - interval '30 days'
     order by r.created_at, c.sequence
     limit greatest(1, least(coalesce(p_limit, 50), 250))
     for update of c skip locked
  ), deleted as (
    delete from public.run_checkpoints c
     using candidates x
     where c.run_id = x.run_id and c.sequence = x.sequence
    returning c.run_id
  )
  select count(*) into deleted_count from deleted;
  return deleted_count;
end $$;
revoke all on function public.prune_stale_run_checkpoints(integer) from public, anon, authenticated;
grant execute on function public.prune_stale_run_checkpoints(integer) to service_role;

create or replace function public.start_verified_run(
  p_user_id uuid, p_difficulty text, p_game_version text, p_ip_hash text, p_checkpoint_token_hash text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare new_run public.leaderboard_runs%rowtype;
begin
  if p_difficulty not in ('chill','arcade','crowned') or p_checkpoint_token_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('error','INVALID_RUN');
  end if;

  perform public.expire_stale_verified_runs(100);
  perform public.prune_stale_run_checkpoints(50);

  if p_user_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('run:' || p_user_id::text, 0));
    update public.leaderboard_runs set status = 'abandoned'
      where user_id = p_user_id and status = 'active';
  end if;
  insert into public.leaderboard_runs(user_id,difficulty,game_version,ip_hash,status,expires_at,checkpoint_token_hash)
  values(p_user_id,p_difficulty,p_game_version,p_ip_hash,'active',now()+interval '8 hours',p_checkpoint_token_hash)
  returning * into new_run;
  return jsonb_build_object('id',new_run.id,'startedAt',new_run.created_at,'expiresAt',new_run.expires_at);
end $$;
revoke all on function public.start_verified_run(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.start_verified_run(uuid,text,text,text,text) to service_role;

commit;
