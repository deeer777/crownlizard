begin;

create or replace function public.run_telemetry_is_plausible(p_elapsed_ms integer, p_telemetry jsonb)
returns boolean language plpgsql immutable set search_path = public as $$
declare
  enemy_count integer := coalesce((p_telemetry->>'enemies')::integer, 0);
  crate_count integer := coalesce((p_telemetry->>'crates')::integer, 0);
  warden_count integer := coalesce((p_telemetry->>'wardens')::integer, 0);
  zone_count integer := coalesce((p_telemetry->>'zone')::integer, 1);
  combo_count integer := coalesce((p_telemetry->>'bestCombo')::integer, 1);
  score_count bigint := coalesce((p_telemetry->>'score')::bigint, 0);
  score_cap bigint;
begin
  if p_elapsed_ms is null or p_elapsed_ms < 0 or p_elapsed_ms > 86400000 then return false; end if;
  score_cap := 10000 + ceil(p_elapsed_ms / 1000.0)::bigint * 300
    + enemy_count::bigint * 55000
    + warden_count::bigint * (350000 + zone_count::bigint * 40000);
  return enemy_count between 0 and floor(p_elapsed_ms / 125.0)::integer + 32
    and crate_count between 0 and floor(p_elapsed_ms / 7000.0)::integer + 2
    and zone_count between 1 and floor(p_elapsed_ms / 120000.0)::integer + 1
    and warden_count between 0 and least(zone_count, floor((p_elapsed_ms + 18000) / 120000.0)::integer)
    and combo_count between 1 and 9
    and score_count between 0 and score_cap;
exception when invalid_text_representation or numeric_value_out_of_range then
  return false;
end $$;
revoke all on function public.run_telemetry_is_plausible(integer,jsonb) from public,anon,authenticated;
grant execute on function public.run_telemetry_is_plausible(integer,jsonb) to service_role;

create or replace function public.record_run_checkpoint(
  p_user_id uuid, p_ip_hash text, p_run_id uuid, p_token_hash text, p_next_token_hash text,
  p_sequence integer, p_elapsed_ms integer, p_telemetry jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.leaderboard_runs%rowtype; prev jsonb; delta_ms integer;
begin
  select * into r from public.leaderboard_runs where id=p_run_id for update;
  if not found then return jsonb_build_object('error','RUN_NOT_FOUND'); end if;
  if (r.user_id is distinct from p_user_id) or (r.user_id is null and r.ip_hash <> p_ip_hash) then return jsonb_build_object('error','RUN_OWNER_MISMATCH'); end if;
  if r.status <> 'active' or r.expires_at <= now() then return jsonb_build_object('error','RUN_EXPIRED'); end if;
  if p_sequence=r.last_checkpoint_sequence and r.previous_checkpoint_token_hash=p_token_hash then
    update public.leaderboard_runs set checkpoint_token_hash=p_next_token_hash where id=p_run_id;
    return jsonb_build_object('acceptedAt',now(),'duplicate',true);
  end if;
  if r.checkpoint_token_hash <> p_token_hash or p_next_token_hash !~ '^[0-9a-f]{64}$' then return jsonb_build_object('error','CHECKPOINT_TOKEN_INVALID'); end if;
  if p_sequence <> r.last_checkpoint_sequence + 1 or p_elapsed_ms < r.last_checkpoint_elapsed_ms then return jsonb_build_object('error','CHECKPOINT_ORDER_INVALID'); end if;
  if p_elapsed_ms > extract(epoch from (now()-r.created_at))*1000 + 20000
     or p_elapsed_ms < p_sequence*15000
     or (r.last_checkpoint_at is not null and now()-r.last_checkpoint_at < interval '8 seconds') then
    return jsonb_build_object('error','CHECKPOINT_TIME_INVALID');
  end if;
  if coalesce((p_telemetry->>'elapsedMs')::integer,-1) <> p_elapsed_ms
     or not public.run_telemetry_is_plausible(p_elapsed_ms,p_telemetry) then
    return jsonb_build_object('error','CHECKPOINT_IMPLAUSIBLE');
  end if;
  prev := r.last_checkpoint_data;
  delta_ms := p_elapsed_ms-r.last_checkpoint_elapsed_ms;
  if coalesce((p_telemetry->>'enemies')::int,0) < coalesce((prev->>'enemies')::int,0)
     or coalesce((p_telemetry->>'wardens')::int,0) < coalesce((prev->>'wardens')::int,0)
     or coalesce((p_telemetry->>'crates')::int,0) < coalesce((prev->>'crates')::int,0)
     or coalesce((p_telemetry->>'score')::bigint,0) < coalesce((prev->>'score')::bigint,0)
     or coalesce((p_telemetry->>'enemies')::int,0)-coalesce((prev->>'enemies')::int,0) > floor(delta_ms/125.0)::integer+12
     or coalesce((p_telemetry->>'crates')::int,0)-coalesce((prev->>'crates')::int,0) > floor(delta_ms/7000.0)::integer+2
     or coalesce((p_telemetry->>'wardens')::int,0)-coalesce((prev->>'wardens')::int,0) > floor(delta_ms/100000.0)::integer+1 then
    return jsonb_build_object('error','CHECKPOINT_REGRESSION');
  end if;
  insert into public.run_checkpoints(run_id,sequence,elapsed_ms,telemetry) values(p_run_id,p_sequence,p_elapsed_ms,p_telemetry);
  update public.leaderboard_runs set previous_checkpoint_token_hash=p_token_hash,checkpoint_token_hash=p_next_token_hash,last_checkpoint_sequence=p_sequence,
    last_checkpoint_elapsed_ms=p_elapsed_ms,last_checkpoint_at=now(),last_checkpoint_data=p_telemetry where id=p_run_id;
  return jsonb_build_object('acceptedAt',now());
end $$;
revoke all on function public.record_run_checkpoint(uuid,text,uuid,text,text,integer,integer,jsonb) from public,anon,authenticated;
grant execute on function public.record_run_checkpoint(uuid,text,uuid,text,text,integer,integer,jsonb) to service_role;

create or replace function public.complete_verified_run(
  p_user_id uuid, p_ip_hash text, p_run_id uuid, p_token_hash text, p_elapsed_ms integer, p_summary jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.leaderboard_runs%rowtype; required_points integer; flags jsonb := '[]'::jsonb; prev jsonb;
begin
  select * into r from public.leaderboard_runs where id=p_run_id for update;
  if not found then return jsonb_build_object('error','RUN_NOT_FOUND'); end if;
  if (r.user_id is distinct from p_user_id) or (r.user_id is null and r.ip_hash <> p_ip_hash) then return jsonb_build_object('error','RUN_OWNER_MISMATCH'); end if;
  if r.status='completed' then return jsonb_build_object('duplicate',true,'summary',r.approved_summary); end if;
  if r.status in ('quarantined','abandoned','expired') or r.expires_at <= now() then return jsonb_build_object('error','RUN_EXPIRED'); end if;
  if r.checkpoint_token_hash <> p_token_hash then return jsonb_build_object('error','CHECKPOINT_TOKEN_INVALID'); end if;
  required_points := greatest(0,floor((p_elapsed_ms-10000)/20000.0)::integer);
  if r.last_checkpoint_sequence < required_points then flags := flags || '"CHECKPOINT_COVERAGE"'::jsonb; end if;
  if p_elapsed_ms < r.last_checkpoint_elapsed_ms or p_elapsed_ms > extract(epoch from (now()-r.created_at))*1000 + 20000 then flags := flags || '"TIME"'::jsonb; end if;
  if coalesce((p_summary->>'elapsedMs')::integer,-1) <> p_elapsed_ms
     or not public.run_telemetry_is_plausible(p_elapsed_ms,p_summary) then flags := flags || '"PLAUSIBILITY"'::jsonb; end if;
  prev := r.last_checkpoint_data;
  if r.last_checkpoint_sequence > 0 and (
       coalesce((p_summary->>'enemies')::int,0) < coalesce((prev->>'enemies')::int,0)
       or coalesce((p_summary->>'wardens')::int,0) < coalesce((prev->>'wardens')::int,0)
       or coalesce((p_summary->>'crates')::int,0) < coalesce((prev->>'crates')::int,0)
       or coalesce((p_summary->>'score')::bigint,0) < coalesce((prev->>'score')::bigint,0)
     ) then flags := flags || '"CHECKPOINT_REGRESSION"'::jsonb; end if;
  if jsonb_array_length(flags)>0 then
    update public.leaderboard_runs set status='quarantined',verification_flags=flags,approved_summary=p_summary where id=p_run_id;
    return jsonb_build_object('error','RUN_QUARANTINED');
  end if;
  update public.leaderboard_runs set status='completed',verified_at=now(),approved_summary=p_summary where id=p_run_id;
  return jsonb_build_object('duplicate',false,'summary',p_summary);
end $$;
revoke all on function public.complete_verified_run(uuid,text,uuid,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.complete_verified_run(uuid,text,uuid,text,integer,jsonb) to service_role;

create or replace function public.record_boss_assault_checkpoint(p_user_id uuid,p_assault_id uuid,p_token_hash text,p_next_token_hash text,p_phase integer,p_elapsed_ms integer,p_damage integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a public.boss_assaults%rowtype; cap integer;
begin
  select * into a from public.boss_assaults where id=p_assault_id for update;
  if not found or a.user_id<>p_user_id then return jsonb_build_object('error','ASSAULT_NOT_FOUND'); end if;
  if a.status<>'active' or a.expires_at<=now() then return jsonb_build_object('error','ASSAULT_EXPIRED'); end if;
  if p_phase=a.last_checkpoint_phase and a.previous_checkpoint_token_hash=p_token_hash then
    update public.boss_assaults set checkpoint_token_hash=p_next_token_hash where id=p_assault_id;
    return jsonb_build_object('acceptedAt',now(),'duplicate',true);
  end if;
  if a.checkpoint_token_hash<>p_token_hash or p_next_token_hash !~ '^[0-9a-f]{64}$' then return jsonb_build_object('error','CHECKPOINT_TOKEN_INVALID'); end if;
  if p_phase<>a.last_checkpoint_phase+1 then return jsonb_build_object('error','CHECKPOINT_ORDER_INVALID'); end if;
  if p_elapsed_ms < p_phase*30000-5000 or p_elapsed_ms > p_phase*30000+10000
     or p_elapsed_ms > extract(epoch from(now()-a.issued_at))*1000+5000 then return jsonb_build_object('error','CHECKPOINT_TIME_INVALID'); end if;
  cap:=ceil(coalesce((a.phase_ceiling->>(p_phase-1))::numeric,0)*1.03);
  if p_damage<0 or p_damage>cap then return jsonb_build_object('error','CHECKPOINT_DAMAGE_INVALID'); end if;
  insert into public.boss_assault_checkpoints(assault_id,phase,elapsed_ms,damage) values(p_assault_id,p_phase,p_elapsed_ms,p_damage);
  update public.boss_assaults set previous_checkpoint_token_hash=p_token_hash,checkpoint_token_hash=p_next_token_hash,last_checkpoint_phase=p_phase,checkpoint_verified_at=now() where id=p_assault_id;
  return jsonb_build_object('acceptedAt',now());
end $$;
revoke all on function public.record_boss_assault_checkpoint(uuid,uuid,text,text,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.record_boss_assault_checkpoint(uuid,uuid,text,text,integer,integer,integer) to service_role;

create or replace function public.settle_verified_boss_assault(p_user_id uuid,p_assault_id uuid,p_request_id uuid,p_elapsed_ms integer,p_phase_damage jsonb,p_outcome text,p_targets_destroyed integer,p_token_hash text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a public.boss_assaults%rowtype; cp1 integer; cp2 integer; phase_index integer; phase_value integer; phase_cap integer;
  relay_ms integer; pylon_ms integer; target_cap integer;
begin
  select * into a from public.boss_assaults where id=p_assault_id for update;
  if not found then return jsonb_build_object('error','ASSAULT_NOT_FOUND'); end if;
  if a.status='settled' then return public.settle_boss_assault(p_user_id,p_assault_id,p_request_id,p_elapsed_ms,p_phase_damage,p_outcome,p_targets_destroyed); end if;
  if a.user_id<>p_user_id then return jsonb_build_object('error','ASSAULT_OWNER_MISMATCH'); end if;
  if a.checkpoint_token_hash<>p_token_hash then return jsonb_build_object('error','CHECKPOINT_TOKEN_INVALID'); end if;
  if p_outcome='timeout' and p_elapsed_ms<87000 then return jsonb_build_object('error','ASSAULT_TIME_INVALID'); end if;
  if p_elapsed_ms>=30000 and a.last_checkpoint_phase<1 then return jsonb_build_object('error','PHASE_CHECKPOINT_MISSING'); end if;
  if p_elapsed_ms>=60000 and a.last_checkpoint_phase<2 then return jsonb_build_object('error','PHASE_CHECKPOINT_MISSING'); end if;
  select damage into cp1 from public.boss_assault_checkpoints where assault_id=p_assault_id and phase=1;
  select damage into cp2 from public.boss_assault_checkpoints where assault_id=p_assault_id and phase=2;
  if p_elapsed_ms>=30000 and coalesce((p_phase_damage->>0)::integer,-1)<>cp1 then return jsonb_build_object('error','PHASE_DAMAGE_MISMATCH'); end if;
  if p_elapsed_ms>=60000 and coalesce((p_phase_damage->>1)::integer,-1)<>cp2 then return jsonb_build_object('error','PHASE_DAMAGE_MISMATCH'); end if;
  for phase_index in 0..2 loop
    phase_value:=coalesce((p_phase_damage->>phase_index)::integer,-1);
    phase_cap:=ceil(coalesce((a.phase_ceiling->>phase_index)::numeric,0)
      * least(30000,greatest(0,p_elapsed_ms-phase_index*30000))/30000.0*1.03);
    if phase_value<0 or phase_value>phase_cap then return jsonb_build_object('error','PHASE_DAMAGE_INVALID'); end if;
  end loop;
  relay_ms:=greatest(0,least(30000,p_elapsed_ms-30000));
  pylon_ms:=greatest(0,least(30000,p_elapsed_ms-60000));
  target_cap:=(case when relay_ms>0 then 5+ceil(relay_ms/1050.0)::integer else 0 end)
    +(case when pylon_ms>0 then 5+ceil(pylon_ms/1700.0)::integer else 0 end);
  if p_targets_destroyed<0 or p_targets_destroyed>target_cap then return jsonb_build_object('error','TARGET_COUNT_INVALID'); end if;
  return public.settle_boss_assault(p_user_id,p_assault_id,p_request_id,p_elapsed_ms,p_phase_damage,p_outcome,p_targets_destroyed);
exception when invalid_text_representation or numeric_value_out_of_range then
  return jsonb_build_object('error','ASSAULT_TELEMETRY_INVALID');
end $$;
revoke all on function public.settle_verified_boss_assault(uuid,uuid,uuid,integer,jsonb,text,integer,text) from public,anon,authenticated;
grant execute on function public.settle_verified_boss_assault(uuid,uuid,uuid,integer,jsonb,text,integer,text) to service_role;

commit;
