import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONFIG } from '../src/config.js';
import {
  armoryTrialWindow,
  arsenalRankForXp,
  onRequest,
  validateArmorySummary,
} from '../functions/api/[[path]].js';
import { armoryAccessLabel, armoryRankProgress, previewArmory, weaponMountUrl } from '../src/armory.js';

const masteryCount = Object.values(CONFIG.weaponMasteries).reduce((total, choices) => total + choices.length, 0);
assert.equal(masteryCount, 10, 'the existing game exposes exactly ten mastery blueprints');
assert.deepEqual([0, 99, 100, 249, 250, 3999, 4000, 999999].map(arsenalRankForXp), [0, 0, 1, 1, 2, 9, 10, 10], 'Arsenal Rank follows the locked 0–10 curve');

const currentRun = { game_version: '0.27.2-86' };
const verified = validateArmorySummary({
  durationMs: 240_000,
  enemies: 80,
  zone: 3,
  wardens: 2,
  crates: 9,
  masteries: [
    { weaponKey: 'blaster', masteryKey: 'royalBarrage' },
    { weaponKey: 'laser', masteryKey: 'sovereignLance' },
  ],
}, currentRun);
assert.deepEqual(verified.blueprintIds, ['blaster_royal_barrage', 'laser_sovereign_lance'], 'verified in-run mastery choices resolve to server catalog ids');
assert.equal(verified.xp, 152, 'Arsenal XP is calculated from bounded verified run statistics');
assert.match(validateArmorySummary({ durationMs: 120_000, enemies: 40, zone: 2, wardens: 1, crates: 2, masteries: [{ weaponKey: 'laser', masteryKey: 'sovereignLance' }] }, currentRun).error, /could not be verified/, 'too few crates cannot unlock a mastery');
assert.match(validateArmorySummary({ durationMs: 60_000, enemies: 40, zone: 1, wardens: 0, crates: 100, masteries: [] }, currentRun).error, /could not be verified/, 'impossible crate counts cannot farm Arsenal XP');
assert.match(validateArmorySummary({ durationMs: 120_000, enemies: 40, zone: 2, wardens: 1, crates: 10, masteries: [{ weaponKey: 'laser', masteryKey: 'madeUp' }] }, currentRun).error, /Invalid mastery/, 'unknown mastery keys are rejected');
assert.match(validateArmorySummary({ durationMs: 120_000, enemies: 40, zone: 2, wardens: 1, crates: 5, masteries: [{ weaponKey: 'laser', masteryKey: 'sovereignLance' }] }, { game_version: '0.22.0-79' }).error, /cannot unlock/, 'pre-Armory builds cannot fabricate blueprint unlocks');
assert.equal(validateArmorySummary({ durationMs: 40_000, enemies: 9, zone: 1, wardens: 0, crates: 0, masteries: [] }, currentRun).xp, 0, 'dying immediately cannot farm Arsenal XP');

assert.deepEqual(armoryRankProgress({ rank: 3, xp: 450 }), { rank: 3, xp: 450, floor: 450, ceiling: 700, percent: 0, remaining: 250 }, 'Armory UI progress begins at the current rank threshold');
assert.equal(armoryRankProgress({ rank: 10, xp: 4000 }).percent, 100, 'maximum Arsenal Rank renders a complete meter');
assert.equal(armoryAccessLabel('trial'), 'WEEKLY TRIAL', 'trial access is explicit in the UI');
assert.equal(weaponMountUrl('tesla'), './assets/weapons/tesla-mount-v1.png', 'blueprint cards use the existing crisp weapon sprites');
assert.equal(previewArmory().blueprints.length, 11, 'local visual testing shows standard plus all ten mastery blueprints');

const trialCatalog = [
  { id: 'one', sortOrder: 10, trialEligible: true },
  { id: 'two', sortOrder: 20, trialEligible: true },
  { id: 'standard', sortOrder: 0, trialEligible: false },
];
const trialOne = armoryTrialWindow(trialCatalog, Date.UTC(2026, 7, 24));
const trialTwo = armoryTrialWindow(trialCatalog, Date.UTC(2026, 7, 31));
assert.notEqual(trialOne.blueprintId, trialTwo.blueprintId, 'the server trial rotates on a stable UTC week boundary');
assert.equal(Date.parse(trialOne.endsAt) - Date.parse(trialOne.startsAt), 7 * 86_400_000, 'each trial window lasts exactly seven days');

const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
assert.match(index, /id="menuWarden"[\s\S]*GLOBAL WARDEN/, 'Global Warden is a full main-menu choice');
assert.match(index, /id="menuWardenState"/, 'the title menu keeps a compact event-state badge');
assert.doesNotMatch(index, /id="menuWardenCountdown"/, 'the exact event countdown stays inside the Warden screen instead of crowding the title menu');
assert.match(index, /id="wardenSchedule"[\s\S]*id="wardenNextDate"[\s\S]*id="wardenNextCountdown"/, 'Crown Armory exposes the next event in local time');
assert.match(index, /id="wardenOverlay"[\s\S]*id="armoryGrid"/, 'the event entry contains the Crown Armory blueprint archive');
assert.match(main, /syncBossServerClock\(payload\.serverTime\)/, 'visible Warden schedule countdowns follow the server clock');
assert.match(main, /state = 'LIVE'[\s\S]*state = claimable \? 'CLAIM' : 'RESULTS'[\s\S]*state = 'NEXT'/, 'the title signal distinguishes active, completed and upcoming events');
assert.match(main, /playerAccount\.getArmory\(\)/, 'the production UI reads Armory state through the authenticated API');
assert.match(main, /playerAccount\.selectArmoryBlueprint\(blueprintId\)/, 'the production UI equips blueprints through the authenticated API');
assert.match(styles, /@media \(max-width: 600px\)[\s\S]*\.armory-grid \{ grid-template-columns: repeat\(2/, 'the mobile Armory uses a sustainable two-column blueprint grid');
assert.match(schema, /create table if not exists public\.weapon_blueprint_catalog/, 'Supabase owns the blueprint catalog');
assert.match(schema, /create table if not exists public\.player_progression[\s\S]*arsenal_rank integer/, 'Supabase owns Arsenal XP and rank');
assert.match(schema, /create table if not exists public\.armory_progression_transactions[\s\S]*run_id uuid not null unique/, 'one run can create only one Armory progression transaction');
assert.match(schema, /economy_settled_at is null then raise exception 'run reward not settled'/, 'Armory progression requires a server-settled run');
assert.match(schema, /revoke all on function public\.settle_armory_progression[\s\S]*from public, anon, authenticated/, 'browsers cannot call the progression writer directly');
assert.match(schema, /grant select on table public\.player_progression to authenticated[\s\S]*auth\.uid\(\)\) = user_id/, 'RLS permits players to read only their own progression');
assert.match(schema, /count\(\*\) \* 60[\s\S]*economy_settled_at is not null/, 'legacy rank backfill uses only previously settled server runs');

const env = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_server_only',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_browser_safe',
  SCORE_HASH_SALT: 'a-long-test-salt',
};
const userId = '123e4567-e89b-42d3-a456-426614174000';
const calls = [];
let selectionLocked = false;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  const target = String(url);
  calls.push({ target, options });
  if (target.includes('/auth/v1/user')) return Response.json({ id: userId, is_anonymous: false });
  if (target.endsWith('/rest/v1/rpc/ensure_player_armory')) return Response.json(true);
  if (target.includes('/rest/v1/player_progression?')) return Response.json([{
    arsenal_xp: 450, arsenal_rank: 3, selected_blueprint_id: 'blaster_standard', backfilled_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }]);
  if (target.includes('/rest/v1/player_weapon_blueprints?')) return Response.json([
    { blueprint_id: 'laser_sovereign_lance', source: 'run', unlocked_run_id: '223e4567-e89b-42d3-a456-426614174000', unlocked_at: new Date().toISOString() },
  ]);
  if (target.includes('/rest/v1/weapon_blueprint_catalog?')) return Response.json([
    { id: 'blaster_standard', weapon_key: 'blaster', mastery_key: null, name: 'STANDARD BLASTER', role: 'RELIABLE ALL-ROUNDER', sort_order: 0, trial_eligible: false, active: true },
    { id: 'laser_sovereign_lance', weapon_key: 'laser', mastery_key: 'sovereignLance', name: 'SOVEREIGN LANCE', role: 'FOCUS DAMAGE', sort_order: 70, trial_eligible: true, active: true },
    { id: 'tesla_storm_web', weapon_key: 'tesla', mastery_key: 'stormWeb', name: 'STORM WEB', role: 'CHAIN CONTROL', sort_order: 90, trial_eligible: true, active: true },
  ]);
  if (target.endsWith('/rest/v1/rpc/select_armory_blueprint')) return Response.json(selectionLocked ? { error: 'BLUEPRINT_LOCKED' } : { selectedBlueprintId: 'laser_sovereign_lance' });
  throw new Error(`Unexpected Armory test request: ${target}`);
};

try {
  const snapshotResponse = await onRequest({
    request: new Request('https://crownlizard.com/api/armory', { headers: { Authorization: 'Bearer access-token' } }),
    env,
    params: { path: ['armory'] },
  });
  assert.equal(snapshotResponse.status, 200, 'an authenticated player can load Crown Armory');
  const snapshot = (await snapshotResponse.json()).armory;
  assert.equal(snapshot.progression.rank, 3, 'the API returns server-owned Arsenal Rank');
  assert.equal(snapshot.progression.damageBonus, 0.06, 'rank bonus is exactly two percent per rank');
  assert.equal(snapshot.blueprints.find(item => item.id === 'laser_sovereign_lance').access, 'unlocked', 'permanent ownership is restored across devices');
  assert.ok(snapshot.trial.blueprintId, 'a new account always receives a server-selected trial option');

  const selectResponse = await onRequest({
    request: new Request('https://crownlizard.com/api/armory/select', {
      method: 'POST', headers: { Authorization: 'Bearer access-token', 'Content-Type': 'application/json' }, body: JSON.stringify({ blueprintId: 'laser_sovereign_lance', userId: 'attacker' }),
    }),
    env,
    params: { path: ['armory', 'select'] },
  });
  assert.equal(selectResponse.status, 200, 'an owned blueprint can be selected');
  const selectCall = calls.find(call => call.target.endsWith('/rest/v1/rpc/select_armory_blueprint'));
  assert.equal(JSON.parse(selectCall.options.body).p_user_id, userId, 'selection is always bound to the authenticated player');

  selectionLocked = true;
  const lockedResponse = await onRequest({
    request: new Request('https://crownlizard.com/api/armory/select', {
      method: 'POST', headers: { Authorization: 'Bearer access-token', 'Content-Type': 'application/json' }, body: JSON.stringify({ blueprintId: 'pulse_singularity' }),
    }),
    env,
    params: { path: ['armory', 'select'] },
  });
  assert.equal(lockedResponse.status, 403, 'request manipulation cannot select a locked blueprint');
} finally {
  globalThis.fetch = originalFetch;
}

console.log('Crown Armory progression, trial, ownership and replay boundaries passed');
