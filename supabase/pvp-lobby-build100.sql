-- Build 100 / PvP Pass 1: server-owned challenge discovery and membership.
-- Durable Objects own per-room coordination; this table is the durable discovery index.

create table if not exists public.pvp_challenges (
  id uuid primary key,
  invite_code text not null unique check (invite_code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  guest_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'waiting' check (status in ('waiting', 'matched', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  matched_at timestamptz,
  closed_at timestamptz,
  check (guest_user_id is null or guest_user_id <> host_user_id),
  check (expires_at > created_at)
);

create index if not exists pvp_challenges_open_idx
  on public.pvp_challenges (created_at desc)
  where status = 'waiting';
create index if not exists pvp_challenges_expiry_idx
  on public.pvp_challenges (expires_at)
  where status in ('waiting', 'matched');
create unique index if not exists pvp_challenges_one_active_host
  on public.pvp_challenges (host_user_id)
  where status in ('waiting', 'matched');
create unique index if not exists pvp_challenges_one_active_guest
  on public.pvp_challenges (guest_user_id)
  where guest_user_id is not null and status = 'matched';

alter table public.pvp_challenges enable row level security;
revoke all on table public.pvp_challenges from public, anon, authenticated;

create or replace function public.expire_pvp_challenges(p_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare affected integer := 0;
begin
  with due as (
    select id
      from public.pvp_challenges
     where status in ('waiting', 'matched') and expires_at <= now()
     order by expires_at
     for update skip locked
     limit least(greatest(coalesce(p_limit, 100), 1), 500)
  )
  update public.pvp_challenges c
     set status = 'expired', updated_at = now(), closed_at = coalesce(closed_at, now())
    from due
   where c.id = due.id;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.create_pvp_challenge(
  p_host_user_id uuid,
  p_challenge_id uuid,
  p_invite_code text,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare existing public.pvp_challenges%rowtype;
declare created public.pvp_challenges%rowtype;
begin
  if p_host_user_id is null or p_challenge_id is null
     or p_invite_code !~ '^[A-HJ-NP-Z2-9]{8}$'
     or p_expires_at <= now() or p_expires_at > now() + interval '20 minutes' then
    return jsonb_build_object('error', 'INVALID_CHALLENGE');
  end if;
  if not exists (
    select 1 from auth.users u where u.id = p_host_user_id and not u.is_anonymous
  ) or not exists (select 1 from public.player_profiles p where p.user_id = p_host_user_id) then
    return jsonb_build_object('error', 'ACCOUNT_REQUIRED');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('pvp-player:' || p_host_user_id::text, 0));
  perform public.expire_pvp_challenges(100);
  if exists (
    select 1 from public.pvp_challenges
     where guest_user_id = p_host_user_id and status = 'matched'
  ) then return jsonb_build_object('error', 'PLAYER_BUSY'); end if;
  select * into existing
    from public.pvp_challenges
   where host_user_id = p_host_user_id and status in ('waiting', 'matched')
   order by created_at desc limit 1 for update;
  if found then
    return jsonb_build_object(
      'challengeId', existing.id, 'inviteCode', existing.invite_code,
      'status', existing.status, 'expiresAt', existing.expires_at,
      'duplicateRequest', true
    );
  end if;

  insert into public.pvp_challenges (id, invite_code, host_user_id, expires_at)
  values (p_challenge_id, p_invite_code, p_host_user_id, p_expires_at)
  returning * into created;
  return jsonb_build_object(
    'challengeId', created.id, 'inviteCode', created.invite_code,
    'status', created.status, 'expiresAt', created.expires_at,
    'duplicateRequest', false
  );
exception
  when unique_violation then
    return jsonb_build_object('error', 'CHALLENGE_CONFLICT');
end;
$$;

create or replace function public.join_pvp_challenge(p_guest_user_id uuid, p_challenge_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare challenge public.pvp_challenges%rowtype;
begin
  if p_guest_user_id is null or p_challenge_id is null then
    return jsonb_build_object('error', 'INVALID_CHALLENGE');
  end if;
  if not exists (
    select 1 from auth.users u where u.id = p_guest_user_id and not u.is_anonymous
  ) or not exists (select 1 from public.player_profiles p where p.user_id = p_guest_user_id) then
    return jsonb_build_object('error', 'ACCOUNT_REQUIRED');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('pvp-player:' || p_guest_user_id::text, 0));
  select * into challenge from public.pvp_challenges where id = p_challenge_id for update;
  if not found then return jsonb_build_object('error', 'CHALLENGE_NOT_FOUND'); end if;
  if challenge.expires_at <= now() and challenge.status in ('waiting', 'matched') then
    update public.pvp_challenges set status = 'expired', updated_at = now(), closed_at = now() where id = challenge.id;
    return jsonb_build_object('error', 'CHALLENGE_EXPIRED');
  end if;
  if challenge.host_user_id = p_guest_user_id then return jsonb_build_object('error', 'SELF_JOIN'); end if;
  if challenge.status = 'matched' and challenge.guest_user_id = p_guest_user_id then
    return jsonb_build_object('challengeId', challenge.id, 'status', 'matched', 'duplicateRequest', true);
  end if;
  if challenge.status <> 'waiting' or challenge.guest_user_id is not null then
    return jsonb_build_object('error', 'CHALLENGE_UNAVAILABLE');
  end if;
  if exists (
    select 1 from public.pvp_challenges
     where status in ('waiting', 'matched')
       and (host_user_id = p_guest_user_id or guest_user_id = p_guest_user_id)
  ) then return jsonb_build_object('error', 'PLAYER_BUSY'); end if;

  update public.pvp_challenges
     set guest_user_id = p_guest_user_id, status = 'matched', matched_at = now(), updated_at = now()
   where id = challenge.id;
  return jsonb_build_object('challengeId', challenge.id, 'status', 'matched', 'duplicateRequest', false);
end;
$$;

create or replace function public.cancel_pvp_challenge(p_user_id uuid, p_challenge_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare challenge public.pvp_challenges%rowtype;
begin
  select * into challenge from public.pvp_challenges where id = p_challenge_id for update;
  if not found then return jsonb_build_object('error', 'CHALLENGE_NOT_FOUND'); end if;
  if p_user_id is distinct from challenge.host_user_id and p_user_id is distinct from challenge.guest_user_id then
    return jsonb_build_object('error', 'NOT_PARTICIPANT');
  end if;
  if challenge.status in ('cancelled', 'expired') then
    return jsonb_build_object('challengeId', challenge.id, 'status', challenge.status, 'duplicateRequest', true);
  end if;
  update public.pvp_challenges
     set status = 'cancelled', updated_at = now(), closed_at = now()
   where id = challenge.id;
  return jsonb_build_object('challengeId', challenge.id, 'status', 'cancelled', 'duplicateRequest', false);
end;
$$;

create or replace function public.leave_pvp_challenge(p_guest_user_id uuid, p_challenge_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare challenge public.pvp_challenges%rowtype;
begin
  select * into challenge from public.pvp_challenges where id = p_challenge_id for update;
  if not found then return jsonb_build_object('error', 'CHALLENGE_NOT_FOUND'); end if;
  if challenge.status = 'waiting' and challenge.guest_user_id is null then
    return jsonb_build_object('challengeId', challenge.id, 'status', 'waiting', 'duplicateRequest', true);
  end if;
  if challenge.status <> 'matched' or p_guest_user_id is distinct from challenge.guest_user_id then
    return jsonb_build_object('error', 'NOT_GUEST');
  end if;
  update public.pvp_challenges
     set guest_user_id = null, status = 'waiting', matched_at = null, updated_at = now()
   where id = challenge.id;
  return jsonb_build_object('challengeId', challenge.id, 'status', 'waiting', 'duplicateRequest', false);
end;
$$;

create or replace function public.pvp_open_challenges(p_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare result jsonb;
begin
  perform public.expire_pvp_challenges(100);
  select coalesce(jsonb_agg(item order by item_created_at desc), '[]'::jsonb) into result
  from (
    select c.created_at as item_created_at,
      jsonb_build_object(
        'challengeId', c.id,
        'status', c.status,
        'createdAt', c.created_at,
        'expiresAt', c.expires_at,
        'host', jsonb_build_object(
          'callsign', p.display_name,
          'publicId', case when p.is_public then p.public_id else null end,
          'equippedShip', coalesce(w.equipped_ship, 'ship_default')
        )
      ) as item
    from public.pvp_challenges c
    join public.player_profiles p on p.user_id = c.host_user_id
    left join public.player_wallets w on w.user_id = c.host_user_id
    where c.status = 'waiting' and c.expires_at > now()
    order by c.created_at desc
    limit least(greatest(coalesce(p_limit, 20), 1), 40)
  ) listed;
  return result;
end;
$$;

create or replace function public.pvp_challenge_snapshot(
  p_viewer_user_id uuid,
  p_challenge_id uuid default null,
  p_invite_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare c public.pvp_challenges%rowtype;
declare viewer_role text := 'spectator';
declare host jsonb;
declare guest jsonb;
begin
  perform public.expire_pvp_challenges(100);
  select * into c from public.pvp_challenges
   where (p_challenge_id is not null and id = p_challenge_id)
      or (p_challenge_id is null and p_invite_code is not null and invite_code = upper(p_invite_code))
   order by created_at desc limit 1;
  if not found then return jsonb_build_object('error', 'CHALLENGE_NOT_FOUND'); end if;
  if p_viewer_user_id = c.host_user_id then viewer_role := 'host';
  elsif p_viewer_user_id = c.guest_user_id then viewer_role := 'guest'; end if;
  if viewer_role = 'spectator' and c.status <> 'waiting' then
    return jsonb_build_object('error', 'CHALLENGE_NOT_FOUND');
  end if;

  select jsonb_build_object(
    'callsign', p.display_name,
    'publicId', case when p.is_public then p.public_id else null end,
    'equippedShip', coalesce(w.equipped_ship, 'ship_default')
  ) into host
  from public.player_profiles p left join public.player_wallets w on w.user_id = p.user_id
  where p.user_id = c.host_user_id;

  if viewer_role <> 'spectator' and c.guest_user_id is not null then
    select jsonb_build_object(
      'callsign', p.display_name,
      'publicId', case when p.is_public then p.public_id else null end,
      'equippedShip', coalesce(w.equipped_ship, 'ship_default')
    ) into guest
    from public.player_profiles p left join public.player_wallets w on w.user_id = p.user_id
    where p.user_id = c.guest_user_id;
  end if;

  return jsonb_build_object(
    'challengeId', c.id,
    'inviteCode', case when viewer_role <> 'spectator' then c.invite_code else null end,
    'status', c.status,
    'viewerRole', viewer_role,
    'createdAt', c.created_at,
    'expiresAt', c.expires_at,
    'matchedAt', c.matched_at,
    'host', host,
    'guest', guest
  );
end;
$$;

revoke all on function public.expire_pvp_challenges(integer) from public, anon, authenticated;
revoke all on function public.create_pvp_challenge(uuid, uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.join_pvp_challenge(uuid, uuid) from public, anon, authenticated;
revoke all on function public.cancel_pvp_challenge(uuid, uuid) from public, anon, authenticated;
revoke all on function public.leave_pvp_challenge(uuid, uuid) from public, anon, authenticated;
revoke all on function public.pvp_open_challenges(integer) from public, anon, authenticated;
revoke all on function public.pvp_challenge_snapshot(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.expire_pvp_challenges(integer) to service_role;
grant execute on function public.create_pvp_challenge(uuid, uuid, text, timestamptz) to service_role;
grant execute on function public.join_pvp_challenge(uuid, uuid) to service_role;
grant execute on function public.cancel_pvp_challenge(uuid, uuid) to service_role;
grant execute on function public.leave_pvp_challenge(uuid, uuid) to service_role;
grant execute on function public.pvp_open_challenges(integer) to service_role;
grant execute on function public.pvp_challenge_snapshot(uuid, uuid, text) to service_role;
