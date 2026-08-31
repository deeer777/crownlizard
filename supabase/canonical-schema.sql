-- GENERATED FILE. Do not edit directly.
-- Rebuild with: node tools/build-canonical-schema.mjs
-- Safe bootstrap order for a new Crown Lizard Supabase project.

-- SOURCE: supabase/schema.sql
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
  initials text check (initials ~ '^[A-Z0-9]{3}$'),
  user_id uuid references auth.users(id) on delete set null,
  player_name text not null check (
    char_length(player_name) between 3 and 10
    and player_name ~ '^[A-Z0-9][A-Z0-9_]*[A-Z0-9]$'
  ),
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

-- Server-authoritative player identity and Crown Vault state.
alter table public.leaderboard_runs
  add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.leaderboard_runs
  add column if not exists economy_settled_at timestamptz;

-- Build 72 keeps guest initials while binding permanent leaderboard entries to
-- the account and a callsign snapshot. Current profile names are resolved by
-- the edge API when the board is read.
alter table public.leaderboard_scores
  add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.leaderboard_scores
  add column if not exists player_name text;
update public.leaderboard_scores
   set player_name = initials
 where player_name is null;
create or replace function public.fill_legacy_leaderboard_player_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.player_name is null then new.player_name := new.initials; end if;
  return new;
end;
$$;
drop trigger if exists leaderboard_scores_legacy_name on public.leaderboard_scores;
create trigger leaderboard_scores_legacy_name
before insert on public.leaderboard_scores
for each row execute function public.fill_legacy_leaderboard_player_name();
alter table public.leaderboard_scores
  alter column player_name set not null;
alter table public.leaderboard_scores
  alter column initials drop not null;
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
     where conname = 'leaderboard_scores_player_name_check'
       and conrelid = 'public.leaderboard_scores'::regclass
  ) then
    alter table public.leaderboard_scores
      add constraint leaderboard_scores_player_name_check check (
        char_length(player_name) between 3 and 10
        and player_name ~ '^[A-Z0-9][A-Z0-9_]*[A-Z0-9]$'
      );
  end if;
end
$$;
create index if not exists leaderboard_scores_user_idx
  on public.leaderboard_scores (user_id, created_at desc);

create table if not exists public.player_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance between 0 and 1000000000),
  opens integer not null default 0 check (opens between 0 and 1000000000),
  since_sovereign integer not null default 0 check (since_sovereign between 0 and 199),
  equipped_ship text not null default 'ship_default',
  equipped_weapon_skins jsonb not null default '{}'::jsonb,
  legacy_imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.player_wallets
  add column if not exists equipped_weapon_skins jsonb not null default '{}'::jsonb;

create table if not exists public.player_inventory (
  user_id uuid not null references auth.users(id) on delete cascade,
  cosmetic_id text not null,
  source text not null check (source in ('crate', 'shop', 'sponsored', 'grant', 'legacy', 'market')),
  acquired_at timestamptz not null default now(),
  seen_at timestamptz,
  primary key (user_id, cosmetic_id)
);

alter table public.player_inventory
  add column if not exists seen_at timestamptz;

create table if not exists public.cosmetic_catalog (
  id text primary key,
  rarity text not null check (rarity in ('uncommon', 'rare', 'royal', 'mythic', 'sovereign')),
  sort_order integer not null,
  active boolean not null default true,
  acquisition_source text not null default 'crate' check (acquisition_source in ('crate', 'store', 'event'))
);

alter table public.cosmetic_catalog
  add column if not exists acquisition_source text not null default 'crate';
alter table public.cosmetic_catalog
  add column if not exists slot text not null default 'ship';
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
     where conname = 'cosmetic_catalog_slot_check'
       and conrelid = 'public.cosmetic_catalog'::regclass
  ) then
    alter table public.cosmetic_catalog
      add constraint cosmetic_catalog_slot_check
      check (slot in ('ship', 'weapon_laser', 'weapon_tesla', 'weapon_pulse'));
  end if;
end
$$;
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
     where conname = 'cosmetic_catalog_acquisition_source_check'
       and conrelid = 'public.cosmetic_catalog'::regclass
  ) then
    alter table public.cosmetic_catalog
      add constraint cosmetic_catalog_acquisition_source_check
      check (acquisition_source in ('crate', 'store', 'event'));
  end if;
end
$$;

insert into public.cosmetic_catalog (id, rarity, sort_order) values
  ('ship_verdant_scout', 'uncommon', 10),
  ('ship_ember_runner', 'uncommon', 20),
  ('ship_crystal_dart', 'uncommon', 30),
  ('ship_void_hunter', 'rare', 40),
  ('ship_solar_guard', 'rare', 50),
  ('ship_royal_vanguard', 'royal', 60),
  ('ship_rift_phantom', 'mythic', 70),
  ('ship_crown_sovereign', 'sovereign', 80)
on conflict (id) do update
  set rarity = excluded.rarity,
      sort_order = excluded.sort_order,
      active = true;

insert into public.cosmetic_catalog (id, rarity, sort_order, acquisition_source) values
  ('ship_gilded_viper', 'royal', 110, 'store'),
  ('ship_neon_basilisk', 'mythic', 120, 'store')
on conflict (id) do update
  set rarity = excluded.rarity,
      sort_order = excluded.sort_order,
      acquisition_source = excluded.acquisition_source,
      active = true;

insert into public.cosmetic_catalog (id, rarity, sort_order, acquisition_source, slot) values
  ('weapon_tesla_verdant_chain', 'uncommon', 210, 'crate', 'weapon_tesla'),
  ('weapon_tesla_storm_crown', 'rare', 220, 'crate', 'weapon_tesla'),
  ('weapon_laser_void_lance', 'mythic', 230, 'crate', 'weapon_laser'),
  ('weapon_pulse_sovereign_eclipse', 'sovereign', 240, 'crate', 'weapon_pulse'),
  ('weapon_laser_royal_prism', 'royal', 250, 'store', 'weapon_laser'),
  ('weapon_pulse_solar_core', 'royal', 260, 'store', 'weapon_pulse')
on conflict (id) do update
  set rarity = excluded.rarity,
      sort_order = excluded.sort_order,
      acquisition_source = excluded.acquisition_source,
      slot = excluded.slot,
      active = true;

create table if not exists public.store_catalog (
  sku text primary key,
  product_type text not null check (product_type in ('cosmetic', 'service')),
  cosmetic_id text references public.cosmetic_catalog(id) on delete restrict,
  name text not null,
  description text not null,
  price integer not null check (price between 1 and 1000000),
  rarity text not null check (rarity in ('standard', 'uncommon', 'rare', 'royal', 'mythic', 'sovereign')),
  sort_order integer not null,
  active boolean not null default true,
  available_from timestamptz,
  available_until timestamptz,
  check ((product_type = 'cosmetic' and cosmetic_id is not null) or (product_type = 'service' and cosmetic_id is null))
);

insert into public.store_catalog (sku, product_type, cosmetic_id, name, description, price, rarity, sort_order) values
  ('store_ship_gilded_viper', 'cosmetic', 'ship_gilded_viper', 'GILDED VIPER', 'STORE-EXCLUSIVE SHIP CHASSIS', 1250, 'royal', 10),
  ('store_ship_neon_basilisk', 'cosmetic', 'ship_neon_basilisk', 'NEON BASILISK', 'STORE-EXCLUSIVE SHIP CHASSIS', 2500, 'mythic', 20),
  ('service_callsign_rename', 'service', null, 'CALLSIGN CHANGE', 'NEW ARCADE ID · 7 DAY COOLDOWN', 500, 'standard', 30)
on conflict (sku) do update
  set product_type = excluded.product_type,
      cosmetic_id = excluded.cosmetic_id,
      name = excluded.name,
      description = excluded.description,
      price = excluded.price,
      rarity = excluded.rarity,
      sort_order = excluded.sort_order,
      active = true;

insert into public.store_catalog (sku, product_type, cosmetic_id, name, description, price, rarity, sort_order) values
  ('store_weapon_laser_royal_prism', 'cosmetic', 'weapon_laser_royal_prism', 'ROYAL PRISM', 'STORE-EXCLUSIVE LASER SKIN', 950, 'royal', 40),
  ('store_weapon_pulse_solar_core', 'cosmetic', 'weapon_pulse_solar_core', 'SOLAR CORE', 'STORE-EXCLUSIVE PULSE SKIN', 1100, 'royal', 50)
on conflict (sku) do update
  set product_type = excluded.product_type,
      cosmetic_id = excluded.cosmetic_id,
      name = excluded.name,
      description = excluded.description,
      price = excluded.price,
      rarity = excluded.rarity,
      sort_order = excluded.sort_order,
      active = true;

create table if not exists public.economy_transactions (
  id bigint generated by default as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  external_id text not null,
  kind text not null,
  amount integer not null,
  balance_after integer not null check (balance_after between 0 and 1000000000),
  run_id uuid references public.leaderboard_runs(id) on delete restrict,
  opening_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, external_id)
);

create table if not exists public.auth_bootstrap_events (
  id bigint generated by default as identity primary key,
  ip_hash text not null check (char_length(ip_hash) = 64),
  created_at timestamptz not null default now()
);

create index if not exists player_inventory_user_idx
  on public.player_inventory (user_id, acquired_at);
create index if not exists economy_transactions_user_idx
  on public.economy_transactions (user_id, created_at desc);
create index if not exists auth_bootstrap_events_rate_idx
  on public.auth_bootstrap_events (ip_hash, created_at desc);

alter table public.player_wallets enable row level security;
alter table public.player_inventory enable row level security;
alter table public.cosmetic_catalog enable row level security;
alter table public.store_catalog enable row level security;
alter table public.economy_transactions enable row level security;
alter table public.auth_bootstrap_events enable row level security;

revoke all on table public.player_wallets from anon, authenticated;
revoke all on table public.player_inventory from anon, authenticated;
revoke all on table public.cosmetic_catalog from anon, authenticated;
revoke all on table public.store_catalog from anon, authenticated;
revoke all on table public.economy_transactions from anon, authenticated;
revoke all on table public.auth_bootstrap_events from anon, authenticated;

-- One-time legacy import. Only the server-side service role may execute it.
create or replace function public.import_legacy_wallet(
  p_user_id uuid,
  p_balance integer,
  p_opens integer,
  p_since_sovereign integer,
  p_equipped_ship text,
  p_cosmetic_ids text[]
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  imported boolean := false;
begin
  update public.player_wallets
     set balance = p_balance,
         opens = p_opens,
         since_sovereign = p_since_sovereign,
         equipped_ship = p_equipped_ship,
         legacy_imported_at = now(),
         updated_at = now()
   where user_id = p_user_id
     and legacy_imported_at is null
     and balance = 0
     and opens = 0;

  imported := found;
  if not imported then return false; end if;

  insert into public.player_inventory (user_id, cosmetic_id, source)
  select p_user_id, cosmetic_id, 'legacy'
    from unnest(p_cosmetic_ids) as cosmetic_id
  on conflict (user_id, cosmetic_id) do nothing;

  insert into public.economy_transactions (user_id, external_id, kind, amount, balance_after, metadata)
  values (p_user_id, 'legacy-import', 'legacy_import', p_balance, p_balance,
    jsonb_build_object('opens', p_opens, 'cosmetics', cardinality(p_cosmetic_ids)));
  return true;
end;
$$;

revoke all on function public.import_legacy_wallet(uuid, integer, integer, integer, text, text[]) from public, anon, authenticated;
grant execute on function public.import_legacy_wallet(uuid, integer, integer, integer, text, text[]) to service_role;

-- Atomically credits one verified server run exactly once.
create or replace function public.settle_run_reward(
  p_user_id uuid,
  p_run_id uuid,
  p_amount integer,
  p_reward jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_row public.leaderboard_runs%rowtype;
  wallet_balance integer;
  existing_tx public.economy_transactions%rowtype;
begin
  if p_amount < 0 or p_amount > 150 then
    raise exception 'invalid reward amount';
  end if;

  select * into run_row
    from public.leaderboard_runs
   where id = p_run_id
   for update;

  if not found then raise exception 'run not found'; end if;
  if run_row.user_id is distinct from p_user_id then raise exception 'run owner mismatch'; end if;

  select * into existing_tx
    from public.economy_transactions
   where user_id = p_user_id and external_id = 'run:' || p_run_id::text;

  if found then
    return jsonb_build_object(
      'duplicate', true,
      'balance', existing_tx.balance_after,
      'amount', existing_tx.amount,
      'reward', existing_tx.metadata
    );
  end if;

  if run_row.economy_settled_at is not null then raise exception 'run already settled'; end if;

  insert into public.player_wallets (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  update public.player_wallets
     set balance = balance + p_amount,
         updated_at = now()
   where user_id = p_user_id
   returning balance into wallet_balance;

  update public.leaderboard_runs
     set economy_settled_at = now()
   where id = p_run_id;

  insert into public.economy_transactions (user_id, external_id, kind, amount, balance_after, run_id, metadata)
  values (p_user_id, 'run:' || p_run_id::text, 'run_reward', p_amount, wallet_balance, p_run_id, p_reward);

  return jsonb_build_object(
    'duplicate', false,
    'balance', wallet_balance,
    'amount', p_amount,
    'reward', p_reward
  );
end;
$$;

revoke all on function public.settle_run_reward(uuid, uuid, integer, jsonb) from public, anon, authenticated;
grant execute on function public.settle_run_reward(uuid, uuid, integer, jsonb) to service_role;

-- Atomically opens one paid Crown Crate. Random rolls come only from the trusted
-- Cloudflare function; all balance, pity and duplicate decisions happen under lock.
create or replace function public.open_crown_crate(
  p_user_id uuid,
  p_opening_id uuid,
  p_tier_roll integer,
  p_cosmetic_roll integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  wallet public.player_wallets%rowtype;
  existing_tx public.economy_transactions%rowtype;
  selected_tier text;
  selected_cosmetic text;
  guaranteed boolean;
  is_duplicate boolean;
  salvage integer;
  candidate_count integer;
  opening_number integer;
  resulting_balance integer;
  outcome jsonb;
begin
  if p_tier_roll < 0 or p_tier_roll > 9999 then raise exception 'invalid tier roll'; end if;
  if p_cosmetic_roll < 0 or p_cosmetic_roll > 999999 then raise exception 'invalid cosmetic roll'; end if;

  insert into public.player_wallets (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into wallet
    from public.player_wallets
   where user_id = p_user_id
   for update;

  select * into existing_tx
    from public.economy_transactions
   where user_id = p_user_id and external_id = 'crate:' || p_opening_id::text;

  if found then
    return jsonb_build_object(
      'duplicateRequest', true,
      'balance', existing_tx.balance_after,
      'outcome', existing_tx.metadata->'outcome'
    );
  end if;

  if wallet.balance < 150 then
    return jsonb_build_object('error', 'NOT_ENOUGH_SHARDS', 'balance', wallet.balance);
  end if;

  guaranteed := wallet.since_sovereign >= 199;
  selected_tier := case
    when guaranteed then 'sovereign'
    when p_tier_roll < 5800 then 'uncommon'
    when p_tier_roll < 8600 then 'rare'
    when p_tier_roll < 9600 then 'royal'
    when p_tier_roll < 9950 then 'mythic'
    else 'sovereign'
  end;

  select count(*) into candidate_count
    from public.cosmetic_catalog
   where rarity = selected_tier and active and acquisition_source = 'crate';
  if candidate_count = 0 then raise exception 'empty cosmetic tier'; end if;

  select id into selected_cosmetic
    from public.cosmetic_catalog
   where rarity = selected_tier and active and acquisition_source = 'crate'
   order by sort_order
   offset (p_cosmetic_roll % candidate_count)
   limit 1;

  -- Preserve the published first-opening guarantee even after a legacy import.
  if wallet.opens = 0 and exists (
    select 1 from public.player_inventory
     where user_id = p_user_id and cosmetic_id = selected_cosmetic
  ) then
    select count(*) into candidate_count
      from public.cosmetic_catalog catalog
     where catalog.rarity = selected_tier and catalog.active and catalog.acquisition_source = 'crate'
       and not exists (
         select 1 from public.player_inventory owned
          where owned.user_id = p_user_id and owned.cosmetic_id = catalog.id
       );

    if candidate_count > 0 then
      select catalog.id into selected_cosmetic
        from public.cosmetic_catalog catalog
       where catalog.rarity = selected_tier and catalog.active and catalog.acquisition_source = 'crate'
         and not exists (
           select 1 from public.player_inventory owned
            where owned.user_id = p_user_id and owned.cosmetic_id = catalog.id
         )
       order by catalog.sort_order
       offset (p_cosmetic_roll % candidate_count)
       limit 1;
    else
      select count(*) into candidate_count
        from public.cosmetic_catalog catalog
       where catalog.active and catalog.acquisition_source = 'crate'
         and not exists (
           select 1 from public.player_inventory owned
            where owned.user_id = p_user_id and owned.cosmetic_id = catalog.id
         );
      if candidate_count > 0 then
        select catalog.id into selected_cosmetic
          from public.cosmetic_catalog catalog
         where catalog.active and catalog.acquisition_source = 'crate'
           and not exists (
             select 1 from public.player_inventory owned
              where owned.user_id = p_user_id and owned.cosmetic_id = catalog.id
           )
         order by catalog.sort_order
         offset (p_cosmetic_roll % candidate_count)
         limit 1;
        select rarity into selected_tier from public.cosmetic_catalog where id = selected_cosmetic;
      end if;
    end if;
  end if;

  select exists (
    select 1 from public.player_inventory
     where user_id = p_user_id and cosmetic_id = selected_cosmetic
  ) into is_duplicate;

  salvage := case selected_tier
    when 'uncommon' then 15
    when 'rare' then 35
    when 'royal' then 75
    when 'mythic' then 150
    when 'sovereign' then 300
    else 0
  end;
  if not is_duplicate then salvage := 0; end if;

  opening_number := wallet.opens + 1;
  resulting_balance := wallet.balance - 150 + salvage;

  if not is_duplicate then
    insert into public.player_inventory (user_id, cosmetic_id, source)
    values (p_user_id, selected_cosmetic, 'crate')
    on conflict (user_id, cosmetic_id) do nothing;
  end if;

  update public.player_wallets
     set balance = resulting_balance,
         opens = opening_number,
         since_sovereign = case when selected_tier = 'sovereign' then 0 else least(199, wallet.since_sovereign + 1) end,
         updated_at = now()
   where user_id = p_user_id;

  outcome := jsonb_build_object(
    'openingId', p_opening_id,
    'openingNumber', opening_number,
    'cosmeticId', selected_cosmetic,
    'tier', selected_tier,
    'duplicate', is_duplicate,
    'salvageValue', salvage,
    'guaranteedSovereign', guaranteed,
    'source', 'crate',
    'createdAt', now()
  );

  insert into public.economy_transactions (user_id, external_id, kind, amount, balance_after, opening_id, metadata)
  values (
    p_user_id,
    'crate:' || p_opening_id::text,
    'crate_open',
    -150 + salvage,
    resulting_balance,
    p_opening_id,
    jsonb_build_object('cost', 150, 'salvage', salvage, 'outcome', outcome)
  );

  return jsonb_build_object('duplicateRequest', false, 'balance', resulting_balance, 'outcome', outcome);
end;
$$;

revoke all on function public.open_crown_crate(uuid, uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.open_crown_crate(uuid, uuid, integer, integer) to service_role;

-- Atomically purchases one active direct-sale cosmetic. The database resolves
-- the SKU and price; browser-supplied product details are never trusted.
create or replace function public.purchase_store_cosmetic(
  p_user_id uuid,
  p_sku text,
  p_request_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  wallet public.player_wallets%rowtype;
  product public.store_catalog%rowtype;
  existing_tx public.economy_transactions%rowtype;
  resulting_balance integer;
  purchased_at timestamptz;
  outcome jsonb;
begin
  if p_user_id is null or p_request_id is null or p_sku is null then
    return jsonb_build_object('error', 'INVALID_REQUEST');
  end if;

  insert into public.player_wallets (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into wallet
    from public.player_wallets
   where user_id = p_user_id
   for update;

  select * into existing_tx
    from public.economy_transactions
   where user_id = p_user_id and external_id = 'store:' || p_request_id::text;
  if found then
    return jsonb_build_object(
      'duplicateRequest', true,
      'balance', existing_tx.balance_after,
      'purchase', existing_tx.metadata->'purchase'
    );
  end if;

  select * into product
    from public.store_catalog
   where sku = p_sku
     and product_type = 'cosmetic'
     and active
     and (available_from is null or available_from <= now())
     and (available_until is null or available_until > now());
  if not found then return jsonb_build_object('error', 'PRODUCT_UNAVAILABLE'); end if;

  if not exists (
    select 1 from public.cosmetic_catalog
     where id = product.cosmetic_id and active and acquisition_source = 'store'
  ) then
    return jsonb_build_object('error', 'PRODUCT_UNAVAILABLE');
  end if;

  if exists (
    select 1 from public.player_inventory
     where user_id = p_user_id and cosmetic_id = product.cosmetic_id
  ) then
    return jsonb_build_object('error', 'ALREADY_OWNED', 'balance', wallet.balance, 'cosmeticId', product.cosmetic_id);
  end if;

  if wallet.balance < product.price then
    return jsonb_build_object('error', 'NOT_ENOUGH_SHARDS', 'balance', wallet.balance, 'cost', product.price);
  end if;

  purchased_at := now();
  insert into public.player_inventory (user_id, cosmetic_id, source, acquired_at)
  values (p_user_id, product.cosmetic_id, 'shop', purchased_at);

  update public.player_wallets
     set balance = balance - product.price,
         updated_at = purchased_at
   where user_id = p_user_id
   returning balance into resulting_balance;

  outcome := jsonb_build_object(
    'sku', product.sku,
    'type', product.product_type,
    'cosmeticId', product.cosmetic_id,
    'name', product.name,
    'price', product.price,
    'rarity', product.rarity,
    'purchasedAt', purchased_at
  );

  insert into public.economy_transactions (user_id, external_id, kind, amount, balance_after, metadata)
  values (
    p_user_id,
    'store:' || p_request_id::text,
    'store_purchase',
    -product.price,
    resulting_balance,
    jsonb_build_object('purchase', outcome)
  );

  return jsonb_build_object('duplicateRequest', false, 'balance', resulting_balance, 'purchase', outcome);
end;
$$;

revoke all on function public.purchase_store_cosmetic(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.purchase_store_cosmetic(uuid, text, uuid) to service_role;

create or replace function public.mark_inventory_seen(
  p_user_id uuid,
  p_cosmetic_id text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.player_inventory
     set seen_at = coalesce(seen_at, now())
   where user_id = p_user_id
     and cosmetic_id = p_cosmetic_id;
  return found;
end;
$$;

revoke all on function public.mark_inventory_seen(uuid, text) from public, anon, authenticated;
grant execute on function public.mark_inventory_seen(uuid, text) to service_role;

create or replace function public.equip_player_ship(
  p_user_id uuid,
  p_cosmetic_id text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.player_wallets (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  perform 1 from public.player_wallets
   where user_id = p_user_id
   for update;

  if p_cosmetic_id <> 'ship_default' and not exists (
    select 1
      from public.player_inventory inventory
      join public.cosmetic_catalog catalog on catalog.id = inventory.cosmetic_id and catalog.active
     where inventory.user_id = p_user_id
       and inventory.cosmetic_id = p_cosmetic_id
  ) then
    return false;
  end if;

  update public.player_wallets
     set equipped_ship = p_cosmetic_id,
         updated_at = now()
   where user_id = p_user_id;
  return true;
end;
$$;

revoke all on function public.equip_player_ship(uuid, text) from public, anon, authenticated;
grant execute on function public.equip_player_ship(uuid, text) to service_role;

create or replace function public.equip_player_cosmetic(
  p_user_id uuid,
  p_cosmetic_id text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  cosmetic_slot text;
  weapon_key text;
begin
  insert into public.player_wallets (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  perform 1 from public.player_wallets
   where user_id = p_user_id
   for update;

  if p_cosmetic_id = 'ship_default' then
    cosmetic_slot := 'ship';
  elsif p_cosmetic_id in ('weapon_laser_default', 'weapon_tesla_default', 'weapon_pulse_default') then
    cosmetic_slot := replace(p_cosmetic_id, '_default', '');
  else
    select catalog.slot into cosmetic_slot
      from public.player_inventory inventory
      join public.cosmetic_catalog catalog
        on catalog.id = inventory.cosmetic_id and catalog.active
     where inventory.user_id = p_user_id
       and inventory.cosmetic_id = p_cosmetic_id;
    if cosmetic_slot is null then return false; end if;
  end if;

  if cosmetic_slot = 'ship' then
    update public.player_wallets
       set equipped_ship = p_cosmetic_id,
           updated_at = now()
     where user_id = p_user_id;
  elsif cosmetic_slot in ('weapon_laser', 'weapon_tesla', 'weapon_pulse') then
    weapon_key := replace(cosmetic_slot, 'weapon_', '');
    update public.player_wallets
       set equipped_weapon_skins = jsonb_set(coalesce(equipped_weapon_skins, '{}'::jsonb), array[weapon_key], to_jsonb(p_cosmetic_id), true),
           updated_at = now()
     where user_id = p_user_id;
  else
    return false;
  end if;
  return true;
end;
$$;

revoke all on function public.equip_player_cosmetic(uuid, text) from public, anon, authenticated;
grant execute on function public.equip_player_cosmetic(uuid, text) to service_role;

-- Public player identity. Callsigns are uppercase arcade names and are globally
-- unique without exposing profile writes to browsers.
create table if not exists public.blocked_callsign_terms (
  term text primary key check (term ~ '^[A-Z0-9_]{2,20}$'),
  match_type text not null check (match_type in ('exact', 'contains'))
);

insert into public.blocked_callsign_terms (term, match_type) values
  ('ADMIN', 'exact'),
  ('CROWNLIZARD', 'exact'),
  ('CROWN_LIZARD', 'exact'),
  ('DEVELOPER', 'exact'),
  ('GUEST', 'exact'),
  ('MOD', 'exact'),
  ('MODERATOR', 'exact'),
  ('STAFF', 'exact'),
  ('SUPPORT', 'exact'),
  ('SYSTEM', 'exact'),
  ('FUCK', 'contains'),
  ('SHIT', 'contains'),
  ('BITCH', 'contains'),
  ('CUNT', 'contains'),
  ('NIGGER', 'contains'),
  ('NAZI', 'contains')
on conflict (term) do update set match_type = excluded.match_type;

create table if not exists public.player_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  normalized_name text not null unique,
  rename_count integer not null default 0 check (rename_count between 0 and 1000000),
  last_renamed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_profiles_display_name_check check (
    display_name = normalized_name
    and char_length(display_name) between 3 and 10
    and display_name ~ '^[A-Z0-9][A-Z0-9_]*[A-Z0-9]$'
    and display_name ~ '[A-Z]'
  )
);

alter table public.blocked_callsign_terms enable row level security;
alter table public.player_profiles enable row level security;
revoke all on table public.blocked_callsign_terms from public, anon, authenticated;
revoke all on table public.player_profiles from public, anon, authenticated;

-- Returns an error code rather than raising for expected name conflicts so the
-- edge API can map the result without exposing database details.
create or replace function public.claim_player_callsign(
  p_user_id uuid,
  p_display_name text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  callsign text := upper(btrim(coalesce(p_display_name, '')));
  moderation_key text;
  existing public.player_profiles%rowtype;
  profile public.player_profiles%rowtype;
begin
  if p_user_id is null then return jsonb_build_object('error', 'ACCOUNT_REQUIRED'); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));

  if char_length(callsign) < 3 or char_length(callsign) > 10
     or callsign !~ '^[A-Z0-9][A-Z0-9_]*[A-Z0-9]$'
     or callsign !~ '[A-Z]' then
    return jsonb_build_object('error', 'INVALID_CALLSIGN');
  end if;

  moderation_key := translate(callsign, '013457', 'OIEAST');
  if exists (
    select 1 from public.blocked_callsign_terms blocked
     where (blocked.match_type = 'exact' and moderation_key = blocked.term)
        or (blocked.match_type = 'contains' and strpos(moderation_key, blocked.term) > 0)
  ) then
    return jsonb_build_object('error', 'CALLSIGN_BLOCKED');
  end if;

  select * into existing
    from public.player_profiles
   where user_id = p_user_id;
  if found then
    if existing.normalized_name = callsign then
      return jsonb_build_object(
        'created', false,
        'profile', jsonb_build_object(
          'userId', existing.user_id,
          'displayName', existing.display_name,
          'renameCount', existing.rename_count,
          'lastRenamedAt', existing.last_renamed_at,
          'createdAt', existing.created_at,
          'updatedAt', existing.updated_at
        )
      );
    end if;
    return jsonb_build_object('error', 'CALLSIGN_ALREADY_SET');
  end if;

  begin
    insert into public.player_profiles (user_id, display_name, normalized_name)
    values (p_user_id, callsign, callsign)
    returning * into profile;
  exception when unique_violation then
    return jsonb_build_object('error', 'CALLSIGN_TAKEN');
  end;

  return jsonb_build_object(
    'created', true,
    'profile', jsonb_build_object(
      'userId', profile.user_id,
      'displayName', profile.display_name,
      'renameCount', profile.rename_count,
      'lastRenamedAt', profile.last_renamed_at,
      'createdAt', profile.created_at,
      'updatedAt', profile.updated_at
    )
  );
end;
$$;

revoke all on function public.claim_player_callsign(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_player_callsign(uuid, text) to service_role;

-- Future shop action: one rename costs 500 shards, is idempotent by request ID,
-- and is limited to one successful rename per seven days.
create or replace function public.rename_player_callsign(
  p_user_id uuid,
  p_display_name text,
  p_request_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  callsign text := upper(btrim(coalesce(p_display_name, '')));
  moderation_key text;
  profile public.player_profiles%rowtype;
  wallet public.player_wallets%rowtype;
  existing_tx public.economy_transactions%rowtype;
  resulting_balance integer;
  renamed_at timestamptz;
  outcome jsonb;
begin
  if p_user_id is null then return jsonb_build_object('error', 'ACCOUNT_REQUIRED'); end if;
  if p_request_id is null then return jsonb_build_object('error', 'INVALID_REQUEST'); end if;

  if char_length(callsign) < 3 or char_length(callsign) > 10
     or callsign !~ '^[A-Z0-9][A-Z0-9_]*[A-Z0-9]$'
     or callsign !~ '[A-Z]' then
    return jsonb_build_object('error', 'INVALID_CALLSIGN');
  end if;

  moderation_key := translate(callsign, '013457', 'OIEAST');
  if exists (
    select 1 from public.blocked_callsign_terms blocked
     where (blocked.match_type = 'exact' and moderation_key = blocked.term)
        or (blocked.match_type = 'contains' and strpos(moderation_key, blocked.term) > 0)
  ) then
    return jsonb_build_object('error', 'CALLSIGN_BLOCKED');
  end if;

  insert into public.player_wallets (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into wallet
    from public.player_wallets
   where user_id = p_user_id
   for update;

  select * into existing_tx
    from public.economy_transactions
   where user_id = p_user_id and external_id = 'rename:' || p_request_id::text;
  if found then
    return jsonb_build_object(
      'duplicateRequest', true,
      'balance', existing_tx.balance_after,
      'profile', existing_tx.metadata->'profile'
    );
  end if;

  select * into profile
    from public.player_profiles
   where user_id = p_user_id
   for update;
  if not found then return jsonb_build_object('error', 'PROFILE_REQUIRED'); end if;
  if profile.normalized_name = callsign then
    return jsonb_build_object(
      'duplicateName', true,
      'balance', wallet.balance,
      'profile', jsonb_build_object(
        'userId', profile.user_id,
        'displayName', profile.display_name,
        'renameCount', profile.rename_count,
        'lastRenamedAt', profile.last_renamed_at,
        'createdAt', profile.created_at,
        'updatedAt', profile.updated_at
      )
    );
  end if;
  if profile.last_renamed_at is not null and profile.last_renamed_at > now() - interval '7 days' then
    return jsonb_build_object('error', 'RENAME_COOLDOWN', 'availableAt', profile.last_renamed_at + interval '7 days');
  end if;
  if wallet.balance < 500 then
    return jsonb_build_object('error', 'NOT_ENOUGH_SHARDS', 'balance', wallet.balance, 'cost', 500);
  end if;

  renamed_at := now();
  begin
    update public.player_profiles
       set display_name = callsign,
           normalized_name = callsign,
           rename_count = rename_count + 1,
           last_renamed_at = renamed_at,
           updated_at = renamed_at
     where user_id = p_user_id
     returning * into profile;
  exception when unique_violation then
    return jsonb_build_object('error', 'CALLSIGN_TAKEN');
  end;

  update public.player_wallets
     set balance = balance - 500,
         updated_at = renamed_at
   where user_id = p_user_id
   returning balance into resulting_balance;

  outcome := jsonb_build_object(
    'userId', profile.user_id,
    'displayName', profile.display_name,
    'renameCount', profile.rename_count,
    'lastRenamedAt', profile.last_renamed_at,
    'createdAt', profile.created_at,
    'updatedAt', profile.updated_at
  );

  insert into public.economy_transactions (user_id, external_id, kind, amount, balance_after, metadata)
  values (
    p_user_id,
    'rename:' || p_request_id::text,
    'callsign_rename',
    -500,
    resulting_balance,
    jsonb_build_object('cost', 500, 'profile', outcome)
  );

  return jsonb_build_object('duplicateRequest', false, 'balance', resulting_balance, 'cost', 500, 'profile', outcome);
end;
$$;

revoke all on function public.rename_player_callsign(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.rename_player_callsign(uuid, text, uuid) to service_role;

-- Crown Armory progression. Gameplay power is earned only through verified,
-- server-settled runs; shards, ads and browser storage never write these rows.
create table if not exists public.weapon_blueprint_catalog (
  id text primary key check (id ~ '^[a-z0-9_]{3,64}$'),
  weapon_key text not null check (weapon_key in ('blaster', 'spread', 'pulse', 'laser', 'tesla')),
  mastery_key text,
  name text not null,
  role text not null,
  description text not null,
  sort_order integer not null unique,
  trial_eligible boolean not null default true,
  active boolean not null default true,
  check ((id = 'blaster_standard' and mastery_key is null) or (id <> 'blaster_standard' and mastery_key is not null))
);

insert into public.weapon_blueprint_catalog (id, weapon_key, mastery_key, name, role, description, sort_order, trial_eligible) values
  ('blaster_standard', 'blaster', null, 'STANDARD BLASTER', 'RELIABLE ALL-ROUNDER', 'A free baseline loadout available to every Crown pilot.', 0, false),
  ('blaster_royal_barrage', 'blaster', 'royalBarrage', 'ROYAL BARRAGE', 'CROWD CONTROL', 'Four rapid rounds sweep lanes and ricochet through the swarm.', 10, true),
  ('blaster_crownrail', 'blaster', 'crownrail', 'CROWNRAIL', 'ELITE BREAKER', 'One colossal round punches through armor and entire enemy lines.', 20, true),
  ('spread_halo_guard', 'spread', 'haloGuard', 'HALO GUARD', 'FULL DEFENCE', 'Twin seven-shot fans guard both the bow and stern.', 30, true),
  ('spread_guillotine_fan', 'spread', 'guillotineFan', 'GUILLOTINE FAN', 'FORWARD BURST', 'A tight five-shot fan cuts deeply through targets ahead.', 40, true),
  ('pulse_singularity', 'pulse', 'singularity', 'SINGULARITY', 'AREA DAMAGE', 'A slow royal core detonates into a screen-clearing gravity blast.', 50, true),
  ('pulse_comet_cores', 'pulse', 'cometCores', 'COMET CORES', 'BOSS PRESSURE', 'Three compact cores strike often and rebound between targets.', 60, true),
  ('laser_sovereign_lance', 'laser', 'sovereignLance', 'SOVEREIGN LANCE', 'FOCUS DAMAGE', 'One precise beam gains damage while locked to the same target.', 70, true),
  ('laser_prism_array', 'laser', 'prismArray', 'PRISM ARRAY', 'MULTI TARGET', 'Three lighter beams refract once toward nearby enemies.', 80, true),
  ('tesla_storm_web', 'tesla', 'stormWeb', 'STORM WEB', 'CHAIN CONTROL', 'Twin arcs branch across a vast web of nearby enemies.', 90, true),
  ('tesla_thunder_anchor', 'tesla', 'thunderAnchor', 'THUNDER ANCHOR', 'WARDEN HUNTER', 'One brutal arc specializes in elites and Wardens.', 100, true)
on conflict (id) do update
  set weapon_key = excluded.weapon_key,
      mastery_key = excluded.mastery_key,
      name = excluded.name,
      role = excluded.role,
      description = excluded.description,
      sort_order = excluded.sort_order,
      trial_eligible = excluded.trial_eligible,
      active = true;

create table if not exists public.player_progression (
  user_id uuid primary key references auth.users(id) on delete cascade,
  arsenal_xp integer not null default 0 check (arsenal_xp between 0 and 1000000000),
  arsenal_rank integer not null default 0 check (arsenal_rank between 0 and 10),
  selected_blueprint_id text not null default 'blaster_standard' references public.weapon_blueprint_catalog(id) on delete restrict,
  backfilled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.player_weapon_blueprints (
  user_id uuid not null references auth.users(id) on delete cascade,
  blueprint_id text not null references public.weapon_blueprint_catalog(id) on delete restrict,
  source text not null check (source in ('run', 'grant', 'achievement')),
  unlocked_run_id uuid references public.leaderboard_runs(id) on delete restrict,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, blueprint_id)
);

create table if not exists public.armory_progression_transactions (
  id bigint generated by default as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null unique references public.leaderboard_runs(id) on delete restrict,
  xp_awarded integer not null check (xp_awarded between 0 and 250),
  xp_before integer not null,
  xp_after integer not null,
  rank_before integer not null check (rank_before between 0 and 10),
  rank_after integer not null check (rank_after between 0 and 10),
  claimed_blueprint_ids jsonb not null default '[]'::jsonb,
  unlocked_blueprint_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists player_weapon_blueprints_user_idx
  on public.player_weapon_blueprints (user_id, unlocked_at);
create index if not exists armory_progression_user_idx
  on public.armory_progression_transactions (user_id, created_at desc);

alter table public.weapon_blueprint_catalog enable row level security;
alter table public.player_progression enable row level security;
alter table public.player_weapon_blueprints enable row level security;
alter table public.armory_progression_transactions enable row level security;

revoke all on table public.weapon_blueprint_catalog from public, anon, authenticated;
revoke all on table public.player_progression from public, anon, authenticated;
revoke all on table public.player_weapon_blueprints from public, anon, authenticated;
revoke all on table public.armory_progression_transactions from public, anon, authenticated;
grant select on table public.weapon_blueprint_catalog to authenticated;
grant select on table public.player_progression to authenticated;
grant select on table public.player_weapon_blueprints to authenticated;

drop policy if exists armory_catalog_read on public.weapon_blueprint_catalog;
create policy armory_catalog_read on public.weapon_blueprint_catalog
  for select to authenticated using (active);
drop policy if exists own_progression_read on public.player_progression;
create policy own_progression_read on public.player_progression
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists own_blueprints_read on public.player_weapon_blueprints;
create policy own_blueprints_read on public.player_weapon_blueprints
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.arsenal_rank_for_xp(p_xp integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when greatest(coalesce(p_xp, 0), 0) >= 4000 then 10
    when greatest(coalesce(p_xp, 0), 0) >= 3200 then 9
    when greatest(coalesce(p_xp, 0), 0) >= 2500 then 8
    when greatest(coalesce(p_xp, 0), 0) >= 1900 then 7
    when greatest(coalesce(p_xp, 0), 0) >= 1400 then 6
    when greatest(coalesce(p_xp, 0), 0) >= 1000 then 5
    when greatest(coalesce(p_xp, 0), 0) >= 700 then 4
    when greatest(coalesce(p_xp, 0), 0) >= 450 then 3
    when greatest(coalesce(p_xp, 0), 0) >= 250 then 2
    when greatest(coalesce(p_xp, 0), 0) >= 100 then 1
    else 0
  end;
$$;

revoke all on function public.arsenal_rank_for_xp(integer) from public, anon, authenticated;
grant execute on function public.arsenal_rank_for_xp(integer) to service_role;

-- A one-time conservative backfill grants 60 XP per previously settled server
-- run. It deliberately ignores local scores, local inventory and client storage.
create or replace function public.ensure_player_armory(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  backfill_xp integer;
begin
  if p_user_id is null then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('armory:' || p_user_id::text, 0));

  insert into public.player_progression (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  if exists (select 1 from public.player_progression where user_id = p_user_id and backfilled_at is null) then
    select least(4000, count(*) * 60)::integer into backfill_xp
      from public.leaderboard_runs
     where user_id = p_user_id and economy_settled_at is not null;

    update public.player_progression
       set arsenal_xp = greatest(arsenal_xp, backfill_xp),
           arsenal_rank = public.arsenal_rank_for_xp(greatest(arsenal_xp, backfill_xp)),
           backfilled_at = now(),
           updated_at = now()
     where user_id = p_user_id and backfilled_at is null;
  end if;
  return true;
end;
$$;

revoke all on function public.ensure_player_armory(uuid) from public, anon, authenticated;
grant execute on function public.ensure_player_armory(uuid) to service_role;

-- Writes exactly one progression transaction per server run. The Pages
-- Function validates telemetry and resolves mastery ids before invoking it.
create or replace function public.settle_armory_progression(
  p_user_id uuid,
  p_run_id uuid,
  p_xp integer,
  p_blueprint_ids jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_row public.leaderboard_runs%rowtype;
  progress public.player_progression%rowtype;
  existing public.armory_progression_transactions%rowtype;
  new_xp integer;
  new_rank integer;
  claimed jsonb := coalesce(p_blueprint_ids, '[]'::jsonb);
  unlocked jsonb := '[]'::jsonb;
begin
  if p_user_id is null or p_run_id is null or p_xp is null or p_xp < 0 or p_xp > 250
     or jsonb_typeof(claimed) <> 'array' or jsonb_array_length(claimed) > 5 then
    raise exception 'invalid armory progression';
  end if;

  select * into run_row from public.leaderboard_runs where id = p_run_id for update;
  if not found then raise exception 'run not found'; end if;
  if run_row.user_id is distinct from p_user_id then raise exception 'run owner mismatch'; end if;
  if run_row.economy_settled_at is null then raise exception 'run reward not settled'; end if;

  perform public.ensure_player_armory(p_user_id);
  select * into progress from public.player_progression where user_id = p_user_id for update;

  select * into existing from public.armory_progression_transactions where run_id = p_run_id;
  if found then
    return jsonb_build_object(
      'duplicate', true,
      'xpAwarded', existing.xp_awarded,
      'xp', progress.arsenal_xp,
      'rank', progress.arsenal_rank,
      'unlockedBlueprintIds', existing.unlocked_blueprint_ids
    );
  end if;

  if exists (
    select 1 from jsonb_array_elements_text(claimed) requested(id)
     where not exists (
       select 1 from public.weapon_blueprint_catalog catalog
        where catalog.id = requested.id and catalog.active and catalog.mastery_key is not null
     )
  ) then raise exception 'invalid blueprint claim'; end if;

  with inserted as (
    insert into public.player_weapon_blueprints (user_id, blueprint_id, source, unlocked_run_id)
    select p_user_id, requested.id, 'run', p_run_id
      from jsonb_array_elements_text(claimed) requested(id)
    on conflict (user_id, blueprint_id) do nothing
    returning blueprint_id
  )
  select coalesce(jsonb_agg(blueprint_id order by blueprint_id), '[]'::jsonb) into unlocked from inserted;

  new_xp := least(1000000000, progress.arsenal_xp + p_xp);
  new_rank := public.arsenal_rank_for_xp(new_xp);
  update public.player_progression
     set arsenal_xp = new_xp, arsenal_rank = new_rank, updated_at = now()
   where user_id = p_user_id;

  insert into public.armory_progression_transactions
    (user_id, run_id, xp_awarded, xp_before, xp_after, rank_before, rank_after, claimed_blueprint_ids, unlocked_blueprint_ids)
  values
    (p_user_id, p_run_id, p_xp, progress.arsenal_xp, new_xp, progress.arsenal_rank, new_rank, claimed, unlocked);

  return jsonb_build_object(
    'duplicate', false,
    'xpAwarded', p_xp,
    'xp', new_xp,
    'rank', new_rank,
    'unlockedBlueprintIds', unlocked
  );
end;
$$;

revoke all on function public.settle_armory_progression(uuid, uuid, integer, jsonb) from public, anon, authenticated;
grant execute on function public.settle_armory_progression(uuid, uuid, integer, jsonb) to service_role;

create or replace function public.select_armory_blueprint(
  p_user_id uuid,
  p_blueprint_id text,
  p_trial_blueprint_id text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.ensure_player_armory(p_user_id);
  perform 1 from public.player_progression where user_id = p_user_id for update;

  if p_blueprint_id = 'blaster_standard' then null;
  elsif p_blueprint_id = p_trial_blueprint_id and exists (
    select 1 from public.weapon_blueprint_catalog
     where id = p_blueprint_id and active and trial_eligible and mastery_key is not null
  ) then null;
  elsif not exists (
    select 1 from public.player_weapon_blueprints owned
      join public.weapon_blueprint_catalog catalog on catalog.id = owned.blueprint_id and catalog.active
     where owned.user_id = p_user_id and owned.blueprint_id = p_blueprint_id
  ) then return jsonb_build_object('error', 'BLUEPRINT_LOCKED');
  end if;

  update public.player_progression
     set selected_blueprint_id = p_blueprint_id, updated_at = now()
   where user_id = p_user_id;
  return jsonb_build_object('selectedBlueprintId', p_blueprint_id);
end;
$$;

revoke all on function public.select_armory_blueprint(uuid, text, text) from public, anon, authenticated;
grant execute on function public.select_armory_blueprint(uuid, text, text) to service_role;

-- Global Warden event engine. Every authoritative state transition is kept in
-- Postgres so Pages Functions remain stateless and retries remain idempotent.
create table if not exists public.boss_events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,64}$'),
  name text not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'active', 'victory', 'failed', 'disabled')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  max_hp bigint not null check (max_hp > 0),
  current_hp bigint not null check (current_hp >= 0 and current_hp <= max_hp),
  trial_blueprint_id text references public.weapon_blueprint_catalog(id) on delete restrict,
  balance_version integer not null default 1 check (balance_version > 0),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.boss_assaults (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.boss_events(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  blueprint_id text not null references public.weapon_blueprint_catalog(id) on delete restrict,
  game_version text not null check (game_version ~ '^\d+\.\d+\.\d+-\d+$'),
  arsenal_rank integer not null check (arsenal_rank between 0 and 10),
  damage_bonus numeric(5,4) not null check (damage_bonus between 0 and .2),
  attempt_number integer not null check (attempt_number > 0),
  attempt_multiplier numeric(5,4) not null check (attempt_multiplier in (1, .75, .5)),
  seed bigint not null check (seed >= 0),
  phase_ceiling jsonb not null check (jsonb_typeof(phase_ceiling) = 'array' and jsonb_array_length(phase_ceiling) = 3),
  status text not null default 'active' check (status in ('active', 'settled', 'expired', 'rejected')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  settlement_request_id uuid unique,
  elapsed_ms integer check (elapsed_ms between 0 and 90000),
  outcome text check (outcome in ('timeout', 'destroyed', 'breach')),
  targets_destroyed integer check (targets_destroyed between 0 and 1000),
  reported_phase_damage jsonb,
  raw_damage integer check (raw_damage >= 0),
  approved_damage integer check (approved_damage >= 0),
  effective_damage integer check (effective_damage >= 0),
  audit_flags jsonb not null default '[]'::jsonb,
  settled_at timestamptz,
  unique (event_id, user_id, attempt_number),
  check (expires_at > issued_at)
);

create table if not exists public.boss_contributions (
  id bigint generated by default as identity primary key,
  event_id uuid not null references public.boss_events(id) on delete restrict,
  assault_id uuid not null unique references public.boss_assaults(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  blueprint_id text not null references public.weapon_blueprint_catalog(id) on delete restrict,
  attempt_number integer not null,
  attempt_multiplier numeric(5,4) not null,
  raw_damage integer not null check (raw_damage >= 0),
  approved_damage integer not null check (approved_damage >= 0),
  effective_damage integer not null check (effective_damage >= 0),
  created_at timestamptz not null default now()
);

create index if not exists boss_events_active_idx on public.boss_events (status, starts_at, ends_at);
create index if not exists boss_assaults_player_idx on public.boss_assaults (event_id, user_id, issued_at desc);
create index if not exists boss_contributions_event_rank_idx on public.boss_contributions (event_id, effective_damage desc, created_at asc);
create index if not exists boss_contributions_player_idx on public.boss_contributions (event_id, user_id, created_at asc);

alter table public.boss_events enable row level security;
alter table public.boss_assaults enable row level security;
alter table public.boss_contributions enable row level security;
revoke all on table public.boss_events from public, anon, authenticated;
revoke all on table public.boss_assaults from public, anon, authenticated;
revoke all on table public.boss_contributions from public, anon, authenticated;

-- The first internal event is created when this migration is applied. Re-running
-- the schema never resets its HP or extends its deadline.
insert into public.boss_events
  (id, slug, name, status, starts_at, ends_at, max_hp, current_hp, trial_blueprint_id, balance_version, config)
values
  ('00000000-0000-4000-8000-000000000082', 'sovereign-engine-alpha', 'THE SOVEREIGN ENGINE', 'active',
   now() - interval '5 minutes', now() + interval '48 hours', 68420000, 68420000,
   'pulse_singularity', 1, '{"durationSeconds":90,"phaseSeconds":30}'::jsonb)
on conflict (slug) do nothing;

create or replace function public.start_boss_assault(
  p_user_id uuid,
  p_event_id uuid,
  p_blueprint_id text,
  p_trial_blueprint_id text,
  p_seed bigint,
  p_game_version text,
  p_phase_ceiling jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.boss_events%rowtype;
  progress public.player_progression%rowtype;
  existing public.boss_assaults%rowtype;
  created public.boss_assaults%rowtype;
  attempt_no integer;
  multiplier numeric(5,4);
begin
  if p_user_id is null or p_event_id is null or p_seed is null or p_seed < 0
     or p_game_version !~ '^\d+\.\d+\.\d+-\d+$'
     or jsonb_typeof(p_phase_ceiling) <> 'array' or jsonb_array_length(p_phase_ceiling) <> 3 then
    raise exception 'invalid boss assault request';
  end if;

  select * into event_row from public.boss_events where id = p_event_id for update;
  if not found then return jsonb_build_object('error', 'EVENT_NOT_FOUND'); end if;
  if event_row.status <> 'active' or now() < event_row.starts_at or now() >= event_row.ends_at or event_row.current_hp <= 0 then
    return jsonb_build_object('error', 'EVENT_NOT_ACTIVE');
  end if;

  perform public.ensure_player_armory(p_user_id);
  select * into progress from public.player_progression where user_id = p_user_id for update;
  if p_blueprint_id <> 'blaster_standard'
     and p_blueprint_id is distinct from p_trial_blueprint_id
     and not exists (
       select 1 from public.player_weapon_blueprints owned
        join public.weapon_blueprint_catalog catalog on catalog.id = owned.blueprint_id and catalog.active
       where owned.user_id = p_user_id and owned.blueprint_id = p_blueprint_id
     ) then return jsonb_build_object('error', 'BLUEPRINT_LOCKED');
  end if;

  update public.boss_assaults
     set status = 'expired'
   where event_id = p_event_id and user_id = p_user_id and status = 'active' and expires_at <= now();

  select * into existing from public.boss_assaults
   where event_id = p_event_id and user_id = p_user_id and status = 'active' and expires_at > now()
   order by issued_at desc limit 1;
  if found then
    return jsonb_build_object(
      'duplicate', true, 'assaultId', existing.id, 'eventId', existing.event_id,
      'blueprintId', existing.blueprint_id, 'arsenalRank', existing.arsenal_rank,
      'damageBonus', existing.damage_bonus, 'attemptNumber', existing.attempt_number,
      'attemptMultiplier', existing.attempt_multiplier, 'seed', existing.seed,
      'issuedAt', existing.issued_at, 'expiresAt', existing.expires_at,
      'globalHp', event_row.current_hp, 'globalMaxHp', event_row.max_hp
    );
  end if;

  select count(*)::integer + 1 into attempt_no from public.boss_assaults
   where event_id = p_event_id and user_id = p_user_id;
  multiplier := case when attempt_no <= 3 then 1 when attempt_no <= 6 then .75 else .5 end;

  insert into public.boss_assaults
    (event_id, user_id, blueprint_id, game_version, arsenal_rank, damage_bonus, attempt_number,
     attempt_multiplier, seed, phase_ceiling, expires_at)
  values
    (p_event_id, p_user_id, p_blueprint_id, p_game_version, progress.arsenal_rank,
     progress.arsenal_rank * .02, attempt_no, multiplier, p_seed, p_phase_ceiling, now() + interval '12 minutes')
  returning * into created;

  return jsonb_build_object(
    'duplicate', false, 'assaultId', created.id, 'eventId', created.event_id,
    'blueprintId', created.blueprint_id, 'arsenalRank', created.arsenal_rank,
    'damageBonus', created.damage_bonus, 'attemptNumber', created.attempt_number,
    'attemptMultiplier', created.attempt_multiplier, 'seed', created.seed,
    'issuedAt', created.issued_at, 'expiresAt', created.expires_at,
    'globalHp', event_row.current_hp, 'globalMaxHp', event_row.max_hp
  );
end;
$$;

revoke all on function public.start_boss_assault(uuid, uuid, text, text, bigint, text, jsonb) from public, anon, authenticated;
grant execute on function public.start_boss_assault(uuid, uuid, text, text, bigint, text, jsonb) to service_role;

create or replace function public.settle_boss_assault(
  p_user_id uuid,
  p_assault_id uuid,
  p_request_id uuid,
  p_elapsed_ms integer,
  p_phase_damage jsonb,
  p_outcome text,
  p_targets_destroyed integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  assault_row public.boss_assaults%rowtype;
  event_row public.boss_events%rowtype;
  contribution public.boss_contributions%rowtype;
  phase_one integer; phase_two integer; phase_three integer;
  cap_one integer; cap_two integer; cap_three integer;
  active_one integer; active_two integer; active_three integer;
  raw_total integer; approved integer; effective integer;
  player_total bigint; audit jsonb := '[]'::jsonb;
begin
  if p_user_id is null or p_assault_id is null or p_request_id is null
     or p_elapsed_ms is null or p_elapsed_ms < 0 or p_elapsed_ms > 90000
     or p_outcome not in ('timeout', 'destroyed', 'breach')
     or p_targets_destroyed is null or p_targets_destroyed < 0 or p_targets_destroyed > 1000
     or jsonb_typeof(p_phase_damage) <> 'array' or jsonb_array_length(p_phase_damage) <> 3 then
    raise exception 'invalid boss settlement';
  end if;

  select * into assault_row from public.boss_assaults where id = p_assault_id for update;
  if not found then return jsonb_build_object('error', 'ASSAULT_NOT_FOUND'); end if;
  if assault_row.user_id is distinct from p_user_id then return jsonb_build_object('error', 'ASSAULT_OWNER_MISMATCH'); end if;
  if assault_row.status = 'settled' then
    select * into contribution from public.boss_contributions where assault_id = p_assault_id;
    select coalesce(sum(effective_damage), 0) into player_total from public.boss_contributions
     where event_id = assault_row.event_id and user_id = p_user_id;
    select * into event_row from public.boss_events where id = assault_row.event_id;
    return jsonb_build_object(
      'duplicate', true, 'assaultId', assault_row.id, 'eventId', assault_row.event_id,
      'rawDamage', contribution.raw_damage, 'approvedDamage', contribution.approved_damage,
      'attemptMultiplier', contribution.attempt_multiplier, 'effectiveDamage', contribution.effective_damage,
      'playerTotalDamage', player_total, 'globalHp', event_row.current_hp, 'globalMaxHp', event_row.max_hp,
      'eventDefeated', event_row.current_hp = 0, 'auditFlags', assault_row.audit_flags
    );
  end if;
  if assault_row.status <> 'active' or assault_row.expires_at < now() then
    update public.boss_assaults set status = 'expired' where id = p_assault_id and status = 'active';
    return jsonb_build_object('error', 'ASSAULT_EXPIRED');
  end if;
  if p_elapsed_ms > floor(extract(epoch from (now() - assault_row.issued_at)) * 1000)::integer + 5000 then
    return jsonb_build_object('error', 'ASSAULT_TIME_INVALID');
  end if;

  phase_one := greatest(0, least(1000000, coalesce((p_phase_damage->>0)::integer, 0)));
  phase_two := greatest(0, least(1000000, coalesce((p_phase_damage->>1)::integer, 0)));
  phase_three := greatest(0, least(1000000, coalesce((p_phase_damage->>2)::integer, 0)));
  active_one := least(30000, p_elapsed_ms);
  active_two := least(30000, greatest(0, p_elapsed_ms - 30000));
  active_three := least(30000, greatest(0, p_elapsed_ms - 60000));
  cap_one := ceil(coalesce((assault_row.phase_ceiling->>0)::numeric, 0) * active_one / 30000 * 1.10);
  cap_two := ceil(coalesce((assault_row.phase_ceiling->>1)::numeric, 0) * active_two / 30000 * 1.10);
  cap_three := ceil(coalesce((assault_row.phase_ceiling->>2)::numeric, 0) * active_three / 30000 * 1.10);
  raw_total := phase_one + phase_two + phase_three;
  approved := least(phase_one, cap_one) + least(phase_two, cap_two) + least(phase_three, cap_three);
  if phase_one > cap_one * 2 or phase_two > cap_two * 2 or phase_three > cap_three * 2 then audit := audit || '["DAMAGE_SPIKE"]'::jsonb; end if;
  effective := floor(approved * assault_row.attempt_multiplier)::integer;

  select * into event_row from public.boss_events where id = assault_row.event_id for update;
  effective := least(effective::bigint, event_row.current_hp)::integer;
  update public.boss_events
     set current_hp = greatest(0, current_hp - effective),
         status = case when current_hp - effective <= 0 then 'victory' else status end,
         updated_at = now()
   where id = event_row.id
   returning * into event_row;

  update public.boss_assaults
     set status = 'settled', settlement_request_id = p_request_id, elapsed_ms = p_elapsed_ms,
         outcome = p_outcome, targets_destroyed = p_targets_destroyed,
         reported_phase_damage = p_phase_damage, raw_damage = raw_total,
         approved_damage = approved, effective_damage = effective,
         audit_flags = audit, settled_at = now()
   where id = p_assault_id;

  insert into public.boss_contributions
    (event_id, assault_id, user_id, blueprint_id, attempt_number, attempt_multiplier, raw_damage, approved_damage, effective_damage)
  values
    (assault_row.event_id, assault_row.id, p_user_id, assault_row.blueprint_id, assault_row.attempt_number,
     assault_row.attempt_multiplier, raw_total, approved, effective)
  returning * into contribution;

  select coalesce(sum(effective_damage), 0) into player_total from public.boss_contributions
   where event_id = assault_row.event_id and user_id = p_user_id;
  return jsonb_build_object(
    'duplicate', false, 'assaultId', assault_row.id, 'eventId', assault_row.event_id,
    'rawDamage', raw_total, 'approvedDamage', approved,
    'attemptMultiplier', assault_row.attempt_multiplier, 'effectiveDamage', effective,
    'playerTotalDamage', player_total, 'globalHp', event_row.current_hp, 'globalMaxHp', event_row.max_hp,
    'eventDefeated', event_row.current_hp = 0, 'auditFlags', audit
  );
end;
$$;

revoke all on function public.settle_boss_assault(uuid, uuid, uuid, integer, jsonb, text, integer) from public, anon, authenticated;
grant execute on function public.settle_boss_assault(uuid, uuid, uuid, integer, jsonb, text, integer) to service_role;

create or replace function public.boss_event_leaderboard(p_event_id uuid, p_user_id uuid, p_limit integer default 10)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with totals as (
    select contribution.user_id,
           sum(contribution.effective_damage)::bigint as total_damage,
           count(*)::integer as assaults,
           min(contribution.created_at) as first_contribution_at
      from public.boss_contributions contribution
     where contribution.event_id = p_event_id and contribution.effective_damage > 0
     group by contribution.user_id
  ), ranked as (
    select totals.*,
           row_number() over (order by totals.total_damage desc, totals.first_contribution_at asc, totals.user_id asc)::integer as rank
      from totals
  ), decorated as (
    select ranked.rank, ranked.user_id,
           coalesce(profile.display_name, 'CROWN PILOT') as player_name,
           ranked.total_damage, ranked.assaults
      from ranked
      left join public.player_profiles profile on profile.user_id = ranked.user_id
  )
  select jsonb_build_object(
    'leaders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'rank', entry.rank, 'playerId', entry.user_id, 'playerName', entry.player_name,
        'damage', entry.total_damage, 'assaults', entry.assaults
      ) order by entry.rank)
      from (select * from decorated order by rank limit greatest(1, least(coalesce(p_limit, 10), 100))) entry
    ), '[]'::jsonb),
    'player', (
      select jsonb_build_object(
        'rank', own.rank, 'playerId', own.user_id, 'playerName', own.player_name,
        'damage', own.total_damage, 'assaults', own.assaults
      ) from decorated own where own.user_id = p_user_id
    )
  );
$$;

revoke all on function public.boss_event_leaderboard(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.boss_event_leaderboard(uuid, uuid, integer) to service_role;
-- Global Warden rewards. Claims are server-owned, cosmetic-first and never
-- modify gameplay damage or the endless high-score rules.
create table if not exists public.boss_event_reward_catalog (
  event_id uuid not null references public.boss_events(id) on delete cascade,
  reward_key text not null check (reward_key ~ '^[a-z0-9_]{3,64}$'),
  reward_type text not null check (reward_type in ('milestone', 'global_victory')),
  name text not null,
  description text not null,
  damage_threshold bigint not null check (damage_threshold >= 0),
  shard_amount integer not null default 0 check (shard_amount between 0 and 500),
  badge_id text check (badge_id is null or badge_id ~ '^[a-z0-9_]{3,64}$'),
  badge_name text,
  sort_order integer not null,
  active boolean not null default true,
  primary key (event_id, reward_key)
);

create table if not exists public.player_event_badges (
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_id text not null check (badge_id ~ '^[a-z0-9_]{3,64}$'),
  badge_name text not null,
  event_id uuid not null references public.boss_events(id) on delete restrict,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create table if not exists public.boss_reward_claims (
  id bigint generated by default as identity primary key,
  request_id uuid not null unique,
  event_id uuid not null references public.boss_events(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  reward_key text not null,
  shard_amount integer not null check (shard_amount between 0 and 500),
  badge_id text,
  player_damage bigint not null check (player_damage >= 0),
  claimed_at timestamptz not null default now(),
  unique (event_id, user_id, reward_key),
  foreign key (event_id, reward_key) references public.boss_event_reward_catalog(event_id, reward_key) on delete restrict
);

create index if not exists boss_reward_claims_player_idx on public.boss_reward_claims (event_id, user_id, claimed_at);
alter table public.boss_event_reward_catalog enable row level security;
alter table public.player_event_badges enable row level security;
alter table public.boss_reward_claims enable row level security;
revoke all on table public.boss_event_reward_catalog from public, anon, authenticated;
revoke all on table public.player_event_badges from public, anon, authenticated;
revoke all on table public.boss_reward_claims from public, anon, authenticated;

insert into public.boss_event_reward_catalog
  (event_id, reward_key, reward_type, name, description, damage_threshold, shard_amount, badge_id, badge_name, sort_order)
values
  ('00000000-0000-4000-8000-000000000082', 'first_strike', 'milestone', 'FIRST STRIKE', 'DEAL 1,000 VERIFIED EVENT DAMAGE', 1000, 25, null, null, 10),
  ('00000000-0000-4000-8000-000000000082', 'crown_vanguard', 'milestone', 'CROWN VANGUARD', 'DEAL 5,000 VERIFIED EVENT DAMAGE', 5000, 50, null, null, 20),
  ('00000000-0000-4000-8000-000000000082', 'wardenbreaker', 'milestone', 'WARDENBREAKER', 'DEAL 15,000 VERIFIED EVENT DAMAGE', 15000, 100, 'wardenbreaker', 'WARDENBREAKER', 30),
  ('00000000-0000-4000-8000-000000000082', 'sovereign_slayer', 'global_victory', 'SOVEREIGN SLAYER', 'QUALIFY WITH 1,000 DAMAGE AND DEFEAT THE GLOBAL WARDEN', 1000, 150, 'sovereign_slayer', 'SOVEREIGN SLAYER', 40)
on conflict (event_id, reward_key) do update
  set reward_type = excluded.reward_type, name = excluded.name, description = excluded.description,
      damage_threshold = excluded.damage_threshold, shard_amount = excluded.shard_amount,
      badge_id = excluded.badge_id, badge_name = excluded.badge_name, sort_order = excluded.sort_order, active = true;

-- Recurring Global Warden schedule. Friday 18:00 UTC through Sunday 18:00 UTC.
-- The server API invokes this idempotent function before reading event state,
-- so the next event is prepared without trusting a browser clock or a cron job.
create unique index if not exists boss_events_starts_at_unique_idx
  on public.boss_events(starts_at);

create or replace function public.ensure_boss_event_schedule()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_start timestamptz;
  scheduled_event_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('crown-lizard-global-warden-schedule-v1'));

  update public.boss_events
     set status = case when current_hp <= 0 then 'victory' else 'failed' end,
         updated_at = now()
   where status = 'active'
     and (current_hp <= 0 or ends_at <= now());

  update public.boss_events
     set status = 'failed', updated_at = now()
   where status = 'scheduled' and ends_at <= now();

  update public.boss_events
     set status = 'active', updated_at = now()
   where status = 'scheduled'
     and starts_at <= now()
     and ends_at > now();

  select id into scheduled_event_id
    from public.boss_events
   where status = 'scheduled' and starts_at > now()
   order by starts_at asc
   limit 1;

  if scheduled_event_id is null then
    next_start := (
      date_trunc('week', now() at time zone 'UTC') + interval '4 days 18 hours'
    ) at time zone 'UTC';
    if next_start <= now() then next_start := next_start + interval '7 days'; end if;

    insert into public.boss_events
      (slug, name, status, starts_at, ends_at, max_hp, current_hp, trial_blueprint_id, balance_version, config)
    values
      (
        'sovereign-engine-' || to_char(next_start at time zone 'UTC', 'YYYYMMDDHH24'),
        'THE SOVEREIGN ENGINE', 'scheduled', next_start, next_start + interval '48 hours',
        68420000, 68420000, 'pulse_singularity', 1,
        jsonb_build_object('durationSeconds', 90, 'phaseSeconds', 30, 'schedule', 'weekly-friday-1800-utc')
      )
    on conflict (slug) do nothing
    returning id into scheduled_event_id;

    if scheduled_event_id is null then
      select id into scheduled_event_id from public.boss_events where starts_at = next_start limit 1;
    end if;
  end if;

  insert into public.boss_event_reward_catalog
    (event_id, reward_key, reward_type, name, description, damage_threshold, shard_amount, badge_id, badge_name, sort_order)
  values
    (scheduled_event_id, 'first_strike', 'milestone', 'FIRST STRIKE', 'DEAL 1,000 VERIFIED EVENT DAMAGE', 1000, 25, null, null, 10),
    (scheduled_event_id, 'crown_vanguard', 'milestone', 'CROWN VANGUARD', 'DEAL 5,000 VERIFIED EVENT DAMAGE', 5000, 50, null, null, 20),
    (scheduled_event_id, 'wardenbreaker', 'milestone', 'WARDENBREAKER', 'DEAL 15,000 VERIFIED EVENT DAMAGE', 15000, 100, 'wardenbreaker', 'WARDENBREAKER', 30),
    (scheduled_event_id, 'sovereign_slayer', 'global_victory', 'SOVEREIGN SLAYER', 'QUALIFY WITH 1,000 DAMAGE AND DEFEAT THE GLOBAL WARDEN', 1000, 150, 'sovereign_slayer', 'SOVEREIGN SLAYER', 40)
  on conflict (event_id, reward_key) do nothing;

  return true;
end;
$$;

revoke all on function public.ensure_boss_event_schedule() from public, anon, authenticated;
grant execute on function public.ensure_boss_event_schedule() to service_role;

select public.ensure_boss_event_schedule();

create or replace function public.refresh_boss_event_state(p_event_id uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare event_row public.boss_events%rowtype;
begin
  select * into event_row from public.boss_events where id = p_event_id for update;
  if not found then return jsonb_build_object('error', 'EVENT_NOT_FOUND'); end if;
  if event_row.status = 'active' then
    update public.boss_events
       set status = case when current_hp <= 0 then 'victory' when now() >= ends_at then 'failed' else status end,
           updated_at = case when current_hp <= 0 or now() >= ends_at then now() else updated_at end
     where id = p_event_id
     returning * into event_row;
  end if;
  return jsonb_build_object('eventId', event_row.id, 'status', event_row.status,
    'currentHp', event_row.current_hp, 'maxHp', event_row.max_hp, 'endsAt', event_row.ends_at);
end;
$$;

revoke all on function public.refresh_boss_event_state(uuid) from public, anon, authenticated;
grant execute on function public.refresh_boss_event_state(uuid) to service_role;

create or replace function public.boss_reward_status(p_user_id uuid, p_event_id uuid) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with player_total as (
    select coalesce(sum(effective_damage), 0)::bigint as damage
      from public.boss_contributions where event_id = p_event_id and user_id = p_user_id
  ), rewards as (
    select catalog.*,
           claim.claimed_at,
           total.damage,
           event.status as event_status,
           (total.damage >= catalog.damage_threshold) as earned,
           (total.damage >= catalog.damage_threshold and
             (catalog.reward_type = 'milestone' or event.status = 'victory')) as claimable
      from public.boss_event_reward_catalog catalog
      join public.boss_events event on event.id = catalog.event_id
      cross join player_total total
      left join public.boss_reward_claims claim
        on claim.event_id = catalog.event_id and claim.user_id = p_user_id and claim.reward_key = catalog.reward_key
     where catalog.event_id = p_event_id and catalog.active
  )
  select jsonb_build_object(
    'eventId', p_event_id,
    'playerDamage', (select damage from player_total),
    'qualified', (select damage >= 1000 from player_total),
    'rewards', coalesce(jsonb_agg(jsonb_build_object(
      'key', reward_key, 'type', reward_type, 'name', name, 'description', description,
      'threshold', damage_threshold, 'shards', shard_amount, 'badgeId', badge_id,
      'badgeName', badge_name, 'earned', earned, 'claimable', claimable and claimed_at is null,
      'claimed', claimed_at is not null, 'claimedAt', claimed_at
    ) order by sort_order), '[]'::jsonb)
  ) from rewards;
$$;

revoke all on function public.boss_reward_status(uuid, uuid) from public, anon, authenticated;
grant execute on function public.boss_reward_status(uuid, uuid) to service_role;

create or replace function public.claim_boss_reward(
  p_user_id uuid,
  p_event_id uuid,
  p_reward_key text,
  p_request_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.boss_events%rowtype;
  reward_row public.boss_event_reward_catalog%rowtype;
  existing public.boss_reward_claims%rowtype;
  total_damage bigint;
  wallet_balance integer;
begin
  if p_user_id is null or p_event_id is null or p_request_id is null or p_reward_key !~ '^[a-z0-9_]{3,64}$' then
    raise exception 'invalid boss reward request';
  end if;
  select * into event_row from public.boss_events where id = p_event_id for update;
  if not found then return jsonb_build_object('error', 'EVENT_NOT_FOUND'); end if;
  select * into reward_row from public.boss_event_reward_catalog
   where event_id = p_event_id and reward_key = p_reward_key and active;
  if not found then return jsonb_build_object('error', 'REWARD_NOT_FOUND'); end if;

  insert into public.player_wallets (user_id) values (p_user_id) on conflict (user_id) do nothing;
  perform 1 from public.player_wallets where user_id = p_user_id for update;
  select * into existing from public.boss_reward_claims
   where event_id = p_event_id and user_id = p_user_id and reward_key = p_reward_key;
  if found then
    select balance into wallet_balance from public.player_wallets where user_id = p_user_id;
    return jsonb_build_object('duplicate', true, 'rewardKey', existing.reward_key,
      'shards', existing.shard_amount, 'badgeId', existing.badge_id, 'balance', wallet_balance,
      'playerDamage', existing.player_damage);
  end if;

  select coalesce(sum(effective_damage), 0)::bigint into total_damage
    from public.boss_contributions where event_id = p_event_id and user_id = p_user_id;
  if total_damage < reward_row.damage_threshold then return jsonb_build_object('error', 'MILESTONE_LOCKED'); end if;
  if reward_row.reward_type = 'global_victory' and event_row.status <> 'victory' then
    return jsonb_build_object('error', 'EVENT_REWARD_LOCKED');
  end if;

  update public.player_wallets set balance = balance + reward_row.shard_amount, updated_at = now()
   where user_id = p_user_id returning balance into wallet_balance;
  if reward_row.badge_id is not null then
    insert into public.player_event_badges (user_id, badge_id, badge_name, event_id)
    values (p_user_id, reward_row.badge_id, coalesce(reward_row.badge_name, reward_row.name), p_event_id)
    on conflict (user_id, badge_id) do nothing;
  end if;
  insert into public.boss_reward_claims
    (request_id, event_id, user_id, reward_key, shard_amount, badge_id, player_damage)
  values (p_request_id, p_event_id, p_user_id, p_reward_key, reward_row.shard_amount, reward_row.badge_id, total_damage);
  insert into public.economy_transactions (user_id, external_id, kind, amount, balance_after, metadata)
  values (p_user_id, 'boss-reward:' || p_event_id::text || ':' || p_reward_key, 'boss_reward',
    reward_row.shard_amount, wallet_balance,
    jsonb_build_object('eventId', p_event_id, 'rewardKey', p_reward_key, 'badgeId', reward_row.badge_id, 'playerDamage', total_damage));
  return jsonb_build_object('duplicate', false, 'rewardKey', p_reward_key,
    'shards', reward_row.shard_amount, 'badgeId', reward_row.badge_id, 'badgeName', reward_row.badge_name,
    'balance', wallet_balance, 'playerDamage', total_damage);
end;
$$;

revoke all on function public.claim_boss_reward(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.claim_boss_reward(uuid, uuid, text, uuid) to service_role;

-- Build 88: stable public pilot identities and server-computed profile stats.
-- The public ID is deliberately separate from auth.users.id. Only the service
-- role can execute these functions; the Pages Function remains the sole public
-- boundary and never exposes email or the underlying account identifier.
alter table public.player_profiles
  add column if not exists public_id uuid default gen_random_uuid();
update public.player_profiles set public_id = gen_random_uuid() where public_id is null;
alter table public.player_profiles alter column public_id set not null;
create unique index if not exists player_profiles_public_id_idx on public.player_profiles (public_id);
alter table public.player_profiles
  add column if not exists is_public boolean not null default true;

create or replace function public.set_player_profile_visibility(
  p_user_id uuid,
  p_is_public boolean
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile public.player_profiles%rowtype;
begin
  if p_user_id is null or p_is_public is null then
    return jsonb_build_object('error', 'INVALID_PROFILE_VISIBILITY');
  end if;

  update public.player_profiles
     set is_public = p_is_public,
         updated_at = now()
   where user_id = p_user_id
   returning * into profile;

  if not found then return jsonb_build_object('error', 'PROFILE_REQUIRED'); end if;
  return jsonb_build_object(
    'publicId', profile.public_id,
    'isPublic', profile.is_public,
    'updatedAt', profile.updated_at
  );
end;
$$;

revoke all on function public.set_player_profile_visibility(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_player_profile_visibility(uuid, boolean) to service_role;

create or replace function public.public_player_profile(p_public_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  profile public.player_profiles%rowtype;
  best_scores jsonb := '{}'::jsonb;
  highest_zone integer := 0;
  qualified_runs integer := 0;
  arsenal_rank integer := 0;
  equipped_ship text := 'ship_default';
  boss_total bigint := 0;
  boss_best integer := 0;
begin
  select * into profile
    from public.player_profiles
   where public_id = p_public_id and is_public = true;
  if not found then return null; end if;

  select coalesce(jsonb_object_agg(best.difficulty, jsonb_build_object(
           'score', best.score,
           'zone', best.zone
         )), '{}'::jsonb)
    into best_scores
    from (
      select distinct on (score.difficulty)
             score.difficulty, score.score, score.zone
        from public.leaderboard_scores score
       where score.user_id = profile.user_id and score.is_hidden = false
       order by score.difficulty, score.score desc, score.created_at asc
    ) best;

  select coalesce(max(score.zone), 0)
    into highest_zone
    from public.leaderboard_scores score
   where score.user_id = profile.user_id and score.is_hidden = false;

  select count(*)::integer
    into qualified_runs
    from public.leaderboard_runs run
   where run.user_id = profile.user_id and run.economy_settled_at is not null;

  select coalesce(progression.arsenal_rank, 0)
    into arsenal_rank
    from public.player_progression progression
   where progression.user_id = profile.user_id;
  arsenal_rank := coalesce(arsenal_rank, 0);

  select coalesce(wallet.equipped_ship, 'ship_default')
    into equipped_ship
    from public.player_wallets wallet
   where wallet.user_id = profile.user_id;
  equipped_ship := coalesce(equipped_ship, 'ship_default');

  select coalesce(sum(contribution.effective_damage), 0),
         coalesce(max(contribution.effective_damage), 0)
    into boss_total, boss_best
    from public.boss_contributions contribution
   where contribution.user_id = profile.user_id;

  return jsonb_build_object(
    'publicId', profile.public_id,
    'displayName', profile.display_name,
    'joined', to_char(profile.created_at at time zone 'UTC', 'YYYY-MM'),
    'equippedShip', equipped_ship,
    'arsenalRank', arsenal_rank,
    'stats', jsonb_build_object(
      'bestScores', best_scores,
      'highestZone', highest_zone,
      'qualifiedRuns', qualified_runs,
      'bossBestDamage', boss_best,
      'bossTotalDamage', boss_total
    )
  );
end;
$$;

revoke all on function public.public_player_profile(uuid) from public, anon, authenticated;
grant execute on function public.public_player_profile(uuid) to service_role;

-- Replace the legacy event ranking response after public profile columns exist.
-- Internal auth IDs are no longer serialized to browsers.
create or replace function public.boss_event_leaderboard(p_event_id uuid, p_user_id uuid, p_limit integer default 10)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with totals as (
    select contribution.user_id,
           sum(contribution.effective_damage)::bigint as total_damage,
           count(*)::integer as assaults,
           min(contribution.created_at) as first_contribution_at
      from public.boss_contributions contribution
     where contribution.event_id = p_event_id and contribution.effective_damage > 0
     group by contribution.user_id
  ), ranked as (
    select totals.*,
           row_number() over (order by totals.total_damage desc, totals.first_contribution_at asc, totals.user_id asc)::integer as rank
      from totals
  ), decorated as (
    select ranked.rank, ranked.user_id,
           coalesce(profile.display_name, 'CROWN PILOT') as player_name,
           case when profile.is_public then profile.public_id else null end as public_profile_id,
           (ranked.user_id = p_user_id) as is_current,
           ranked.total_damage, ranked.assaults
      from ranked
      left join public.player_profiles profile on profile.user_id = ranked.user_id
  )
  select jsonb_build_object(
    'leaders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'rank', entry.rank, 'playerName', entry.player_name,
        'publicProfileId', entry.public_profile_id, 'isCurrent', entry.is_current,
        'damage', entry.total_damage, 'assaults', entry.assaults
      ) order by entry.rank)
      from (select * from decorated order by rank limit greatest(1, least(coalesce(p_limit, 10), 100))) entry
    ), '[]'::jsonb),
    'player', (
      select jsonb_build_object(
        'rank', own.rank, 'playerName', own.player_name,
        'publicProfileId', own.public_profile_id, 'isCurrent', true,
        'damage', own.total_damage, 'assaults', own.assaults
      ) from decorated own where own.user_id = p_user_id
    )
  );
$$;

revoke all on function public.boss_event_leaderboard(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.boss_event_leaderboard(uuid, uuid, integer) to service_role;


-- SOURCE: supabase/weapon-skins-build91.sql
-- Crown Lizard Build 91: server-authoritative weapon cosmetics.
-- Safe to run repeatedly in the Supabase SQL editor.
begin;

alter table public.player_wallets
  add column if not exists equipped_weapon_skins jsonb not null default '{}'::jsonb;

alter table public.cosmetic_catalog
  add column if not exists slot text not null default 'ship';

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
     where conname = 'cosmetic_catalog_slot_check'
       and conrelid = 'public.cosmetic_catalog'::regclass
  ) then
    alter table public.cosmetic_catalog
      add constraint cosmetic_catalog_slot_check
      check (slot in ('ship', 'weapon_laser', 'weapon_tesla', 'weapon_pulse'));
  end if;
end
$$;

insert into public.cosmetic_catalog (id, rarity, sort_order, acquisition_source, slot) values
  ('weapon_tesla_verdant_chain', 'uncommon', 210, 'crate', 'weapon_tesla'),
  ('weapon_tesla_storm_crown', 'rare', 220, 'crate', 'weapon_tesla'),
  ('weapon_laser_void_lance', 'mythic', 230, 'crate', 'weapon_laser'),
  ('weapon_pulse_sovereign_eclipse', 'sovereign', 240, 'crate', 'weapon_pulse'),
  ('weapon_laser_royal_prism', 'royal', 250, 'store', 'weapon_laser'),
  ('weapon_pulse_solar_core', 'royal', 260, 'store', 'weapon_pulse')
on conflict (id) do update
  set rarity = excluded.rarity,
      sort_order = excluded.sort_order,
      acquisition_source = excluded.acquisition_source,
      slot = excluded.slot,
      active = true;

insert into public.store_catalog
  (sku, product_type, cosmetic_id, name, description, price, rarity, sort_order) values
  ('store_weapon_laser_royal_prism', 'cosmetic', 'weapon_laser_royal_prism', 'ROYAL PRISM', 'STORE-EXCLUSIVE LASER SKIN', 950, 'royal', 40),
  ('store_weapon_pulse_solar_core', 'cosmetic', 'weapon_pulse_solar_core', 'SOLAR CORE', 'STORE-EXCLUSIVE PULSE SKIN', 1100, 'royal', 50)
on conflict (sku) do update
  set product_type = excluded.product_type,
      cosmetic_id = excluded.cosmetic_id,
      name = excluded.name,
      description = excluded.description,
      price = excluded.price,
      rarity = excluded.rarity,
      sort_order = excluded.sort_order,
      active = true;

create or replace function public.equip_player_cosmetic(
  p_user_id uuid,
  p_cosmetic_id text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  cosmetic_slot text;
  weapon_key text;
begin
  insert into public.player_wallets (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  perform 1 from public.player_wallets
   where user_id = p_user_id
   for update;

  if p_cosmetic_id = 'ship_default' then
    cosmetic_slot := 'ship';
  elsif p_cosmetic_id in ('weapon_laser_default', 'weapon_tesla_default', 'weapon_pulse_default') then
    cosmetic_slot := replace(p_cosmetic_id, '_default', '');
  else
    select catalog.slot into cosmetic_slot
      from public.player_inventory inventory
      join public.cosmetic_catalog catalog
        on catalog.id = inventory.cosmetic_id and catalog.active
     where inventory.user_id = p_user_id
       and inventory.cosmetic_id = p_cosmetic_id;
    if cosmetic_slot is null then return false; end if;
  end if;

  if cosmetic_slot = 'ship' then
    update public.player_wallets
       set equipped_ship = p_cosmetic_id,
           updated_at = now()
     where user_id = p_user_id;
  elsif cosmetic_slot in ('weapon_laser', 'weapon_tesla', 'weapon_pulse') then
    weapon_key := replace(cosmetic_slot, 'weapon_', '');
    update public.player_wallets
       set equipped_weapon_skins = jsonb_set(
             coalesce(equipped_weapon_skins, '{}'::jsonb),
             array[weapon_key],
             to_jsonb(p_cosmetic_id),
             true
           ),
           updated_at = now()
     where user_id = p_user_id;
  else
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.equip_player_cosmetic(uuid, text) from public, anon, authenticated;
grant execute on function public.equip_player_cosmetic(uuid, text) to service_role;

commit;


-- SOURCE: supabase/promo-codes-build92.sql
-- Crown Lizard Build 92: owner-only campaign codes and server-owned crate credits.
-- Safe to run repeatedly in the Supabase SQL editor.
begin;

alter table public.player_wallets
  add column if not exists free_crate_credits integer not null default 0
  check (free_crate_credits between 0 and 1000000);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role = 'owner'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique check (code_hash ~ '^[a-f0-9]{64}$'),
  code_hint text not null check (code_hint ~ '^CROWN-\*{4}-\*{4}-[A-HJ-NP-Z2-9]{4}$'),
  campaign_name text not null check (char_length(campaign_name) between 3 and 48),
  reward_type text not null check (reward_type in ('shards', 'crate_credit')),
  reward_amount integer not null,
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  max_redemptions integer not null check (max_redemptions between 1 and 100000),
  per_player_limit integer not null default 1 check (per_player_limit = 1),
  redeemed_count integer not null default 0 check (redeemed_count >= 0 and redeemed_count <= max_redemptions),
  status text not null default 'active' check (status in ('active', 'paused', 'revoked', 'exhausted')),
  note text not null default '' check (char_length(note) <= 160),
  created_by uuid not null references public.admin_users(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > starts_at),
  check (
    (reward_type = 'shards' and reward_amount between 25 and 2500)
    or (reward_type = 'crate_credit' and reward_amount between 1 and 5)
  )
);

create table if not exists public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references public.promo_codes(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  reward_type text not null check (reward_type in ('shards', 'crate_credit')),
  reward_amount integer not null check (reward_amount > 0),
  balance_after integer not null check (balance_after between 0 and 1000000000),
  free_crate_credits_after integer not null check (free_crate_credits_after between 0 and 1000000),
  redeemed_at timestamptz not null default now(),
  unique (code_id, user_id)
);

create table if not exists public.promo_redemption_attempts (
  id bigint generated by default as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ip_hash text not null check (ip_hash ~ '^[a-f0-9]{64}$'),
  successful boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_audit_log (
  id bigint generated by default as identity primary key,
  admin_user_id uuid not null references public.admin_users(user_id) on delete restrict,
  action text not null check (action in ('promo.create', 'promo.pause', 'promo.activate', 'promo.revoke')),
  target_id uuid references public.promo_codes(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists promo_codes_status_idx on public.promo_codes (status, expires_at);
create index if not exists promo_redemptions_user_idx on public.promo_redemptions (user_id, redeemed_at desc);
create index if not exists promo_attempts_user_idx on public.promo_redemption_attempts (user_id, created_at desc);
create index if not exists promo_attempts_ip_idx on public.promo_redemption_attempts (ip_hash, created_at desc);
create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);

alter table public.admin_users enable row level security;
alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;
alter table public.promo_redemption_attempts enable row level security;
alter table public.admin_audit_log enable row level security;

revoke all on table public.admin_users from public, anon, authenticated;
revoke all on table public.promo_codes from public, anon, authenticated;
revoke all on table public.promo_redemptions from public, anon, authenticated;
revoke all on table public.promo_redemption_attempts from public, anon, authenticated;
revoke all on table public.admin_audit_log from public, anon, authenticated;

create or replace function public.is_crown_admin(p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users admin
     where admin.user_id = p_user_id and admin.active and admin.role = 'owner'
  );
$$;

revoke all on function public.is_crown_admin(uuid) from public, anon, authenticated;
grant execute on function public.is_crown_admin(uuid) to service_role;

create or replace function public.create_reward_code(
  p_admin_user_id uuid,
  p_code_hash text,
  p_code_hint text,
  p_campaign_name text,
  p_reward_type text,
  p_reward_amount integer,
  p_starts_at timestamptz,
  p_expires_at timestamptz,
  p_max_redemptions integer,
  p_note text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  created public.promo_codes%rowtype;
begin
  if not public.is_crown_admin(p_admin_user_id) then return jsonb_build_object('error', 'ADMIN_REQUIRED'); end if;
  if p_code_hash !~ '^[a-f0-9]{64}$'
     or p_code_hint !~ '^CROWN-\*{4}-\*{4}-[A-HJ-NP-Z2-9]{4}$'
     or char_length(btrim(coalesce(p_campaign_name, ''))) not between 3 and 48
     or char_length(coalesce(p_note, '')) > 160
     or p_starts_at < now() - interval '5 minutes'
     or p_expires_at <= p_starts_at
     or p_expires_at > p_starts_at + interval '90 days'
     or p_max_redemptions not between 1 and 100000
     or not (
       (p_reward_type = 'shards' and p_reward_amount between 25 and 2500)
       or (p_reward_type = 'crate_credit' and p_reward_amount between 1 and 5)
     ) then
    return jsonb_build_object('error', 'INVALID_PROMO');
  end if;

  insert into public.promo_codes (
    code_hash, code_hint, campaign_name, reward_type, reward_amount,
    starts_at, expires_at, max_redemptions, note, created_by
  ) values (
    p_code_hash, p_code_hint, upper(btrim(p_campaign_name)), p_reward_type, p_reward_amount,
    p_starts_at, p_expires_at, p_max_redemptions, btrim(coalesce(p_note, '')), p_admin_user_id
  ) returning * into created;

  insert into public.admin_audit_log (admin_user_id, action, target_id, metadata)
  values (
    p_admin_user_id, 'promo.create', created.id,
    jsonb_build_object('rewardType', created.reward_type, 'rewardAmount', created.reward_amount, 'maxRedemptions', created.max_redemptions)
  );

  return jsonb_build_object(
    'id', created.id, 'codeHint', created.code_hint, 'campaignName', created.campaign_name,
    'rewardType', created.reward_type, 'rewardAmount', created.reward_amount,
    'startsAt', created.starts_at, 'expiresAt', created.expires_at,
    'maxRedemptions', created.max_redemptions, 'redeemedCount', 0, 'status', created.status,
    'createdAt', created.created_at
  );
exception when unique_violation then
  return jsonb_build_object('error', 'CODE_COLLISION');
end;
$$;

revoke all on function public.create_reward_code(uuid, text, text, text, text, integer, timestamptz, timestamptz, integer, text) from public, anon, authenticated;
grant execute on function public.create_reward_code(uuid, text, text, text, text, integer, timestamptz, timestamptz, integer, text) to service_role;

create or replace function public.set_reward_code_status(
  p_admin_user_id uuid,
  p_code_id uuid,
  p_status text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  promo public.promo_codes%rowtype;
begin
  if not public.is_crown_admin(p_admin_user_id) then return jsonb_build_object('error', 'ADMIN_REQUIRED'); end if;
  if p_status not in ('active', 'paused', 'revoked') then return jsonb_build_object('error', 'INVALID_STATUS'); end if;

  select * into promo from public.promo_codes where id = p_code_id for update;
  if not found then return jsonb_build_object('error', 'PROMO_NOT_FOUND'); end if;
  if promo.status in ('revoked', 'exhausted') then return jsonb_build_object('error', 'PROMO_FINAL'); end if;

  update public.promo_codes set status = p_status, updated_at = now() where id = p_code_id returning * into promo;
  insert into public.admin_audit_log (admin_user_id, action, target_id, metadata)
  values (p_admin_user_id, 'promo.' || case when p_status = 'active' then 'activate' else p_status end, p_code_id, '{}'::jsonb);

  return jsonb_build_object('id', promo.id, 'status', promo.status, 'updatedAt', promo.updated_at);
end;
$$;

revoke all on function public.set_reward_code_status(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.set_reward_code_status(uuid, uuid, text) to service_role;

create or replace function public.redeem_reward_code(
  p_user_id uuid,
  p_code_hash text,
  p_ip_hash text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  promo public.promo_codes%rowtype;
  wallet public.player_wallets%rowtype;
  attempt_id bigint;
  recent_attempts integer;
begin
  if p_user_id is null or p_code_hash !~ '^[a-f0-9]{64}$' or p_ip_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('error', 'INVALID_CODE');
  end if;
  if not exists (select 1 from auth.users where id = p_user_id and not is_anonymous) then
    return jsonb_build_object('error', 'ACCOUNT_REQUIRED');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text || ':' || p_ip_hash, 0));
  select count(*) into recent_attempts
    from public.promo_redemption_attempts
   where (user_id = p_user_id or ip_hash = p_ip_hash)
     and created_at >= now() - interval '10 minutes';
  if recent_attempts >= 8 then return jsonb_build_object('error', 'RATE_LIMITED'); end if;

  insert into public.promo_redemption_attempts (user_id, ip_hash)
  values (p_user_id, p_ip_hash) returning id into attempt_id;

  select * into promo from public.promo_codes where code_hash = p_code_hash for update;
  if not found
     or promo.status <> 'active'
     or promo.starts_at > now()
     or promo.expires_at <= now()
     or promo.redeemed_count >= promo.max_redemptions then
    return jsonb_build_object('error', 'INVALID_CODE');
  end if;

  if exists (select 1 from public.promo_redemptions where code_id = promo.id and user_id = p_user_id) then
    return jsonb_build_object('error', 'ALREADY_REDEEMED');
  end if;

  insert into public.player_wallets (user_id) values (p_user_id) on conflict (user_id) do nothing;
  select * into wallet from public.player_wallets where user_id = p_user_id for update;

  if promo.reward_type = 'shards' then
    update public.player_wallets
       set balance = balance + promo.reward_amount, updated_at = now()
     where user_id = p_user_id returning * into wallet;
  else
    update public.player_wallets
       set free_crate_credits = free_crate_credits + promo.reward_amount, updated_at = now()
     where user_id = p_user_id returning * into wallet;
  end if;

  insert into public.promo_redemptions (
    code_id, user_id, reward_type, reward_amount, balance_after, free_crate_credits_after
  ) values (
    promo.id, p_user_id, promo.reward_type, promo.reward_amount, wallet.balance, wallet.free_crate_credits
  );

  update public.promo_codes
     set redeemed_count = redeemed_count + 1,
         status = case when redeemed_count + 1 >= max_redemptions then 'exhausted' else status end,
         updated_at = now()
   where id = promo.id;

  insert into public.economy_transactions (user_id, external_id, kind, amount, balance_after, metadata)
  values (
    p_user_id, 'promo:' || promo.id::text,
    case when promo.reward_type = 'shards' then 'promo_shards' else 'promo_crate_credit' end,
    case when promo.reward_type = 'shards' then promo.reward_amount else 0 end,
    wallet.balance,
    jsonb_build_object('codeId', promo.id, 'campaignName', promo.campaign_name, 'rewardType', promo.reward_type, 'rewardAmount', promo.reward_amount, 'freeCrateCreditsAfter', wallet.free_crate_credits)
  );

  update public.promo_redemption_attempts set successful = true where id = attempt_id;
  return jsonb_build_object(
    'redeemed', true, 'campaignName', promo.campaign_name,
    'rewardType', promo.reward_type, 'rewardAmount', promo.reward_amount,
    'balance', wallet.balance, 'freeCrateCredits', wallet.free_crate_credits
  );
end;
$$;

revoke all on function public.redeem_reward_code(uuid, text, text) from public, anon, authenticated;
grant execute on function public.redeem_reward_code(uuid, text, text) to service_role;

-- Free credits enter the existing crate transaction. Odds, pity, inventory and
-- duplicate salvage stay identical; only the 150-shard charge is skipped.
create or replace function public.open_crown_crate(
  p_user_id uuid,
  p_opening_id uuid,
  p_tier_roll integer,
  p_cosmetic_roll integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  wallet public.player_wallets%rowtype;
  existing_tx public.economy_transactions%rowtype;
  selected_tier text;
  selected_cosmetic text;
  guaranteed boolean;
  is_duplicate boolean;
  uses_free_credit boolean;
  salvage integer;
  candidate_count integer;
  opening_number integer;
  resulting_balance integer;
  outcome jsonb;
begin
  if p_tier_roll < 0 or p_tier_roll > 9999 then raise exception 'invalid tier roll'; end if;
  if p_cosmetic_roll < 0 or p_cosmetic_roll > 999999 then raise exception 'invalid cosmetic roll'; end if;
  insert into public.player_wallets (user_id) values (p_user_id) on conflict (user_id) do nothing;
  select * into wallet from public.player_wallets where user_id = p_user_id for update;
  select * into existing_tx from public.economy_transactions
   where user_id = p_user_id and external_id = 'crate:' || p_opening_id::text;
  if found then
    return jsonb_build_object('duplicateRequest', true, 'balance', existing_tx.balance_after, 'outcome', existing_tx.metadata->'outcome');
  end if;

  uses_free_credit := wallet.free_crate_credits > 0;
  if not uses_free_credit and wallet.balance < 150 then
    return jsonb_build_object('error', 'NOT_ENOUGH_SHARDS', 'balance', wallet.balance, 'freeCrateCredits', wallet.free_crate_credits);
  end if;

  guaranteed := wallet.since_sovereign >= 199;
  selected_tier := case
    when guaranteed then 'sovereign'
    when p_tier_roll < 5800 then 'uncommon'
    when p_tier_roll < 8600 then 'rare'
    when p_tier_roll < 9600 then 'royal'
    when p_tier_roll < 9950 then 'mythic'
    else 'sovereign'
  end;
  select count(*) into candidate_count from public.cosmetic_catalog
   where rarity = selected_tier and active and acquisition_source = 'crate';
  if candidate_count = 0 then raise exception 'empty cosmetic tier'; end if;
  select id into selected_cosmetic from public.cosmetic_catalog
   where rarity = selected_tier and active and acquisition_source = 'crate'
   order by sort_order offset (p_cosmetic_roll % candidate_count) limit 1;

  if wallet.opens = 0 and exists (
    select 1 from public.player_inventory where user_id = p_user_id and cosmetic_id = selected_cosmetic
  ) then
    select count(*) into candidate_count from public.cosmetic_catalog catalog
     where catalog.rarity = selected_tier and catalog.active and catalog.acquisition_source = 'crate'
       and not exists (select 1 from public.player_inventory owned where owned.user_id = p_user_id and owned.cosmetic_id = catalog.id);
    if candidate_count > 0 then
      select catalog.id into selected_cosmetic from public.cosmetic_catalog catalog
       where catalog.rarity = selected_tier and catalog.active and catalog.acquisition_source = 'crate'
         and not exists (select 1 from public.player_inventory owned where owned.user_id = p_user_id and owned.cosmetic_id = catalog.id)
       order by catalog.sort_order offset (p_cosmetic_roll % candidate_count) limit 1;
    else
      select count(*) into candidate_count from public.cosmetic_catalog catalog
       where catalog.active and catalog.acquisition_source = 'crate'
         and not exists (select 1 from public.player_inventory owned where owned.user_id = p_user_id and owned.cosmetic_id = catalog.id);
      if candidate_count > 0 then
        select catalog.id into selected_cosmetic from public.cosmetic_catalog catalog
         where catalog.active and catalog.acquisition_source = 'crate'
           and not exists (select 1 from public.player_inventory owned where owned.user_id = p_user_id and owned.cosmetic_id = catalog.id)
         order by catalog.sort_order offset (p_cosmetic_roll % candidate_count) limit 1;
        select rarity into selected_tier from public.cosmetic_catalog where id = selected_cosmetic;
      end if;
    end if;
  end if;

  select exists (select 1 from public.player_inventory where user_id = p_user_id and cosmetic_id = selected_cosmetic) into is_duplicate;
  salvage := case selected_tier when 'uncommon' then 15 when 'rare' then 35 when 'royal' then 75 when 'mythic' then 150 when 'sovereign' then 300 else 0 end;
  if not is_duplicate then salvage := 0; end if;
  opening_number := wallet.opens + 1;
  resulting_balance := wallet.balance - case when uses_free_credit then 0 else 150 end + salvage;

  if not is_duplicate then
    insert into public.player_inventory (user_id, cosmetic_id, source)
    values (p_user_id, selected_cosmetic, 'crate') on conflict (user_id, cosmetic_id) do nothing;
  end if;

  update public.player_wallets
     set balance = resulting_balance,
         free_crate_credits = free_crate_credits - case when uses_free_credit then 1 else 0 end,
         opens = opening_number,
         since_sovereign = case when selected_tier = 'sovereign' then 0 else least(199, wallet.since_sovereign + 1) end,
         updated_at = now()
   where user_id = p_user_id;

  outcome := jsonb_build_object(
    'openingId', p_opening_id, 'openingNumber', opening_number,
    'cosmeticId', selected_cosmetic, 'tier', selected_tier,
    'duplicate', is_duplicate, 'salvageValue', salvage,
    'guaranteedSovereign', guaranteed, 'freeCredit', uses_free_credit,
    'source', 'crate', 'createdAt', now()
  );
  insert into public.economy_transactions (user_id, external_id, kind, amount, balance_after, opening_id, metadata)
  values (
    p_user_id, 'crate:' || p_opening_id::text,
    case when uses_free_credit then 'crate_open_free' else 'crate_open' end,
    -(case when uses_free_credit then 0 else 150 end) + salvage,
    resulting_balance, p_opening_id,
    jsonb_build_object('cost', case when uses_free_credit then 0 else 150 end, 'salvage', salvage, 'freeCredit', uses_free_credit, 'outcome', outcome)
  );
  return jsonb_build_object(
    'duplicateRequest', false, 'balance', resulting_balance,
    'freeCrateCredits', wallet.free_crate_credits - case when uses_free_credit then 1 else 0 end,
    'outcome', outcome
  );
end;
$$;

revoke all on function public.open_crown_crate(uuid, uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.open_crown_crate(uuid, uuid, integer, integer) to service_role;

commit;


-- SOURCE: supabase/market-mvp-build94.sql
-- Crown Market MVP: server-owned cosmetic escrow and atomic shard settlement.
-- Apply after schema.sql / promo-codes-build92.sql.

alter table public.player_inventory add column if not exists market_listing_id uuid;
alter table public.player_inventory add column if not exists market_listed_at timestamptz;

do $$ begin
  alter table public.player_inventory drop constraint if exists player_inventory_source_check;
  alter table public.player_inventory add constraint player_inventory_source_check
    check (source in ('crate', 'shop', 'sponsored', 'grant', 'legacy', 'market'));
exception when duplicate_object then null; end $$;

create table if not exists public.market_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete restrict,
  cosmetic_id text not null references public.cosmetic_catalog(id) on delete restrict,
  price integer not null check (price between 50 and 15000),
  fee_rate integer not null default 10 check (fee_rate between 0 and 100),
  status text not null default 'active' check (status in ('active', 'sold', 'cancelled')),
  request_id uuid not null,
  buyer_id uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sold_at timestamptz,
  cancelled_at timestamptz,
  unique (seller_id, request_id)
);

alter table public.player_inventory
  drop constraint if exists player_inventory_market_listing_id_fkey;
alter table public.player_inventory
  add constraint player_inventory_market_listing_id_fkey
  foreign key (market_listing_id) references public.market_listings(id) on delete restrict;

create unique index if not exists market_listings_one_active_cosmetic
  on public.market_listings (seller_id, cosmetic_id) where status = 'active';
create index if not exists market_listings_browse_idx
  on public.market_listings (status, created_at desc);
create index if not exists market_listings_cosmetic_price_idx
  on public.market_listings (cosmetic_id, price) where status = 'active';

create table if not exists public.market_sales (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null unique references public.market_listings(id) on delete restrict,
  buyer_id uuid not null references auth.users(id) on delete restrict,
  seller_id uuid not null references auth.users(id) on delete restrict,
  cosmetic_id text not null references public.cosmetic_catalog(id) on delete restrict,
  price integer not null,
  fee integer not null,
  seller_payout integer not null,
  request_id uuid not null,
  created_at timestamptz not null default now(),
  unique (buyer_id, request_id)
);

alter table public.market_listings enable row level security;
alter table public.market_sales enable row level security;
revoke all on table public.market_listings from anon, authenticated;
revoke all on table public.market_sales from anon, authenticated;

create or replace function public.market_price_bounds(p_rarity text)
returns jsonb language sql immutable set search_path = '' as $$
  select case p_rarity
    when 'uncommon' then jsonb_build_object('minimum', 50, 'maximum', 750)
    when 'rare' then jsonb_build_object('minimum', 100, 'maximum', 1500)
    when 'royal' then jsonb_build_object('minimum', 200, 'maximum', 3000)
    when 'mythic' then jsonb_build_object('minimum', 400, 'maximum', 6000)
    when 'sovereign' then jsonb_build_object('minimum', 1000, 'maximum', 15000)
    else jsonb_build_object('minimum', 0, 'maximum', 0) end;
$$;

create or replace function public.create_market_listing(p_user_id uuid, p_cosmetic_id text, p_price integer, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  item public.player_inventory%rowtype;
  catalog public.cosmetic_catalog%rowtype;
  wallet public.player_wallets%rowtype;
  existing public.market_listings%rowtype;
  bounds jsonb;
  listing public.market_listings%rowtype;
begin
  if p_user_id is null or p_request_id is null or p_cosmetic_id is null then return jsonb_build_object('error','INVALID_REQUEST'); end if;
  if not exists (select 1 from auth.users where id=p_user_id and not is_anonymous)
     or not exists (select 1 from public.player_profiles where user_id=p_user_id) then
    return jsonb_build_object('error','ACCOUNT_REQUIRED');
  end if;
  select * into existing from public.market_listings where seller_id=p_user_id and request_id=p_request_id;
  if found then return jsonb_build_object('duplicateRequest',true,'listingId',existing.id,'status',existing.status); end if;
  if (select count(*) from public.market_listings where seller_id=p_user_id and status='active') >= 5 then
    return jsonb_build_object('error','LISTING_LIMIT');
  end if;
  select * into catalog from public.cosmetic_catalog where id=p_cosmetic_id and active and acquisition_source='crate';
  if not found then return jsonb_build_object('error','NOT_TRADEABLE'); end if;
  bounds := public.market_price_bounds(catalog.rarity);
  if p_price < (bounds->>'minimum')::integer or p_price > (bounds->>'maximum')::integer then
    return jsonb_build_object('error','PRICE_OUT_OF_RANGE','bounds',bounds);
  end if;
  insert into public.player_wallets(user_id) values(p_user_id) on conflict(user_id) do nothing;
  select * into wallet from public.player_wallets where user_id=p_user_id for update;
  select * into item from public.player_inventory where user_id=p_user_id and cosmetic_id=p_cosmetic_id for update;
  if not found then return jsonb_build_object('error','ITEM_NOT_OWNED'); end if;
  if item.market_listing_id is not null then return jsonb_build_object('error','ALREADY_LISTED'); end if;
  if wallet.equipped_ship=p_cosmetic_id or wallet.equipped_weapon_skins::text like '%' || p_cosmetic_id || '%' then
    return jsonb_build_object('error','ITEM_EQUIPPED');
  end if;
  insert into public.market_listings(seller_id,cosmetic_id,price,request_id)
  values(p_user_id,p_cosmetic_id,p_price,p_request_id) returning * into listing;
  update public.player_inventory set market_listing_id=listing.id,market_listed_at=now()
   where user_id=p_user_id and cosmetic_id=p_cosmetic_id;
  return jsonb_build_object('duplicateRequest',false,'listingId',listing.id,'cosmeticId',listing.cosmetic_id,'price',listing.price,'status',listing.status,'createdAt',listing.created_at);
end $$;

create or replace function public.cancel_market_listing(p_user_id uuid, p_listing_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare listing public.market_listings%rowtype;
begin
  select * into listing from public.market_listings where id=p_listing_id for update;
  if not found then return jsonb_build_object('error','LISTING_NOT_FOUND'); end if;
  if listing.seller_id<>p_user_id then return jsonb_build_object('error','NOT_LISTING_OWNER'); end if;
  if listing.status='cancelled' then return jsonb_build_object('duplicateRequest',true,'listingId',listing.id,'status',listing.status); end if;
  if listing.status<>'active' then return jsonb_build_object('error','LISTING_FINAL'); end if;
  update public.market_listings set status='cancelled',cancelled_at=now(),updated_at=now() where id=listing.id;
  update public.player_inventory set market_listing_id=null,market_listed_at=null where user_id=p_user_id and market_listing_id=listing.id;
  return jsonb_build_object('duplicateRequest',false,'listingId',listing.id,'status','cancelled');
end $$;

create or replace function public.buy_market_listing(p_user_id uuid, p_listing_id uuid, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  listing public.market_listings%rowtype; buyer public.player_wallets%rowtype; seller public.player_wallets%rowtype;
  existing public.market_sales%rowtype; fee integer; payout integer; buyer_balance integer; seller_balance integer;
begin
  if p_user_id is null or p_listing_id is null or p_request_id is null then return jsonb_build_object('error','INVALID_REQUEST'); end if;
  if not exists(select 1 from auth.users where id=p_user_id and not is_anonymous)
     or not exists(select 1 from public.player_profiles where user_id=p_user_id) then return jsonb_build_object('error','ACCOUNT_REQUIRED'); end if;
  select * into existing from public.market_sales where buyer_id=p_user_id and request_id=p_request_id;
  if found then return jsonb_build_object('duplicateRequest',true,'saleId',existing.id,'listingId',existing.listing_id,'cosmeticId',existing.cosmetic_id,'price',existing.price); end if;
  select * into listing from public.market_listings where id=p_listing_id for update;
  if not found then return jsonb_build_object('error','LISTING_NOT_FOUND'); end if;
  if listing.status<>'active' then return jsonb_build_object('error','LISTING_UNAVAILABLE'); end if;
  if listing.seller_id=p_user_id then return jsonb_build_object('error','SELF_PURCHASE'); end if;
  insert into public.player_wallets(user_id) values(p_user_id),(listing.seller_id) on conflict(user_id) do nothing;
  perform 1 from public.player_wallets where user_id in (p_user_id,listing.seller_id) order by user_id for update;
  select * into buyer from public.player_wallets where user_id=p_user_id;
  select * into seller from public.player_wallets where user_id=listing.seller_id;
  if buyer.balance<listing.price then return jsonb_build_object('error','NOT_ENOUGH_SHARDS','balance',buyer.balance,'cost',listing.price); end if;
  if exists(select 1 from public.player_inventory where user_id=p_user_id and cosmetic_id=listing.cosmetic_id) then return jsonb_build_object('error','ALREADY_OWNED'); end if;
  if not exists(select 1 from public.player_inventory where user_id=listing.seller_id and cosmetic_id=listing.cosmetic_id and market_listing_id=listing.id) then return jsonb_build_object('error','ESCROW_MISSING'); end if;
  fee := greatest(1,floor(listing.price*listing.fee_rate/100.0)::integer); payout := listing.price-fee;
  update public.player_wallets set balance=balance-listing.price,updated_at=now() where user_id=p_user_id returning balance into buyer_balance;
  update public.player_wallets set balance=balance+payout,updated_at=now() where user_id=listing.seller_id returning balance into seller_balance;
  delete from public.player_inventory where user_id=listing.seller_id and cosmetic_id=listing.cosmetic_id and market_listing_id=listing.id;
  insert into public.player_inventory(user_id,cosmetic_id,source,acquired_at,seen_at) values(p_user_id,listing.cosmetic_id,'market',now(),null);
  update public.market_listings set status='sold',buyer_id=p_user_id,sold_at=now(),updated_at=now() where id=listing.id;
  insert into public.market_sales(listing_id,buyer_id,seller_id,cosmetic_id,price,fee,seller_payout,request_id)
  values(listing.id,p_user_id,listing.seller_id,listing.cosmetic_id,listing.price,fee,payout,p_request_id) returning * into existing;
  insert into public.economy_transactions(user_id,external_id,kind,amount,balance_after,metadata) values
   (p_user_id,'market:buy:'||existing.id,'market_purchase',-listing.price,buyer_balance,jsonb_build_object('listingId',listing.id,'cosmeticId',listing.cosmetic_id,'fee',fee)),
   (listing.seller_id,'market:sale:'||existing.id,'market_sale',payout,seller_balance,jsonb_build_object('listingId',listing.id,'cosmeticId',listing.cosmetic_id,'fee',fee));
  return jsonb_build_object('duplicateRequest',false,'saleId',existing.id,'listingId',listing.id,'cosmeticId',listing.cosmetic_id,'price',listing.price,'fee',fee,'sellerPayout',payout);
end $$;

create or replace function public.market_snapshot(p_user_id uuid default null, p_limit integer default 60)
returns jsonb language sql security definer set search_path = '' as $$
  with active as (
    select l.id,l.cosmetic_id,l.price,l.fee_rate,l.seller_id,l.created_at,c.rarity,c.slot,
           coalesce(p.display_name,'PILOT') seller_name,
           case when p.is_public then p.public_id else null end seller_public_id
      from public.market_listings l join public.cosmetic_catalog c on c.id=l.cosmetic_id
      left join public.player_profiles p on p.user_id=l.seller_id
     where l.status='active' order by l.created_at desc limit least(greatest(p_limit,1),100)
  ), mine as (
    select l.id,l.cosmetic_id,l.price,l.status,l.created_at,l.sold_at,l.cancelled_at
      from public.market_listings l where p_user_id is not null and l.seller_id=p_user_id
     order by l.created_at desc limit 30
  )
  select jsonb_build_object(
    'rules',jsonb_build_object('feePercent',10,'maxActiveListings',5,'tradeableSource','crate'),
    'listings',coalesce((select jsonb_agg(to_jsonb(active)) from active),'[]'::jsonb),
    'myListings',coalesce((select jsonb_agg(to_jsonb(mine)) from mine),'[]'::jsonb)
  );
$$;

revoke all on function public.market_price_bounds(text) from public,anon,authenticated;
revoke all on function public.create_market_listing(uuid,text,integer,uuid) from public,anon,authenticated;
revoke all on function public.cancel_market_listing(uuid,uuid) from public,anon,authenticated;
revoke all on function public.buy_market_listing(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.market_snapshot(uuid,integer) from public,anon,authenticated;
grant execute on function public.market_price_bounds(text) to service_role;
grant execute on function public.create_market_listing(uuid,text,integer,uuid) to service_role;
grant execute on function public.cancel_market_listing(uuid,uuid) to service_role;
grant execute on function public.buy_market_listing(uuid,uuid,uuid) to service_role;
grant execute on function public.market_snapshot(uuid,integer) to service_role;

-- Listed cosmetics remain reserved in inventory so crate duplicate protection still sees them.
create or replace function public.equip_player_cosmetic(p_user_id uuid,p_cosmetic_id text)
returns boolean language plpgsql security definer set search_path='' as $$
declare slot_name text; weapon_key text;
begin
  if p_cosmetic_id='ship_default' then update public.player_wallets set equipped_ship=p_cosmetic_id,updated_at=now() where user_id=p_user_id; return found; end if;
  if p_cosmetic_id in ('weapon_laser_default','weapon_tesla_default','weapon_pulse_default') then
    weapon_key:=split_part(p_cosmetic_id,'_',2); update public.player_wallets set equipped_weapon_skins=jsonb_set(equipped_weapon_skins,array[weapon_key],to_jsonb(p_cosmetic_id),true),updated_at=now() where user_id=p_user_id; return found;
  end if;
  select c.slot into slot_name from public.player_inventory i join public.cosmetic_catalog c on c.id=i.cosmetic_id
   where i.user_id=p_user_id and i.cosmetic_id=p_cosmetic_id and i.market_listing_id is null and c.active;
  if not found then return false; end if;
  if slot_name='ship' then update public.player_wallets set equipped_ship=p_cosmetic_id,updated_at=now() where user_id=p_user_id;
  else weapon_key:=split_part(slot_name,'_',2); update public.player_wallets set equipped_weapon_skins=jsonb_set(equipped_weapon_skins,array[weapon_key],to_jsonb(p_cosmetic_id),true),updated_at=now() where user_id=p_user_id; end if;
  return true;
end $$;
revoke all on function public.equip_player_cosmetic(uuid,text) from public,anon,authenticated;
grant execute on function public.equip_player_cosmetic(uuid,text) to service_role;


-- SOURCE: supabase/market-signals-build95.sql
-- Build 95: seven-day listing expiry, seller signals and private market activity.
-- Apply after market-mvp-build94.sql.

begin;

alter table public.market_listings add column if not exists expires_at timestamptz;
update public.market_listings set expires_at=created_at+interval '7 days' where expires_at is null;
alter table public.market_listings alter column expires_at set default (now()+interval '7 days');
alter table public.market_listings alter column expires_at set not null;
alter table public.market_listings drop constraint if exists market_listings_status_check;
alter table public.market_listings add constraint market_listings_status_check
  check (status in ('active','sold','cancelled','expired'));
alter table public.market_listings drop constraint if exists market_listings_expiry_check;
alter table public.market_listings add constraint market_listings_expiry_check check (expires_at>created_at);
create index if not exists market_listings_expiry_idx
  on public.market_listings(expires_at) where status='active';

alter table public.market_sales add column if not exists seller_seen_at timestamptz;
create index if not exists market_sales_unseen_seller_idx
  on public.market_sales(seller_id,created_at desc) where seller_seen_at is null;

create or replace function public.expire_market_listings(p_limit integer default 250)
returns integer language plpgsql security definer set search_path='' as $$
declare expired_ids uuid[]; expired_count integer;
begin
  with due as (
    select id from public.market_listings
     where status='active' and expires_at<=now()
     order by expires_at asc
     for update skip locked
     limit least(greatest(coalesce(p_limit,250),1),1000)
  ), expired as (
    update public.market_listings l set status='expired',updated_at=now()
     where l.id in (select id from due) returning l.id
  )
  select coalesce(array_agg(id),array[]::uuid[]) into expired_ids from expired;
  expired_count:=cardinality(expired_ids);
  if expired_count>0 then
    update public.player_inventory set market_listing_id=null,market_listed_at=null
     where market_listing_id=any(expired_ids);
  end if;
  return expired_count;
end $$;

create or replace function public.create_market_listing(p_user_id uuid,p_cosmetic_id text,p_price integer,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  item public.player_inventory%rowtype; catalog public.cosmetic_catalog%rowtype;
  wallet public.player_wallets%rowtype; existing public.market_listings%rowtype;
  bounds jsonb; listing public.market_listings%rowtype;
begin
  perform public.expire_market_listings(250);
  if p_user_id is null or p_request_id is null or p_cosmetic_id is null then return jsonb_build_object('error','INVALID_REQUEST'); end if;
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

create or replace function public.cancel_market_listing(p_user_id uuid,p_listing_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare listing public.market_listings%rowtype;
begin
  perform public.expire_market_listings(250);
  select * into listing from public.market_listings where id=p_listing_id for update;
  if not found then return jsonb_build_object('error','LISTING_NOT_FOUND'); end if;
  if listing.seller_id<>p_user_id then return jsonb_build_object('error','NOT_LISTING_OWNER'); end if;
  if listing.status='cancelled' then return jsonb_build_object('duplicateRequest',true,'listingId',listing.id,'status',listing.status); end if;
  if listing.status<>'active' then return jsonb_build_object('error','LISTING_FINAL'); end if;
  update public.market_listings set status='cancelled',cancelled_at=now(),updated_at=now() where id=listing.id;
  update public.player_inventory set market_listing_id=null,market_listed_at=null where user_id=p_user_id and market_listing_id=listing.id;
  return jsonb_build_object('duplicateRequest',false,'listingId',listing.id,'status','cancelled');
end $$;

create or replace function public.buy_market_listing(p_user_id uuid,p_listing_id uuid,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  listing public.market_listings%rowtype; buyer public.player_wallets%rowtype; seller public.player_wallets%rowtype;
  existing public.market_sales%rowtype; fee integer; payout integer; buyer_balance integer; seller_balance integer;
begin
  perform public.expire_market_listings(250);
  if p_user_id is null or p_listing_id is null or p_request_id is null then return jsonb_build_object('error','INVALID_REQUEST'); end if;
  if not exists(select 1 from auth.users where id=p_user_id and not is_anonymous)
     or not exists(select 1 from public.player_profiles where user_id=p_user_id) then return jsonb_build_object('error','ACCOUNT_REQUIRED'); end if;
  select * into existing from public.market_sales where buyer_id=p_user_id and request_id=p_request_id;
  if found then return jsonb_build_object('duplicateRequest',true,'saleId',existing.id,'listingId',existing.listing_id,'cosmeticId',existing.cosmetic_id,'price',existing.price); end if;
  select * into listing from public.market_listings where id=p_listing_id for update;
  if not found then return jsonb_build_object('error','LISTING_NOT_FOUND'); end if;
  if listing.status<>'active' or listing.expires_at<=now() then return jsonb_build_object('error','LISTING_UNAVAILABLE'); end if;
  if listing.seller_id=p_user_id then return jsonb_build_object('error','SELF_PURCHASE'); end if;
  insert into public.player_wallets(user_id) values(p_user_id),(listing.seller_id) on conflict(user_id) do nothing;
  perform 1 from public.player_wallets where user_id in(p_user_id,listing.seller_id) order by user_id for update;
  select * into buyer from public.player_wallets where user_id=p_user_id;
  select * into seller from public.player_wallets where user_id=listing.seller_id;
  if buyer.balance<listing.price then return jsonb_build_object('error','NOT_ENOUGH_SHARDS','balance',buyer.balance,'cost',listing.price); end if;
  if exists(select 1 from public.player_inventory where user_id=p_user_id and cosmetic_id=listing.cosmetic_id) then return jsonb_build_object('error','ALREADY_OWNED'); end if;
  if not exists(select 1 from public.player_inventory where user_id=listing.seller_id and cosmetic_id=listing.cosmetic_id and market_listing_id=listing.id) then return jsonb_build_object('error','ESCROW_MISSING'); end if;
  fee:=greatest(1,floor(listing.price*listing.fee_rate/100.0)::integer); payout:=listing.price-fee;
  update public.player_wallets set balance=balance-listing.price,updated_at=now() where user_id=p_user_id returning balance into buyer_balance;
  update public.player_wallets set balance=balance+payout,updated_at=now() where user_id=listing.seller_id returning balance into seller_balance;
  delete from public.player_inventory where user_id=listing.seller_id and cosmetic_id=listing.cosmetic_id and market_listing_id=listing.id;
  insert into public.player_inventory(user_id,cosmetic_id,source,acquired_at,seen_at) values(p_user_id,listing.cosmetic_id,'market',now(),null);
  update public.market_listings set status='sold',buyer_id=p_user_id,sold_at=now(),updated_at=now() where id=listing.id;
  insert into public.market_sales(listing_id,buyer_id,seller_id,cosmetic_id,price,fee,seller_payout,request_id)
   values(listing.id,p_user_id,listing.seller_id,listing.cosmetic_id,listing.price,fee,payout,p_request_id) returning * into existing;
  insert into public.economy_transactions(user_id,external_id,kind,amount,balance_after,metadata) values
   (p_user_id,'market:buy:'||existing.id,'market_purchase',-listing.price,buyer_balance,jsonb_build_object('listingId',listing.id,'cosmeticId',listing.cosmetic_id,'fee',fee)),
   (listing.seller_id,'market:sale:'||existing.id,'market_sale',payout,seller_balance,jsonb_build_object('listingId',listing.id,'cosmeticId',listing.cosmetic_id,'fee',fee));
  return jsonb_build_object('duplicateRequest',false,'saleId',existing.id,'listingId',listing.id,'cosmeticId',listing.cosmetic_id,'price',listing.price,'fee',fee,'sellerPayout',payout);
end $$;

create or replace function public.market_snapshot(p_user_id uuid default null,p_limit integer default 60)
returns jsonb language plpgsql security definer set search_path='' as $$
declare payload jsonb;
begin
  perform public.expire_market_listings(250);
  with active as (
    select l.id,l.cosmetic_id,l.price,l.fee_rate,l.created_at,l.expires_at,c.rarity,c.slot,
           coalesce(p.display_name,'PILOT') seller_name,case when p.is_public then p.public_id else null end seller_public_id
      from public.market_listings l join public.cosmetic_catalog c on c.id=l.cosmetic_id
      left join public.player_profiles p on p.user_id=l.seller_id
     where l.status='active' and l.expires_at>now() order by l.created_at desc limit least(greatest(p_limit,1),100)
  ), mine as (
    select l.id,l.cosmetic_id,l.price,l.status,l.created_at,l.expires_at,l.sold_at,l.cancelled_at,l.updated_at
      from public.market_listings l where p_user_id is not null and l.seller_id=p_user_id
     order by l.created_at desc limit 30
  ), activity_rows as (
    select ('buy:'||s.id)::text activity_id,'bought'::text kind,s.cosmetic_id,-s.price amount,0 fee,s.created_at occurred_at,coalesce(p.display_name,'PILOT') counterparty
      from public.market_sales s left join public.player_profiles p on p.user_id=s.seller_id where s.buyer_id=p_user_id
    union all
    select ('sale:'||s.id)::text,'sold',s.cosmetic_id,s.seller_payout,s.fee,s.created_at,coalesce(p.display_name,'PILOT')
      from public.market_sales s left join public.player_profiles p on p.user_id=s.buyer_id where s.seller_id=p_user_id
    union all
    select ('listing:'||l.id||':'||l.status)::text,l.status,l.cosmetic_id,0,0,coalesce(l.cancelled_at,l.updated_at),null
      from public.market_listings l where l.seller_id=p_user_id and l.status in('cancelled','expired')
  ), recent_activity as (
    select * from activity_rows order by occurred_at desc limit 20
  ), signals as (
    select s.id,s.cosmetic_id,s.price,s.fee,s.seller_payout,s.created_at,coalesce(p.display_name,'PILOT') buyer_name
      from public.market_sales s left join public.player_profiles p on p.user_id=s.buyer_id
     where p_user_id is not null and s.seller_id=p_user_id and s.seller_seen_at is null
     order by s.created_at asc limit 10
  )
  select jsonb_build_object(
    'rules',jsonb_build_object('feePercent',10,'maxActiveListings',5,'tradeableSource','crate','listingDays',7),
    'listings',coalesce((select jsonb_agg(to_jsonb(active)) from active),'[]'::jsonb),
    'myListings',coalesce((select jsonb_agg(to_jsonb(mine)) from mine),'[]'::jsonb),
    'activity',coalesce((select jsonb_agg(to_jsonb(recent_activity) order by occurred_at desc) from recent_activity),'[]'::jsonb),
    'signals',coalesce((select jsonb_agg(to_jsonb(signals) order by created_at asc) from signals),'[]'::jsonb)
  ) into payload;
  return payload;
end $$;

create or replace function public.acknowledge_market_signals(p_user_id uuid,p_sale_ids uuid[])
returns integer language plpgsql security definer set search_path='' as $$
declare acknowledged integer;
begin
  if p_user_id is null or coalesce(cardinality(p_sale_ids),0)=0 then return 0; end if;
  update public.market_sales set seller_seen_at=coalesce(seller_seen_at,now())
   where seller_id=p_user_id and seller_seen_at is null and id=any(p_sale_ids);
  get diagnostics acknowledged=row_count;
  return acknowledged;
end $$;

revoke all on function public.expire_market_listings(integer) from public,anon,authenticated;
revoke all on function public.acknowledge_market_signals(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.expire_market_listings(integer) to service_role;
grant execute on function public.acknowledge_market_signals(uuid,uuid[]) to service_role;

commit;


-- SOURCE: supabase/warden-schedule-build96.sql
-- Build 96: recurring Global Warden schedule.
-- Weekly window: Friday 18:00 UTC through Sunday 18:00 UTC.
-- The function is called by the server API, serializes schedule creation and
-- always prepares the next event before the current one closes.

begin;

create unique index if not exists boss_events_starts_at_unique_idx
  on public.boss_events(starts_at);

create or replace function public.ensure_boss_event_schedule()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_start timestamptz;
  scheduled_event_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('crown-lizard-global-warden-schedule-v1'));

  update public.boss_events
     set status = case when current_hp <= 0 then 'victory' else 'failed' end,
         updated_at = now()
   where status = 'active'
     and (current_hp <= 0 or ends_at <= now());

  update public.boss_events
     set status = 'failed', updated_at = now()
   where status = 'scheduled' and ends_at <= now();

  update public.boss_events
     set status = 'active', updated_at = now()
   where status = 'scheduled'
     and starts_at <= now()
     and ends_at > now();

  select id into scheduled_event_id
    from public.boss_events
   where status = 'scheduled' and starts_at > now()
   order by starts_at asc
   limit 1;

  if scheduled_event_id is null then
    next_start := (
      date_trunc('week', now() at time zone 'UTC') + interval '4 days 18 hours'
    ) at time zone 'UTC';
    if next_start <= now() then next_start := next_start + interval '7 days'; end if;

    insert into public.boss_events
      (slug, name, status, starts_at, ends_at, max_hp, current_hp, trial_blueprint_id, balance_version, config)
    values
      (
        'sovereign-engine-' || to_char(next_start at time zone 'UTC', 'YYYYMMDDHH24'),
        'THE SOVEREIGN ENGINE',
        'scheduled',
        next_start,
        next_start + interval '48 hours',
        68420000,
        68420000,
        'pulse_singularity',
        1,
        jsonb_build_object('durationSeconds', 90, 'phaseSeconds', 30, 'schedule', 'weekly-friday-1800-utc')
      )
    on conflict (slug) do nothing
    returning id into scheduled_event_id;

    if scheduled_event_id is null then
      select id into scheduled_event_id
        from public.boss_events
       where starts_at = next_start
       limit 1;
    end if;
  end if;

  insert into public.boss_event_reward_catalog
    (event_id, reward_key, reward_type, name, description, damage_threshold, shard_amount, badge_id, badge_name, sort_order)
  values
    (scheduled_event_id, 'first_strike', 'milestone', 'FIRST STRIKE', 'DEAL 1,000 VERIFIED EVENT DAMAGE', 1000, 25, null, null, 10),
    (scheduled_event_id, 'crown_vanguard', 'milestone', 'CROWN VANGUARD', 'DEAL 5,000 VERIFIED EVENT DAMAGE', 5000, 50, null, null, 20),
    (scheduled_event_id, 'wardenbreaker', 'milestone', 'WARDENBREAKER', 'DEAL 15,000 VERIFIED EVENT DAMAGE', 15000, 100, 'wardenbreaker', 'WARDENBREAKER', 30),
    (scheduled_event_id, 'sovereign_slayer', 'global_victory', 'SOVEREIGN SLAYER', 'QUALIFY WITH 1,000 DAMAGE AND DEFEAT THE GLOBAL WARDEN', 1000, 150, 'sovereign_slayer', 'SOVEREIGN SLAYER', 40)
  on conflict (event_id, reward_key) do nothing;

  return true;
end;
$$;

revoke all on function public.ensure_boss_event_schedule() from public, anon, authenticated;
grant execute on function public.ensure_boss_event_schedule() to service_role;

select public.ensure_boss_event_schedule();

commit;


-- SOURCE: supabase/security-hardening-build99.sql
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

