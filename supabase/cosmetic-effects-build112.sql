-- Crown Lizard Build 112: independent flight-trail and dash-effect cosmetics.
-- Safe to run repeatedly in the Supabase SQL editor.
begin;

alter table public.cosmetic_catalog drop constraint if exists cosmetic_catalog_slot_check;
alter table public.cosmetic_catalog
  add constraint cosmetic_catalog_slot_check
  check (slot in ('ship', 'weapon_laser', 'weapon_tesla', 'weapon_pulse', 'trail', 'dash'));

insert into public.cosmetic_catalog (id, rarity, sort_order, acquisition_source, slot) values
  ('trail_ember_comet', 'uncommon', 310, 'crate', 'trail'),
  ('trail_rift_wake', 'rare', 320, 'crate', 'trail'),
  ('trail_royal_wake', 'royal', 330, 'crate', 'trail'),
  ('trail_verdant_echo', 'mythic', 340, 'crate', 'trail'),
  ('dash_spectral_wings', 'uncommon', 410, 'crate', 'dash'),
  ('dash_phase_slice', 'rare', 420, 'crate', 'dash'),
  ('dash_solar_crown', 'sovereign', 430, 'crate', 'dash')
on conflict (id) do update
  set rarity = excluded.rarity,
      sort_order = excluded.sort_order,
      acquisition_source = excluded.acquisition_source,
      slot = excluded.slot,
      active = true;

create or replace function public.equip_player_cosmetic(p_user_id uuid,p_cosmetic_id text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare slot_name text; slot_key text;
begin
  insert into public.player_wallets(user_id) values(p_user_id) on conflict(user_id) do nothing;
  perform 1 from public.player_wallets where user_id=p_user_id for update;
  if p_cosmetic_id='ship_default' then slot_name:='ship';
  elsif p_cosmetic_id in ('weapon_laser_default','weapon_tesla_default','weapon_pulse_default') then slot_name:=replace(p_cosmetic_id,'_default','');
  elsif p_cosmetic_id in ('trail_default','dash_default') then slot_name:=replace(p_cosmetic_id,'_default','');
  else
    select c.slot into slot_name from public.player_inventory i join public.cosmetic_catalog c on c.id=i.cosmetic_id
      where i.user_id=p_user_id and i.cosmetic_id=p_cosmetic_id and i.market_listing_id is null and c.active;
    if slot_name is null then return false; end if;
  end if;
  if slot_name='ship' then
    update public.player_wallets set equipped_ship=p_cosmetic_id,updated_at=now() where user_id=p_user_id;
  elsif slot_name in ('weapon_laser','weapon_tesla','weapon_pulse','trail','dash') then
    slot_key:=case when slot_name like 'weapon_%' then replace(slot_name,'weapon_','') else slot_name end;
    update public.player_wallets set equipped_weapon_skins=jsonb_set(coalesce(equipped_weapon_skins,'{}'::jsonb),array[slot_key],to_jsonb(p_cosmetic_id),true),updated_at=now() where user_id=p_user_id;
  else return false;
  end if;
  return true;
end;
$$;

revoke all on function public.equip_player_cosmetic(uuid,text) from public,anon,authenticated;
grant execute on function public.equip_player_cosmetic(uuid,text) to service_role;

commit;
