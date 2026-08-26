import assert from 'node:assert/strict';
import { normalizeCallsign, onRequest, validateCallsign } from '../functions/api/[[path]].js';

assert.equal(normalizeCallsign('  pilot_one  '), 'PILOT_ONE', 'callsigns are normalized once at the server boundary');
assert.equal(validateCallsign('R2D2').value, 'R2D2', 'letters and numbers are valid');
assert.equal(validateCallsign('ACE_ONE').value, 'ACE_ONE', 'an internal underscore is valid');
assert.equal(validateCallsign('_ACE').code, 'INVALID_CALLSIGN', 'callsigns cannot start with an underscore');
assert.equal(validateCallsign('ACE_').code, 'INVALID_CALLSIGN', 'callsigns cannot end with an underscore');
assert.equal(validateCallsign('1234').code, 'INVALID_CALLSIGN', 'a public identity must contain at least one letter');
assert.equal(validateCallsign('ADMIN').code, 'CALLSIGN_BLOCKED', 'reserved authority names cannot be claimed');
assert.equal(validateCallsign('N1GGER').code, 'CALLSIGN_BLOCKED', 'common numeric substitutions cannot bypass moderation');

const originalFetch = globalThis.fetch;
const calls = [];
const userId = '123e4567-e89b-42d3-a456-426614174000';
const env = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SECRET_KEY: 'server-secret',
  SUPABASE_PUBLISHABLE_KEY: 'browser-publishable',
  SCORE_HASH_SALT: 'profile-test-salt',
};
let authUser = { id: userId, is_anonymous: false, email: 'pilot@example.com' };
let profileRows = [];
let claimResult = {
  created: true,
  profile: { userId, displayName: 'PILOT_ONE', renameCount: 0, lastRenamedAt: null },
};
let renameResult = {
  duplicateRequest: false,
  balance: 700,
  cost: 500,
  profile: { userId, displayName: 'PILOT_TWO', renameCount: 1, lastRenamedAt: new Date().toISOString() },
};

globalThis.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), options });
  if (String(url).endsWith('/auth/v1/user')) return Response.json(authUser);
  if (String(url).includes('/rest/v1/player_profiles?')) return Response.json(profileRows);
  if (String(url).endsWith('/rest/v1/rpc/claim_player_callsign')) return Response.json(claimResult);
  if (String(url).endsWith('/rest/v1/rpc/rename_player_callsign')) return Response.json(renameResult);
  throw new Error(`Unexpected fetch: ${url}`);
};

const authorized = { Authorization: 'Bearer header.payload.signature-access', 'Content-Type': 'application/json' };
const route = (path, method = 'GET', body) => onRequest({
  request: new Request(`https://crownlizard.com/api/${path}`, {
    method,
    headers: authorized,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }),
  env,
  params: { path: path.split('/') },
});

profileRows = [{
  user_id: userId,
  display_name: 'PILOT_ONE',
  rename_count: 0,
  last_renamed_at: null,
  created_at: '2026-08-25T12:00:00.000Z',
  updated_at: '2026-08-25T12:00:00.000Z',
}];
const profileResponse = await route('player/profile');
assert.equal(profileResponse.status, 200, 'a permanent account can load its callsign profile');
const profilePayload = await profileResponse.json();
assert.equal(profilePayload.profile.displayName, 'PILOT_ONE');
assert.equal(profilePayload.rules.renameCost, 500, 'the API publishes the server-owned shard cost');
assert.equal(profilePayload.rules.renameCooldownDays, 7, 'the API publishes the server-owned cooldown');

const claimResponse = await route('player/profile/callsign', 'POST', { callsign: ' pilot_one ' });
assert.equal(claimResponse.status, 201, 'the first callsign claim is free and creates the profile');
const claimRpc = calls.find(call => call.url.endsWith('/rest/v1/rpc/claim_player_callsign'));
assert.deepEqual(JSON.parse(claimRpc.options.body), { p_user_id: userId, p_display_name: 'PILOT_ONE' }, 'only the authenticated player and normalized callsign reach the claim RPC');

claimResult = { error: 'CALLSIGN_TAKEN' };
const takenResponse = await route('player/profile/callsign', 'POST', { callsign: 'TAKEN' });
assert.equal(takenResponse.status, 409, 'global name conflicts are explicit without leaking another player');
assert.equal((await takenResponse.json()).code, 'CALLSIGN_TAKEN');

authUser = { id: userId, is_anonymous: true, email: '' };
const guestResponse = await route('player/profile/callsign', 'POST', { callsign: 'GUESTONE' });
assert.equal(guestResponse.status, 403, 'anonymous wallets cannot reserve public callsigns');
authUser = { id: userId, is_anonymous: false, email: 'pilot@example.com' };

const renameId = '223e4567-e89b-42d3-a456-426614174000';
const renameResponse = await route('player/profile/callsign', 'PUT', { callsign: 'pilot_two', requestId: renameId });
assert.equal(renameResponse.status, 201, 'a valid future shard rename reaches the atomic RPC');
const renameRpc = calls.find(call => call.url.endsWith('/rest/v1/rpc/rename_player_callsign'));
assert.deepEqual(JSON.parse(renameRpc.options.body), { p_user_id: userId, p_display_name: 'PILOT_TWO', p_request_id: renameId }, 'rename cost and ownership cannot be supplied by the browser');

renameResult = { error: 'NOT_ENOUGH_SHARDS', balance: 120, cost: 500 };
const poorResponse = await route('player/profile/callsign', 'PUT', { callsign: 'PILOT3', requestId: '323e4567-e89b-42d3-a456-426614174000' });
assert.equal(poorResponse.status, 409, 'the authoritative wallet blocks an unaffordable rename');
assert.deepEqual(await poorResponse.json(), { error: 'Not enough shards.', code: 'NOT_ENOUGH_SHARDS', balance: 120, cost: 500 });

globalThis.fetch = originalFetch;
console.log('Player profile and callsign tests passed');
