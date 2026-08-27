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
