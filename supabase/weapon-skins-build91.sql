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
