import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { legacyWalletPayload, PlayerAccount } from '../src/player-account.js';
import { calculateShardReward } from '../src/economy.js';
import { calculateServerShardReward, onRequest, secureServerInt, validateEconomySummary, validateLegacyWallet } from '../functions/api/[[path]].js';

const localState = {
  balance: 420,
  inventory: {
    cosmetics: {
      ship_verdant_scout: { source: 'crate' },
      ship_void_hunter: { source: 'sponsored' },
    },
    equipped: { ship: 'ship_void_hunter' },
  },
  vault: { opens: 9, sinceSovereign: 7 },
};

const payload = legacyWalletPayload(localState);
assert.deepEqual(payload, {
  balance: 420,
  opens: 9,
  sinceSovereign: 7,
  equippedShip: 'ship_void_hunter',
  cosmetics: ['ship_verdant_scout', 'ship_void_hunter'],
}, 'the legacy bridge only sends the authoritative wallet fields');
assert.deepEqual(validateLegacyWallet(payload).value, payload, 'a valid existing Vault can migrate once');
assert.match(validateLegacyWallet({ ...payload, balance: 50001 }).error, /Invalid legacy wallet/, 'legacy balance is capped during the migration window');
assert.match(validateLegacyWallet({ ...payload, cosmetics: ['ship_fake'] }).error, /Invalid legacy inventory/, 'invented cosmetics cannot enter the server inventory');
assert.match(validateLegacyWallet({ ...payload, equippedShip: 'ship_crown_sovereign' }).error, /Invalid equipped cosmetic/, 'a locked cosmetic cannot be imported as equipped');

const restrictedStorageAccount = new PlayerAccount({
  getItem: () => null,
  setItem: () => { throw new Error('Storage denied'); },
});
assert.doesNotThrow(() => restrictedStorageAccount.saveSession({
  accessToken: 'header.payload.signature-access',
  refreshToken: 'refresh-token-with-enough-entropy',
  expiresIn: 3600,
  player: { id: '123e4567-e89b-42d3-a456-426614174000', anonymous: true },
}), 'restricted mobile storage does not block the in-memory player session');

const expiredSessionStorage = {
  value: JSON.stringify({
    accessToken: 'expired.header.payload.signature',
    refreshToken: 'invalid-refresh-token-with-entropy',
    expiresAt: 1,
    player: { id: 'old-player', anonymous: true },
  }),
  getItem() { return this.value; },
  setItem(key, value) { this.value = value; },
  removeItem() { this.value = null; },
};
const fetchBeforeRecoveryTest = globalThis.fetch;
let recoverySessionRequests = 0;
globalThis.fetch = async url => {
  if (String(url).endsWith('/api/player/refresh')) return Response.json({ error: 'Invalid refresh token.' }, { status: 401 });
  if (String(url).endsWith('/api/player/session')) {
    recoverySessionRequests += 1;
    return Response.json({
      accessToken: 'fresh.header.payload.signature',
      refreshToken: 'fresh-refresh-token-with-entropy',
      expiresIn: 3600,
      player: { id: 'fresh-player', anonymous: true },
    }, { status: 201 });
  }
  throw new Error(`Unexpected recovery test request: ${url}`);
};
const recoveredSession = await new PlayerAccount(expiredSessionStorage).ensureSession();
assert.equal(recoveredSession.player.id, 'fresh-player', 'an invalid stale mobile session is replaced automatically');
assert.equal(recoverySessionRequests, 1, 'session recovery creates exactly one replacement account');
globalThis.fetch = fetchBeforeRecoveryTest;

const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const serverApi = readFileSync(new URL('../functions/api/[[path]].js', import.meta.url), 'utf8');
assert.match(serverApi, /const AUTH_BOOTSTRAP_LIMIT = 60;/, 'anonymous account bootstrap remains rate-limited but tolerates shared mobile and home networks');
for (const table of ['player_wallets', 'player_inventory', 'cosmetic_catalog', 'economy_transactions', 'auth_bootstrap_events']) {
  assert.match(schema, new RegExp(`alter table public\\.${table} enable row level security`), `${table} has RLS enabled`);
  assert.match(schema, new RegExp(`revoke all on table public\\.${table} from anon, authenticated`), `${table} denies direct browser access`);
}
assert.match(schema, /revoke all on function public\.import_legacy_wallet[\s\S]*from public, anon, authenticated/, 'legacy import is service-role only');
assert.match(schema, /for update;[\s\S]*economy_settled_at/, 'run settlement locks the run before marking it settled');
assert.match(schema, /unique \(user_id, external_id\)/, 'the transaction ledger rejects duplicate run payouts');
assert.match(schema, /revoke all on function public\.settle_run_reward[\s\S]*from public, anon, authenticated/, 'run settlement is service-role only');
assert.match(schema, /create or replace function public\.open_crown_crate[\s\S]*for update;/, 'crate opening locks the authoritative wallet');
assert.match(schema, /wallet\.balance < 150/, 'the database enforces the crate price');
assert.match(schema, /wallet\.since_sovereign >= 199/, 'the database enforces Sovereign pity under the wallet lock');
assert.match(schema, /-150 \+ salvage/, 'duplicate salvage and crate cost settle in one transaction');
assert.match(schema, /revoke all on function public\.open_crown_crate[\s\S]*from public, anon, authenticated/, 'crate opening is service-role only');
assert.match(schema, /create or replace function public\.equip_player_ship[\s\S]*join public\.cosmetic_catalog/, 'equip verifies ownership against the server catalog');
assert.match(schema, /revoke all on function public\.equip_player_ship[\s\S]*from public, anon, authenticated/, 'equip is service-role only');
for (let index = 0; index < 32; index += 1) assert.ok(secureServerInt(10_000) >= 0 && secureServerInt(10_000) < 10_000, 'server crate rolls stay inside the published odds range');

const normalRun = { durationMs: 120_000, enemies: 40, zone: 2, wardens: 1 };
assert.deepEqual(calculateServerShardReward(normalRun), calculateShardReward(normalRun), 'server and visible client payout rules match exactly');
const serverRun = { created_at: new Date(Date.now() - 125_000).toISOString() };
assert.ok(validateEconomySummary(normalRun, serverRun).reward, 'a plausible finished run can settle');
assert.match(validateEconomySummary({ ...normalRun, durationMs: 500_000 }, serverRun).error, /timing/, 'reported survival cannot exceed server elapsed time');
assert.match(validateEconomySummary({ ...normalRun, enemies: 5000 }, serverRun).error, /statistics/, 'impossible enemy counts cannot mint shards');

const originalFetch = globalThis.fetch;
const calls = [];
const userId = '123e4567-e89b-42d3-a456-426614174000';
let mockedRunOwner = userId;
let rpcDuplicate = false;
let crateResult = 'opened';
let equipOwned = true;
globalThis.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), options });
  if (String(url).includes('/auth/v1/signup')) return Response.json({
    access_token: 'header.payload.signature-access',
    refresh_token: 'refresh-token-with-enough-entropy',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: userId, is_anonymous: true },
  });
  if (String(url).includes('/auth/v1/user')) return Response.json({ id: userId, is_anonymous: true });
  if (String(url).includes('auth_bootstrap_events?')) return Response.json([]);
  if (String(url).endsWith('/rest/v1/auth_bootstrap_events')) return new Response(null, { status: 201 });
  if (String(url).includes('player_wallets?on_conflict')) return new Response(null, { status: 201 });
  if (String(url).includes('/rest/v1/player_wallets?')) return Response.json([{
    balance: 420, opens: 9, since_sovereign: 7, equipped_ship: 'ship_void_hunter', legacy_imported_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }]);
  if (String(url).includes('/rest/v1/player_inventory?')) return Response.json([
    { cosmetic_id: 'ship_void_hunter', source: 'legacy', acquired_at: new Date().toISOString() },
  ]);
  if (String(url).includes('/rest/v1/leaderboard_runs?')) return Response.json([{
    id: '223e4567-e89b-42d3-a456-426614174000', user_id: mockedRunOwner, created_at: new Date(Date.now() - 125_000).toISOString(), economy_settled_at: rpcDuplicate ? new Date().toISOString() : null,
  }]);
  if (String(url).endsWith('/rest/v1/rpc/settle_run_reward')) return Response.json({
    duplicate: rpcDuplicate, balance: 475, amount: 55, reward: calculateServerShardReward(normalRun),
  });
  if (String(url).endsWith('/rest/v1/rpc/open_crown_crate')) {
    if (crateResult === 'poor') return Response.json({ error: 'NOT_ENOUGH_SHARDS', balance: 20 });
    return Response.json({
      duplicateRequest: crateResult === 'replay',
      balance: 325,
      outcome: {
        openingId: '423e4567-e89b-42d3-a456-426614174000', openingNumber: 10, cosmeticId: 'ship_royal_vanguard', tier: 'royal', duplicate: false, salvageValue: 0, guaranteedSovereign: false, source: 'crate', createdAt: new Date().toISOString(),
      },
    });
  }
  if (String(url).endsWith('/rest/v1/rpc/equip_player_ship')) return Response.json(equipOwned);
  throw new Error(`Unexpected test request: ${url}`);
};

const env = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_server_only',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_browser_safe',
  SCORE_HASH_SALT: 'a-long-test-salt',
};
const sessionResponse = await onRequest({
  request: new Request('https://crownlizard.com/api/player/session', { method: 'POST', headers: { 'CF-Connecting-IP': '203.0.113.7' } }),
  env,
  params: { path: ['player', 'session'] },
});
assert.equal(sessionResponse.status, 201, 'an anonymous Supabase player session can be bootstrapped');
assert.equal((await sessionResponse.json()).player.id, userId, 'the authenticated player id is returned');
const authSignupCall = calls.find(call => call.url.includes('/auth/v1/signup'));
assert.equal(authSignupCall.options.headers.apikey, env.SUPABASE_PUBLISHABLE_KEY, 'Auth uses the publishable key rather than exposing the server secret');
const authSignupIndex = calls.findIndex(call => call.url.includes('/auth/v1/signup'));
const authEventInsertIndex = calls.findIndex(call => call.url.endsWith('/rest/v1/auth_bootstrap_events'));
assert.ok(authSignupIndex < authEventInsertIndex, 'failed signups cannot consume the successful-account rate limit');

const walletResponse = await onRequest({
  request: new Request('https://crownlizard.com/api/player/wallet', { headers: { Authorization: 'Bearer header.payload.signature-access' } }),
  env,
  params: { path: ['player', 'wallet'] },
});
assert.equal(walletResponse.status, 200, 'an authenticated player can read the server wallet');
const walletPayload = await walletResponse.json();
assert.equal(walletPayload.wallet.balance, 420, 'the browser receives the server balance');
assert.equal(walletPayload.wallet.inventory[0].cosmeticId, 'ship_void_hunter', 'the browser receives server-owned inventory only');

const settlementResponse = await onRequest({
  request: new Request('https://crownlizard.com/api/economy/settle', {
    method: 'POST',
    headers: { Authorization: 'Bearer header.payload.signature-access', 'Content-Type': 'application/json' },
    body: JSON.stringify({ runId: '223e4567-e89b-42d3-a456-426614174000', ...normalRun }),
  }),
  env,
  params: { path: ['economy', 'settle'] },
});
assert.equal(settlementResponse.status, 201, 'a verified server run credits the wallet');
const settlement = await settlementResponse.json();
assert.equal(settlement.amount, 55, 'the API uses its server-calculated reward');
const rpcCall = calls.find(call => call.url.endsWith('/rest/v1/rpc/settle_run_reward'));
assert.equal(JSON.parse(rpcCall.options.body).p_amount, 55, 'only the server-calculated amount reaches the atomic database function');

rpcDuplicate = true;
const replayResponse = await onRequest({
  request: new Request('https://crownlizard.com/api/economy/settle', {
    method: 'POST', headers: { Authorization: 'Bearer header.payload.signature-access', 'Content-Type': 'application/json' }, body: JSON.stringify({ runId: '223e4567-e89b-42d3-a456-426614174000', ...normalRun }),
  }),
  env,
  params: { path: ['economy', 'settle'] },
});
assert.equal(replayResponse.status, 200, 'replaying a settled run is idempotent rather than paying again');
assert.equal((await replayResponse.json()).duplicate, true, 'the client is told that the original settlement was reused');

mockedRunOwner = '323e4567-e89b-42d3-a456-426614174000';
const stolenRunResponse = await onRequest({
  request: new Request('https://crownlizard.com/api/economy/settle', {
    method: 'POST', headers: { Authorization: 'Bearer header.payload.signature-access', 'Content-Type': 'application/json' }, body: JSON.stringify({ runId: '223e4567-e89b-42d3-a456-426614174000', ...normalRun }),
  }),
  env,
  params: { path: ['economy', 'settle'] },
});
assert.equal(stolenRunResponse.status, 403, 'one player cannot settle another player\'s run');

mockedRunOwner = userId;
const crateRequestId = '423e4567-e89b-42d3-a456-426614174000';
const crateResponse = await onRequest({
  request: new Request('https://crownlizard.com/api/vault/open', {
    method: 'POST',
    headers: { Authorization: 'Bearer header.payload.signature-access', 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId: crateRequestId, tier: 'sovereign', balance: 999999 }),
  }),
  env,
  params: { path: ['vault', 'open'] },
});
assert.equal(crateResponse.status, 201, 'an authenticated crate request returns one server outcome');
assert.equal((await crateResponse.json()).outcome.tier, 'royal', 'the response uses the server outcome rather than client-supplied tier');
const crateRpcCall = calls.find(call => call.url.endsWith('/rest/v1/rpc/open_crown_crate'));
const crateRpcBody = JSON.parse(crateRpcCall.options.body);
assert.equal(crateRpcBody.p_opening_id, crateRequestId, 'the idempotency key reaches the database');
assert.ok(Number.isInteger(crateRpcBody.p_tier_roll) && crateRpcBody.p_tier_roll >= 0 && crateRpcBody.p_tier_roll < 10_000, 'tier randomness is generated inside Cloudflare');
assert.equal(Object.hasOwn(crateRpcBody, 'tier'), false, 'client tier fields never reach the database function');

crateResult = 'replay';
const crateReplayResponse = await onRequest({
  request: new Request('https://crownlizard.com/api/vault/open', {
    method: 'POST', headers: { Authorization: 'Bearer header.payload.signature-access', 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: crateRequestId }),
  }),
  env,
  params: { path: ['vault', 'open'] },
});
assert.equal(crateReplayResponse.status, 200, 'replaying the request ID returns the stored opening without another debit');

crateResult = 'poor';
const poorCrateResponse = await onRequest({
  request: new Request('https://crownlizard.com/api/vault/open', {
    method: 'POST', headers: { Authorization: 'Bearer header.payload.signature-access', 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: '523e4567-e89b-42d3-a456-426614174000' }),
  }),
  env,
  params: { path: ['vault', 'open'] },
});
assert.equal(poorCrateResponse.status, 409, 'the authoritative wallet blocks crates without enough shards');

const equipResponse = await onRequest({
  request: new Request('https://crownlizard.com/api/vault/equip', {
    method: 'POST', headers: { Authorization: 'Bearer header.payload.signature-access', 'Content-Type': 'application/json' }, body: JSON.stringify({ cosmeticId: 'ship_void_hunter' }),
  }),
  env,
  params: { path: ['vault', 'equip'] },
});
assert.equal(equipResponse.status, 200, 'an owned server cosmetic can be equipped');
equipOwned = false;
const lockedEquipResponse = await onRequest({
  request: new Request('https://crownlizard.com/api/vault/equip', {
    method: 'POST', headers: { Authorization: 'Bearer header.payload.signature-access', 'Content-Type': 'application/json' }, body: JSON.stringify({ cosmeticId: 'ship_crown_sovereign' }),
  }),
  env,
  params: { path: ['vault', 'equip'] },
});
assert.equal(lockedEquipResponse.status, 403, 'a locked cosmetic cannot be equipped by changing the request');
globalThis.fetch = originalFetch;

console.log('Player account and legacy migration test passed');
