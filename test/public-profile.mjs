import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { onRequest } from '../functions/api/[[path]].js';
import { PlayerAccount } from '../src/player-account.js';

const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const worker = readFileSync(new URL('../functions/api/[[path]].js', import.meta.url), 'utf8');

assert.match(schema, /player_profiles[\s\S]*public_id uuid default gen_random_uuid\(\)/, 'public profiles use an identifier separate from auth.users.id');
assert.match(schema, /create or replace function public\.public_player_profile[\s\S]*economy_settled_at is not null/, 'qualified run totals are computed from server-settled runs');
assert.match(schema, /public_player_profile[\s\S]*sum\(contribution\.effective_damage\)/, 'public boss totals use server-approved effective damage');
assert.match(schema, /revoke all on function public\.public_player_profile[\s\S]*grant execute[\s\S]*to service_role/, 'profile aggregation is only callable by the trusted edge API');
assert.match(worker, /publicProfileId:[\s\S]*currentProfile\?\.is_public/, 'leaderboard rows only advertise visible registered profiles');
assert.doesNotMatch(worker.match(/const listScores[\s\S]*?const beginRun/)?.[0] || '', /userId:/, 'public score rows never serialize account ownership IDs');

const publicId = '423e4567-e89b-42d3-a456-426614174000';
const userId = '123e4567-e89b-42d3-a456-426614174000';
const publicProfile = {
  publicId,
  displayName: 'PILOT_ONE',
  joined: '2026-08',
  equippedShip: 'ship_void_hunter',
  arsenalRank: 6,
  stats: {
    bestScores: { arcade: { score: 185406, zone: 8 } },
    highestZone: 8,
    qualifiedRuns: 17,
    bossBestDamage: 42000,
    bossTotalDamage: 123000,
  },
};
const duelHistory = [{ outcome: 'win', score: 4200, rivalScore: 3900, opponent: 'RIVAL', opponentPublicId: publicId, completedAt: '2026-09-01T12:00:00.000Z' }];

const env = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SECRET_KEY: 'server-secret',
  SUPABASE_PUBLISHABLE_KEY: 'browser-publishable',
  SCORE_HASH_SALT: 'public-profile-test-salt',
};
const originalFetch = globalThis.fetch;
let publicRpcResult = publicProfile;
const calls = [];
globalThis.fetch = async (url, options = {}) => {
  const target = String(url);
  calls.push({ target, options });
  if (target.endsWith('/auth/v1/user')) return Response.json({ id: userId, is_anonymous: false, email: 'pilot@example.com' });
  if (target.endsWith('/rest/v1/rpc/public_player_profile')) return Response.json(publicRpcResult);
  if (target.endsWith('/rest/v1/rpc/public_pvp_history')) return Response.json(duelHistory);
  if (target.endsWith('/rest/v1/rpc/set_player_profile_visibility')) return Response.json({ publicId, isPublic: false });
  if (target.includes('/rest/v1/player_profiles?')) return Response.json([{
    user_id: userId, public_id: publicId, is_public: false, display_name: 'PILOT_ONE', rename_count: 0,
    last_renamed_at: null, created_at: '2026-08-01T00:00:00.000Z', updated_at: '2026-08-28T00:00:00.000Z',
  }]);
  throw new Error(`Unexpected fetch: ${target}`);
};

const route = (path, method = 'GET', body, authorized = false) => onRequest({
  request: new Request(`https://crownlizard.com/api/${path}`, {
    method,
    headers: authorized ? { Authorization: 'Bearer header.payload.signature-access', 'Content-Type': 'application/json' } : undefined,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }),
  env,
  params: { path: path.split('/') },
});

const publicResponse = await route(`profiles/${publicId}`);
assert.equal(publicResponse.status, 200);
assert.deepEqual((await publicResponse.json()).profile, { ...publicProfile, duelHistory }, 'the public endpoint returns only server-built pilot card and verified duel history');
assert.deepEqual(JSON.parse(calls.find(call => call.target.endsWith('/rpc/public_player_profile')).options.body), { p_public_id: publicId });

publicRpcResult = null;
const hiddenResponse = await route(`profiles/${publicId}`);
assert.equal(hiddenResponse.status, 404, 'hidden and missing profiles share the same non-enumerating response');

const invalidResponse = await route('profiles/not-an-id');
assert.equal(invalidResponse.status, 404, 'invalid profile identifiers reveal nothing');

const visibilityResponse = await route('player/profile/visibility', 'PUT', { isPublic: false }, true);
assert.equal(visibilityResponse.status, 200);
assert.equal((await visibilityResponse.json()).profile.isPublic, false);
assert.deepEqual(JSON.parse(calls.find(call => call.target.endsWith('/rpc/set_player_profile_visibility')).options.body), { p_user_id: userId, p_is_public: false });

const clientCalls = [];
const client = Object.create(PlayerAccount.prototype);
client.authorizedRequest = async (url, options) => { clientCalls.push({ url, options }); return { profile: { isPublic: false } }; };
assert.equal((await client.setProfileVisibility(false)).profile.isPublic, false);
assert.deepEqual(clientCalls[0], { url: '/api/player/profile/visibility', options: { method: 'PUT', body: JSON.stringify({ isPublic: false }) } });

globalThis.fetch = originalFetch;
console.log('Public pilot profile security and aggregation tests passed');
