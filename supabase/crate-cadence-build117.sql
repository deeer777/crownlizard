-- Build 117: make the first paid Crown Crate an explicit onboarding target.
-- The authoritative wallet lock still owns price, pity, inventory and salvage.
begin;

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
  crate_cost integer;
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
    return jsonb_build_object(
      'duplicateRequest', true,
      'balance', existing_tx.balance_after,
      'cost', coalesce((existing_tx.metadata->>'cost')::integer, 0),
      'outcome', existing_tx.metadata->'outcome'
    );
  end if;

  uses_free_credit := wallet.free_crate_credits > 0;
  crate_cost := case when wallet.opens = 0 then 75 else 150 end;
  if not uses_free_credit and wallet.balance < crate_cost then
    return jsonb_build_object(
      'error', 'NOT_ENOUGH_SHARDS',
      'balance', wallet.balance,
      'cost', crate_cost,
      'freeCrateCredits', wallet.free_crate_credits
    );
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
       and not exists (
         select 1 from public.player_inventory owned
          where owned.user_id = p_user_id and owned.cosmetic_id = catalog.id
       );
    if candidate_count > 0 then
      select catalog.id into selected_cosmetic from public.cosmetic_catalog catalog
       where catalog.rarity = selected_tier and catalog.active and catalog.acquisition_source = 'crate'
         and not exists (
           select 1 from public.player_inventory owned
            where owned.user_id = p_user_id and owned.cosmetic_id = catalog.id
         )
       order by catalog.sort_order offset (p_cosmetic_roll % candidate_count) limit 1;
    else
      select count(*) into candidate_count from public.cosmetic_catalog catalog
       where catalog.active and catalog.acquisition_source = 'crate'
         and not exists (
           select 1 from public.player_inventory owned
            where owned.user_id = p_user_id and owned.cosmetic_id = catalog.id
         );
      if candidate_count > 0 then
        select catalog.id into selected_cosmetic from public.cosmetic_catalog catalog
         where catalog.active and catalog.acquisition_source = 'crate'
           and not exists (
             select 1 from public.player_inventory owned
              where owned.user_id = p_user_id and owned.cosmetic_id = catalog.id
           )
         order by catalog.sort_order offset (p_cosmetic_roll % candidate_count) limit 1;
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
  resulting_balance := wallet.balance - case when uses_free_credit then 0 else crate_cost end + salvage;

  if not is_duplicate then
    insert into public.player_inventory (user_id, cosmetic_id, source)
    values (p_user_id, selected_cosmetic, 'crate')
    on conflict (user_id, cosmetic_id) do nothing;
  end if;

  update public.player_wallets
     set balance = resulting_balance,
         free_crate_credits = free_crate_credits - case when uses_free_credit then 1 else 0 end,
         opens = opening_number,
         since_sovereign = case
           when selected_tier = 'sovereign' then 0
           else least(199, wallet.since_sovereign + 1)
         end,
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
    'freeCredit', uses_free_credit,
    'source', 'crate',
    'createdAt', now()
  );

  insert into public.economy_transactions (
    user_id, external_id, kind, amount, balance_after, opening_id, metadata
  ) values (
    p_user_id,
    'crate:' || p_opening_id::text,
    case when uses_free_credit then 'crate_open_free' else 'crate_open' end,
    -(case when uses_free_credit then 0 else crate_cost end) + salvage,
    resulting_balance,
    p_opening_id,
    jsonb_build_object(
      'cost', case when uses_free_credit then 0 else crate_cost end,
      'salvage', salvage,
      'freeCredit', uses_free_credit,
      'outcome', outcome
    )
  );

  return jsonb_build_object(
    'duplicateRequest', false,
    'balance', resulting_balance,
    'cost', case when uses_free_credit then 0 else crate_cost end,
    'freeCrateCredits', wallet.free_crate_credits - case when uses_free_credit then 1 else 0 end,
    'outcome', outcome
  );
end;
$$;

revoke all on function public.open_crown_crate(uuid, uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.open_crown_crate(uuid, uuid, integer, integer) to service_role;

commit;
