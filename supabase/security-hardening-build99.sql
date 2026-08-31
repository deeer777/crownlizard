begin;

-- Build 99: server-owned run lifecycle, rotating checkpoint tickets and atomic scores.
alter table public.leaderboard_runs add column if not exists status text not null default 'active';
alter table public.leaderboard_runs add column if not exists expires_at timestamptz;
alter table public.leaderboard_runs add column if not exists checkpoint_token_hash text;
alter table public.leaderboard_runs add column if not exists previous_checkpoint_token_hash text;
alter table public.leaderboard_runs add column if not exists last_checkpoint_sequence integer not null default 0;
alter table public.leaderboard_runs add column if not exists last_checkpoint_elapsed_ms integer not null default 0;
alter table public.leaderboard_runs add column if not exists last_checkpoint_at timestamptz;
alter table public.leaderboard_runs add column if not exists last_checkpoint_data jsonb not null default '{}'::jsonb;
alter table public.leaderboard_runs add column if not exists approved_summary jsonb;
alter table public.leaderboard_runs add column if not exists verified_at timestamptz;
alter table public.leaderboard_runs add column if not exists verification_flags jsonb not null default '[]'::jsonb;
alter table public.leaderboard_runs drop constraint if exists leaderboard_runs_status_check;
alter table public.leaderboard_runs add constraint leaderboard_runs_status_check check (status in ('active','completed','abandoned','expired','quarantined'));

update public.leaderboard_runs
set status = case when used_at is not null or economy_settled_at is not null then 'completed' else 'abandoned' end,
    expires_at = coalesce(expires_at, created_at + interval '8 hours')
where checkpoint_token_hash is null;

create unique index if not exists leaderboard_runs_one_active_user_idx
  on public.leaderboard_runs(user_id) where user_id is not null and status = 'active';
create index if not exists leaderboard_runs_expiry_idx on public.leaderboard_runs(status, expires_at);

create table if not exists public.run_checkpoints (
  run_id uuid not null references public.leaderboard_runs(id) on delete cascade,
  sequence integer not null,
  elapsed_ms integer not null,
  telemetry jsonb not null,
  accepted_at timestamptz not null default now(),
  primary key (run_id, sequence)
);
alter table public.run_checkpoints enable row level security;
revoke all on public.run_checkpoints from public, anon, authenticated;

create or replace function public.start_verified_run(
  p_user_id uuid, p_difficulty text, p_game_version text, p_ip_hash text, p_checkpoint_token_hash text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare new_run public.leaderboard_runs%rowtype;
begin
  if p_difficulty not in ('chill','arcade','crowned') or p_checkpoint_token_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('error','INVALID_RUN');
  end if;
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

create or replace function public.record_run_checkpoint(
  p_user_id uuid, p_ip_hash text, p_run_id uuid, p_token_hash text, p_next_token_hash text,
  p_sequence integer, p_elapsed_ms integer, p_telemetry jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.leaderboard_runs%rowtype; prev jsonb; max_score bigint;
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
  if p_elapsed_ms > extract(epoch from (now()-r.created_at))*1000 + 20000 then return jsonb_build_object('error','CHECKPOINT_TIME_INVALID'); end if;
  prev := r.last_checkpoint_data;
  if coalesce((p_telemetry->>'enemies')::int,0) < coalesce((prev->>'enemies')::int,0)
     or coalesce((p_telemetry->>'wardens')::int,0) < coalesce((prev->>'wardens')::int,0)
     or coalesce((p_telemetry->>'crates')::int,0) < coalesce((prev->>'crates')::int,0)
     or coalesce((p_telemetry->>'score')::bigint,0) < coalesce((prev->>'score')::bigint,0) then
    return jsonb_build_object('error','CHECKPOINT_REGRESSION');
  end if;
  max_score := 25000 + (p_elapsed_ms/1000)*12000 + coalesce((p_telemetry->>'enemies')::bigint,0)*20000 + coalesce((p_telemetry->>'wardens')::bigint,0)*200000;
  if coalesce((p_telemetry->>'enemies')::int,0) > p_elapsed_ms/100 + 100
     or coalesce((p_telemetry->>'crates')::int,0) > p_elapsed_ms/5000 + 10
     or coalesce((p_telemetry->>'wardens')::int,0) > p_elapsed_ms/15000 + 3
     or coalesce((p_telemetry->>'zone')::int,1) > p_elapsed_ms/20000 + 3
     or coalesce((p_telemetry->>'score')::bigint,0) > max_score then
    return jsonb_build_object('error','CHECKPOINT_IMPLAUSIBLE');
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
declare r public.leaderboard_runs%rowtype; required_points integer; flags jsonb := '[]'::jsonb; max_score bigint;
begin
  select * into r from public.leaderboard_runs where id=p_run_id for update;
  if not found then return jsonb_build_object('error','RUN_NOT_FOUND'); end if;
  if (r.user_id is distinct from p_user_id) or (r.user_id is null and r.ip_hash <> p_ip_hash) then return jsonb_build_object('error','RUN_OWNER_MISMATCH'); end if;
  if r.status='completed' then return jsonb_build_object('duplicate',true,'summary',r.approved_summary); end if;
  if r.status in ('quarantined','abandoned','expired') or r.expires_at <= now() then return jsonb_build_object('error','RUN_EXPIRED'); end if;
  if r.checkpoint_token_hash <> p_token_hash then return jsonb_build_object('error','CHECKPOINT_TOKEN_INVALID'); end if;
  required_points := floor(p_elapsed_ms/60000.0);
  max_score := 25000 + (p_elapsed_ms/1000)*12000 + coalesce((p_summary->>'enemies')::bigint,0)*20000 + coalesce((p_summary->>'wardens')::bigint,0)*200000;
  if r.last_checkpoint_sequence < required_points then flags := flags || '"CHECKPOINT_COVERAGE"'::jsonb; end if;
  if p_elapsed_ms < r.last_checkpoint_elapsed_ms or p_elapsed_ms > extract(epoch from (now()-r.created_at))*1000 + 20000 then flags := flags || '"TIME"'::jsonb; end if;
  if coalesce((p_summary->>'score')::bigint,0) > max_score
     or coalesce((p_summary->>'enemies')::int,0) > p_elapsed_ms/100 + 100
     or coalesce((p_summary->>'crates')::int,0) > p_elapsed_ms/5000 + 10
     or coalesce((p_summary->>'wardens')::int,0) > p_elapsed_ms/15000 + 3
     or coalesce((p_summary->>'zone')::int,1) > p_elapsed_ms/20000 + 3 then flags := flags || '"PLAUSIBILITY"'::jsonb; end if;
  if jsonb_array_length(flags)>0 then
    update public.leaderboard_runs set status='quarantined',verification_flags=flags,approved_summary=p_summary where id=p_run_id;
    return jsonb_build_object('error','RUN_QUARANTINED');
  end if;
  update public.leaderboard_runs set status='completed',verified_at=now(),approved_summary=p_summary where id=p_run_id;
  return jsonb_build_object('duplicate',false,'summary',p_summary);
end $$;
revoke all on function public.complete_verified_run(uuid,text,uuid,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.complete_verified_run(uuid,text,uuid,text,integer,jsonb) to service_role;

create or replace function public.submit_verified_score(p_run_id uuid,p_user_id uuid,p_initials text,p_player_name text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.leaderboard_runs%rowtype; existing_id bigint; score_id bigint; s jsonb;
begin
  select * into r from public.leaderboard_runs where id=p_run_id for update;
  if not found then return jsonb_build_object('error','RUN_NOT_FOUND'); end if;
  if r.user_id is distinct from p_user_id then return jsonb_build_object('error','RUN_OWNER_MISMATCH'); end if;
  select id into existing_id from public.leaderboard_scores where run_id=p_run_id;
  if existing_id is not null then return jsonb_build_object('id',existing_id,'duplicate',true); end if;
  if r.status<>'completed' or r.approved_summary is null or r.used_at is not null then return jsonb_build_object('error','RUN_NOT_VERIFIED'); end if;
  s:=r.approved_summary;
  insert into public.leaderboard_scores(run_id,initials,user_id,player_name,score,difficulty,duration_ms,zone,wardens,enemies,crates,best_combo,game_version)
  values(p_run_id,p_initials,p_user_id,p_player_name,(s->>'score')::integer,r.difficulty,(s->>'elapsedMs')::integer,
    (s->>'zone')::integer,(s->>'wardens')::integer,(s->>'enemies')::integer,(s->>'crates')::integer,(s->>'bestCombo')::integer,r.game_version)
  returning id into score_id;
  update public.leaderboard_runs set used_at=now() where id=p_run_id;
  return jsonb_build_object('id',score_id,'duplicate',false);
end $$;
revoke all on function public.submit_verified_score(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.submit_verified_score(uuid,uuid,text,text) to service_role;

drop function if exists public.import_legacy_wallet(uuid,integer,integer,integer,text,text[]);

create or replace function public.create_market_listing(p_user_id uuid,p_cosmetic_id text,p_price integer,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.player_inventory%rowtype; catalog public.cosmetic_catalog%rowtype; wallet public.player_wallets%rowtype;
  existing public.market_listings%rowtype; bounds jsonb; listing public.market_listings%rowtype;
begin
  perform public.expire_market_listings(250);
  if p_user_id is null or p_request_id is null or p_cosmetic_id is null then return jsonb_build_object('error','INVALID_REQUEST'); end if;
  perform pg_advisory_xact_lock(hashtextextended('market-list:'||p_user_id::text,0));
  if not exists(select 1 from auth.users where id=p_user_id and not is_anonymous)
     or not exists(select 1 from public.player_profiles where user_id=p_user_id) then return jsonb_build_object('error','ACCOUNT_REQUIRED'); end if;
  select * into existing from public.market_listings where seller_id=p_user_id and request_id=p_request_id;
  if found then return jsonb_build_object('duplicateRequest',true,'listingId',existing.id,'status',existing.status,'expiresAt',existing.expires_at); end if;
  if (select count(*) from public.market_listings where seller_id=p_user_id and status='active')>=5 then return jsonb_build_object('error','LISTING_LIMIT'); end if;
  select * into catalog from public.cosmetic_catalog where id=p_cosmetic_id and active and acquisition_source='crate';
  if not found then return jsonb_build_object('error','NOT_TRADEABLE'); end if;
  bounds:=public.market_price_bounds(catalog.rarity);
  if p_price<(bounds->>'minimum')::integer or p_price>(bounds->>'maximum')::integer then return jsonb_build_object('error','PRICE_OUT_OF_RANGE','bounds',bounds); end if;
  insert into public.player_wallets(user_id) values(p_user_id) on conflict(user_id) do nothing;
  select * into wallet from public.player_wallets where user_id=p_user_id for update;
  select * into item from public.player_inventory where user_id=p_user_id and cosmetic_id=p_cosmetic_id for update;
  if not found then return jsonb_build_object('error','ITEM_NOT_OWNED'); end if;
  if item.market_listing_id is not null then return jsonb_build_object('error','ALREADY_LISTED'); end if;
  if wallet.equipped_ship=p_cosmetic_id or wallet.equipped_weapon_skins::text like '%'||p_cosmetic_id||'%' then return jsonb_build_object('error','ITEM_EQUIPPED'); end if;
  insert into public.market_listings(seller_id,cosmetic_id,price,request_id,expires_at)
    values(p_user_id,p_cosmetic_id,p_price,p_request_id,now()+interval '7 days') returning * into listing;
  update public.player_inventory set market_listing_id=listing.id,market_listed_at=now()
    where user_id=p_user_id and cosmetic_id=p_cosmetic_id;
  return jsonb_build_object('duplicateRequest',false,'listingId',listing.id,'cosmeticId',listing.cosmetic_id,'price',listing.price,'status',listing.status,'createdAt',listing.created_at,'expiresAt',listing.expires_at);
end $$;

alter table public.boss_assaults add column if not exists checkpoint_token_hash text;
alter table public.boss_assaults add column if not exists previous_checkpoint_token_hash text;
alter table public.boss_assaults add column if not exists last_checkpoint_phase integer not null default 0;
alter table public.boss_assaults add column if not exists checkpoint_verified_at timestamptz;
create table if not exists public.boss_assault_checkpoints(
  assault_id uuid not null references public.boss_assaults(id) on delete cascade,
  phase integer not null check(phase between 1 and 2), elapsed_ms integer not null, damage integer not null,
  accepted_at timestamptz not null default now(), primary key(assault_id,phase)
);
alter table public.boss_assault_checkpoints enable row level security;
revoke all on public.boss_assault_checkpoints from public,anon,authenticated;

create or replace function public.attach_boss_checkpoint_token(p_user_id uuid,p_assault_id uuid,p_token_hash text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a public.boss_assaults%rowtype;
begin
  select * into a from public.boss_assaults where id=p_assault_id for update;
  if not found or a.user_id<>p_user_id then return jsonb_build_object('error','ASSAULT_NOT_FOUND'); end if;
  if a.status<>'active' then return jsonb_build_object('error','ASSAULT_NOT_ACTIVE'); end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then return jsonb_build_object('error','TOKEN_INVALID'); end if;
  update public.boss_assaults set checkpoint_token_hash=p_token_hash,last_checkpoint_phase=0 where id=p_assault_id;
  delete from public.boss_assault_checkpoints where assault_id=p_assault_id;
  return jsonb_build_object('attached',true);
end $$;
revoke all on function public.attach_boss_checkpoint_token(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.attach_boss_checkpoint_token(uuid,uuid,text) to service_role;

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
  if p_elapsed_ms < p_phase*30000-5000 or p_elapsed_ms > p_phase*30000+15000
     or p_elapsed_ms > extract(epoch from(now()-a.issued_at))*1000+5000 then return jsonb_build_object('error','CHECKPOINT_TIME_INVALID'); end if;
  cap:=ceil(coalesce((a.phase_ceiling->>(p_phase-1))::numeric,0)*1.10);
  if p_damage<0 or p_damage>cap then return jsonb_build_object('error','CHECKPOINT_DAMAGE_INVALID'); end if;
  insert into public.boss_assault_checkpoints(assault_id,phase,elapsed_ms,damage) values(p_assault_id,p_phase,p_elapsed_ms,p_damage);
  update public.boss_assaults set previous_checkpoint_token_hash=p_token_hash,checkpoint_token_hash=p_next_token_hash,last_checkpoint_phase=p_phase,checkpoint_verified_at=now() where id=p_assault_id;
  return jsonb_build_object('acceptedAt',now());
end $$;
revoke all on function public.record_boss_assault_checkpoint(uuid,uuid,text,text,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.record_boss_assault_checkpoint(uuid,uuid,text,text,integer,integer,integer) to service_role;

create or replace function public.settle_verified_boss_assault(p_user_id uuid,p_assault_id uuid,p_request_id uuid,p_elapsed_ms integer,p_phase_damage jsonb,p_outcome text,p_targets_destroyed integer,p_token_hash text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a public.boss_assaults%rowtype; cp1 integer; cp2 integer;
begin
  select * into a from public.boss_assaults where id=p_assault_id for update;
  if not found then return jsonb_build_object('error','ASSAULT_NOT_FOUND'); end if;
  if a.status='settled' then
    return public.settle_boss_assault(p_user_id,p_assault_id,p_request_id,p_elapsed_ms,p_phase_damage,p_outcome,p_targets_destroyed);
  end if;
  if a.user_id<>p_user_id then return jsonb_build_object('error','ASSAULT_OWNER_MISMATCH'); end if;
  if a.checkpoint_token_hash<>p_token_hash then return jsonb_build_object('error','CHECKPOINT_TOKEN_INVALID'); end if;
  if p_elapsed_ms>=30000 and a.last_checkpoint_phase<1 then return jsonb_build_object('error','PHASE_CHECKPOINT_MISSING'); end if;
  if p_elapsed_ms>=60000 and a.last_checkpoint_phase<2 then return jsonb_build_object('error','PHASE_CHECKPOINT_MISSING'); end if;
  select damage into cp1 from public.boss_assault_checkpoints where assault_id=p_assault_id and phase=1;
  select damage into cp2 from public.boss_assault_checkpoints where assault_id=p_assault_id and phase=2;
  if p_elapsed_ms>=30000 and coalesce((p_phase_damage->>0)::integer,-1)<>cp1 then return jsonb_build_object('error','PHASE_DAMAGE_MISMATCH'); end if;
  if p_elapsed_ms>=60000 and coalesce((p_phase_damage->>1)::integer,-1)<>cp2 then return jsonb_build_object('error','PHASE_DAMAGE_MISMATCH'); end if;
  return public.settle_boss_assault(p_user_id,p_assault_id,p_request_id,p_elapsed_ms,p_phase_damage,p_outcome,p_targets_destroyed);
end $$;
revoke all on function public.settle_verified_boss_assault(uuid,uuid,uuid,integer,jsonb,text,integer,text) from public,anon,authenticated;
grant execute on function public.settle_verified_boss_assault(uuid,uuid,uuid,integer,jsonb,text,integer,text) to service_role;

commit;
