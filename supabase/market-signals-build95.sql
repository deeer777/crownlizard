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
