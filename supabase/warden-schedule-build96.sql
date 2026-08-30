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
