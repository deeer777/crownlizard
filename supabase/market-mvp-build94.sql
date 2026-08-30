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
