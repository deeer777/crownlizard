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
  legacy_imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.player_inventory (
  user_id uuid not null references auth.users(id) on delete cascade,
  cosmetic_id text not null,
  source text not null check (source in ('crate', 'shop', 'sponsored', 'grant', 'legacy')),
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
