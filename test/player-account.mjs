import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { legacyWalletPayload, PlayerAccount } from '../src/player-account.js';
import { calculateShardReward } from '../src/economy.js';
import { calculateServerShardReward, onRequest, secureServerInt, validateEconomySummary, validateLegacyWallet } from '../functions/api/[[path]].js';

const playerAccountSource = readFileSync(new URL('../src/player-account.js', import.meta.url), 'utf8');
assert.match(playerAccountSource, /const REQUEST_TIMEOUT = 20000;/, 'cold mobile Auth receives enough time to return its session');

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

const normalizedSessionAccount = new PlayerAccount({ getItem: () => null, setItem() {} });
normalizedSessionAccount.saveSession({ session: {
  access_token: 'normalized.header.payload.signature-access',
  refresh_token: 'short-refresh',
  expires_in: 3600,
  user: { id: '123e4567-e89b-42d3-a456-426614174000', is_anonymous: false, email: 'pilot@example.com' },
} });
assert.equal(normalizedSessionAccount.getPlayer().email, 'pilot@example.com', 'the client normalizes nested Supabase-style sessions before validating them');
assert.equal(normalizedSessionAccount.session.refreshToken, 'short-refresh', 'opaque Supabase refresh tokens are accepted without an invented minimum length');
assert.equal(normalizedSessionAccount.getAccountState(), 'setup', 'a verified account without completed password setup has one explicit state');

const missingExpiryStorage = {
  value: JSON.stringify({
    accessToken: 'stored.header.payload.signature-access',
    refreshToken: 'stored-refresh-token-with-enough-entropy',
    expiresIn: 3600,
    player: { id: 'stored-player', anonymous: false, email: 'pilot@example.com' },
  }),
  getItem() { return this.value; },
  setItem(key, value) { this.value = value; },
};
const repairedSession = new PlayerAccount(missingExpiryStorage).session;
assert.ok(repairedSession.expiresAt > Math.floor(Date.now() / 1000), 'a stored permanent session missing expiresAt is repaired instead of treated as expired');
assert.ok(JSON.parse(missingExpiryStorage.value).expiresAt, 'the repaired expiry is persisted for the next page load');

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

const expiredPermanentStorage = {
  value: JSON.stringify({
    accessToken: 'expired.permanent.payload.signature',
    refreshToken: 'invalid-permanent-refresh-token-with-entropy',
    expiresAt: 1,
    player: { id: 'permanent-player', anonymous: false, email: 'pilot@example.com' },
  }),
  getItem() { return this.value; },
  setItem(key, value) { this.value = value; },
  removeItem() { this.value = null; },
};
let permanentGuestRequests = 0;
globalThis.fetch = async url => {
  if (String(url).endsWith('/api/player/refresh')) return Response.json({ error: 'Invalid refresh token.' }, { status: 401 });
  if (String(url).endsWith('/api/player/session')) {
    permanentGuestRequests += 1;
    return Response.json({ error: 'A permanent account must not be replaced.' }, { status: 500 });
  }
  throw new Error(`Unexpected permanent recovery request: ${url}`);
};
const expiredPermanentAccount = new PlayerAccount(expiredPermanentStorage);
await assert.rejects(expiredPermanentAccount.ensureSession(), /Sign in again/, 'an expired permanent account asks for sign-in instead of silently becoming a guest');
assert.equal(permanentGuestRequests, 0, 'permanent account recovery never creates an anonymous replacement account');
assert.equal(expiredPermanentAccount.getAccountState(), 'expired', 'an expired permanent identity remains distinguishable from a guest');
assert.ok(expiredPermanentStorage.value, 'the permanent identity is retained so the UI can request sign-in honestly');
globalThis.fetch = fetchBeforeRecoveryTest;

const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const serverApi = readFileSync(new URL('../functions/api/[[path]].js', import.meta.url), 'utf8');
assert.match(serverApi, /const AUTH_BOOTSTRAP_LIMIT = 60;/, 'anonymous account bootstrap remains rate-limited but tolerates shared mobile and home networks');
for (const table of ['player_wallets', 'player_inventory', 'cosmetic_catalog', 'economy_transactions', 'auth_bootstrap_events']) {
  assert.match(schema, new RegExp(`alter table public\\.${table} enable row level security`), `${table} has RLS enabled`);
  assert.match(schema, new RegExp(`revoke all on table public\\.${table} from anon, authenticated`), `${table} denies direct browser access`);
}
for (const table of ['player_profiles', 'blocked_callsign_terms']) {
  assert.match(schema, new RegExp(`alter table public\\.${table} enable row level security`), `${table} has RLS enabled`);
  assert.match(schema, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`), `${table} denies every browser role direct access`);
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
assert.match(schema, /create or replace function public\.claim_player_callsign[\s\S]*exception when unique_violation/, 'initial callsign ownership is claimed atomically');
assert.match(schema, /revoke all on function public\.claim_player_callsign[\s\S]*from public, anon, authenticated/, 'callsign claiming is service-role only');
assert.match(schema, /create or replace function public\.rename_player_callsign[\s\S]*for update;[\s\S]*balance = balance - 500/, 'callsign rename locks and debits the authoritative wallet');
assert.match(schema, /external_id = 'rename:' \|\| p_request_id::text/, 'callsign rename retries are idempotent');
assert.match(schema, /revoke all on function public\.rename_player_callsign[\s\S]*from public, anon, authenticated/, 'callsign renaming is service-role only');
assert.match(schema, /create or replace function public\.equip_player_cosmetic[\s\S]*join public\.cosmetic_catalog/, 'equip verifies cosmetic ownership against the server catalog');
assert.match(schema, /revoke all on function public\.equip_player_cosmetic[\s\S]*from public, anon, authenticated/, 'cosmetic equip is service-role only');
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
let mockedAuthUser = { id: userId, is_anonymous: true, email: '' };
globalThis.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), options });
  if (String(url).endsWith('/api/player/account/logout')) return Response.json({ status: 'signed_out', scope: 'local' });
  if (String(url).endsWith('/api/player/account/login')) return Response.json({
    contract: 'player-session-v1',
    session: {
      access_token: 'client-login.header.payload.signature-access',
      refresh_token: 'live-refresh',
      expires_in: 3600,
      user: { id: userId, is_anonymous: false, email: 'pilot@example.com' },
    },
    wallet: { balance: 420, opens: 9, sinceSovereign: 7, equippedShip: 'ship_void_hunter', inventory: [] },
  });
  if (String(url).endsWith('/api/player/account/confirm')) return Response.json({
    accessToken: 'confirmed.header.payload.signature-access',
    refreshToken: 'confirmed-refresh-token-with-enough-entropy',
    expiresIn: 3600,
    player: { id: userId, anonymous: false, email: 'pilot@example.com' },
  });
  if (String(url).endsWith('/api/player/account/recovery')) return Response.json({ status: 'recovery_requested' }, { status: 202 });
  if (String(url).includes('/auth/v1/signup')) return Response.json({
    access_token: 'header.payload.signature-access',
    refresh_token: 'refresh-token-with-enough-entropy',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: userId, is_anonymous: true },
  });
  if (String(url).includes('/auth/v1/token?grant_type=password')) return Response.json({
    access_token: 'login.header.payload.signature-access',
    refresh_token: 'login-refresh-token-with-enough-entropy',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: userId, is_anonymous: false, email: 'pilot@example.com' },
  });
  if (String(url).includes('/auth/v1/token?grant_type=refresh_token')) return Response.json({
    access_token: 'handoff.header.payload.signature-access',
    refresh_token: 'rotated-refresh-token-with-enough-entropy',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: userId, is_anonymous: false, email: 'pilot@example.com' },
  });
  if (String(url).includes('/auth/v1/verify')) return Response.json({
    access_token: 'confirmed.header.payload.signature-access',
    refresh_token: 'confirmed-refresh-token-with-enough-entropy',
    expires_in: 3600,
    user: { id: userId, is_anonymous: false, email: 'pilot@example.com' },
  });
  if (String(url).includes('/auth/v1/recover')) return Response.json({});
  if (String(url).includes('/auth/v1/logout?scope=local')) return new Response(null, { status: 204 });
  if (String(url).includes('/auth/v1/user')) {
    if (options.method === 'PUT') {
      const body = JSON.parse(options.body || '{}');
      return Response.json({ ...mockedAuthUser, email: body.email || mockedAuthUser.email });
    }
    return Response.json(mockedAuthUser);
  }
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
    id: '223e4567-e89b-42d3-a456-426614174000', user_id: mockedRunOwner, difficulty: 'arcade', game_version: '0.23.0-80', created_at: new Date(Date.now() - 125_000).toISOString(), economy_settled_at: rpcDuplicate ? new Date().toISOString() : null,
  }]);
  if (String(url).endsWith('/rest/v1/rpc/settle_run_reward')) return Response.json({
    duplicate: rpcDuplicate, balance: 475, amount: 55, reward: calculateServerShardReward(normalRun),
  });
  if (String(url).endsWith('/rest/v1/rpc/settle_armory_progression')) return Response.json({
    duplicate: rpcDuplicate, xpAwarded: 72, xp: 172, rank: 1, unlockedBlueprintIds: [],
  });
  if (String(url).endsWith('/rest/v1/rpc/ensure_player_armory')) return Response.json(true);
  if (String(url).includes('/rest/v1/player_progression?')) return Response.json([{
    arsenal_xp: 172, arsenal_rank: 1, selected_blueprint_id: 'blaster_standard', backfilled_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }]);
  if (String(url).includes('/rest/v1/player_weapon_blueprints?')) return Response.json([]);
  if (String(url).includes('/rest/v1/weapon_blueprint_catalog?')) return Response.json([
    { id: 'blaster_standard', weapon_key: 'blaster', mastery_key: null, name: 'STANDARD BLASTER', role: 'RELIABLE ALL-ROUNDER', sort_order: 0, trial_eligible: false, active: true },
    { id: 'laser_sovereign_lance', weapon_key: 'laser', mastery_key: 'sovereignLance', name: 'SOVEREIGN LANCE', role: 'FOCUS DAMAGE', sort_order: 70, trial_eligible: true, active: true },
  ]);
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
  if (String(url).endsWith('/rest/v1/rpc/equip_player_cosmetic')) return Response.json(equipOwned);
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

const logoutResponse = await onRequest({
  request: new Request('https://crownlizard.com/api/player/account/logout', {
    method: 'POST', headers: { Authorization: 'Bearer header.payload.signature-access', 'Content-Type': 'application/json' }, body: '{}',
  }),
  env,
  params: { path: ['player', 'account', 'logout'] },
});
assert.equal(logoutResponse.status, 200, 'a player can end only the current server session');
assert.deepEqual(await logoutResponse.json(), { status: 'signed_out', scope: 'local' }, 'logout reports its device-local scope explicitly');
const supabaseLogoutCall = calls.find(call => call.url.includes('/auth/v1/logout?scope=local'));
assert.equal(supabaseLogoutCall.options.headers.Authorization, 'Bearer header.payload.signature-access', 'the current authenticated session is the only session revoked');

const linkEmailResponse = await onRequest({
  request: new Request('https://crownlizard.com/api/player/account/link-email', {
    method: 'POST', headers: { Authorization: 'Bearer header.payload.signature-access', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'Pilot@Example.com' }),
  }),
  env,
  params: { path: ['player', 'account', 'link-email'] },
});
assert.equal(linkEmailResponse.status, 202, 'an anonymous player can request an email identity link');
const linkEmailCall = calls.find(call => call.url.includes('/auth/v1/user?redirect_to='));
assert.equal(JSON.parse(linkEmailCall.options.body).email, 'pilot@example.com', 'email linking normalizes the address before Supabase Auth');
assert.equal(Object.hasOwn(JSON.parse(linkEmailCall.options.body), 'password'), false, 'the link step never accepts a password before email verification');

const confirmEmailResponse = await onRequest({
  request: new Request('https://crownlizard.com/api/player/account/confirm', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tokenHash: 'valid-token-hash-with-enough-entropy', type: 'email_change' }),
  }),
  env,
  params: { path: ['player', 'account', 'confirm'] },
});
assert.equal(confirmEmailResponse.status, 200, 'the branded callback exchanges the one-time hash for the verified player session');
assert.equal((await confirmEmailResponse.json()).player.id, userId, 'email verification keeps the linked player id');
const verifyCall = calls.find(call => call.url.endsWith('/auth/v1/verify'));
assert.deepEqual(JSON.parse(verifyCall.options.body), { token_hash: 'valid-token-hash-with-enough-entropy', type: 'email_change' }, 'only the one-time verification hash reaches Supabase Auth');

const verifyCountBeforeLanding = calls.filter(call => call.url.endsWith('/auth/v1/verify')).length;
const callbackLandingResponse = await onRequest({
  request: new Request('https://crownlizard.com/api/player/account/callback?token_hash=callback-token-hash-with-enough-entropy&type=recovery'),
  env,
  params: { path: ['player', 'account', 'callback'] },
});
assert.equal(callbackLandingResponse.status, 200, 'the email link opens a same-origin confirmation landing page');
assert.match(await callbackLandingResponse.text(), /CONTINUE TO CREATE PASSWORD/, 'the account landing clearly explains the required user action');
assert.equal(calls.filter(call => call.url.endsWith('/auth/v1/verify')).length, verifyCountBeforeLanding, 'email scanners cannot consume the one-time token with a GET request');
const callbackResponse = await onRequest({
  request: new Request('https://crownlizard.com/api/player/account/callback', {
    method: 'POST',
    body: new URLSearchParams({ token_hash: 'callback-token-hash-with-enough-entropy', type: 'recovery' }),
  }),
  env,
  params: { path: ['player', 'account', 'callback'] },
});
assert.equal(callbackResponse.status, 200, 'the email callback exchanges its one-time token and renders Create Password directly');
const callbackPasswordPage = await callbackResponse.text();
assert.match(callbackPasswordPage, /<h1>CREATE PASSWORD<\/h1>/, 'the protected password form appears without another browser redirect');
assert.match(callbackPasswordPage, /action="\/api\/player\/account\/password\/complete"/, 'the password is submitted to the dedicated same-origin endpoint');
assert.doesNotMatch(callbackPasswordPage, /confirmed-refresh-token/, 'session credentials never appear in the password page HTML');
assert.equal(callbackResponse.headers.get('referrer-policy'), 'no-referrer', 'the callback token cannot leak through the next page referrer');
assert.match(callbackResponse.headers.get('set-cookie'), /__Secure-cl_password_setup=.*Path=\/api\/player\/account\/password\/complete.*HttpOnly.*Secure.*SameSite=Strict/, 'the verified session uses a narrowly scoped protected password cookie');

const callbackPasswordResponse = await onRequest({
  request: new Request('https://crownlizard.com/api/player/account/password/complete', {
    method: 'POST',
    headers: { Cookie: '__Secure-cl_password_setup=confirmed-refresh-token-with-enough-entropy' },
    body: new URLSearchParams({ password: 'correct-horse-crown', confirm_password: 'correct-horse-crown' }),
  }),
  env,
  params: { path: ['player', 'account', 'password', 'complete'] },
});
assert.equal(callbackPasswordResponse.status, 200, 'the server-rendered form saves the password without returning through the game client');
const callbackSavedPage = await callbackPasswordResponse.text();
assert.match(callbackSavedPage, /PASSWORD SAVED/, 'the player receives an unambiguous completion page');
assert.match(callbackSavedPage, /localStorage\.setItem\('cl:player-session:v1'/, 'the verified permanent session replaces the stale guest session before returning to the game');
assert.match(callbackSavedPage, /session\.expiresAt=Number\(session\.expiresAt\)\|\|Math\.floor\(Date\.now\(\)\/1000\)\+session\.expiresIn/, 'the completion boundary guarantees a usable session expiry before returning to the game');
assert.doesNotMatch(callbackSavedPage, /setTimeout\(\(\)=>location\.replace/, 'password completion waits for the player instead of abruptly redirecting them');
assert.match(callbackSavedPage, /href="\/">♛ ENTER CROWN LIZARD/, 'password completion returns through one clear arcade action');
assert.match(callbackPasswordResponse.headers.get('content-security-policy'), /script-src 'nonce-[a-f0-9]+'/, 'the one-time session bootstrap script is protected by a per-response CSP nonce');
assert.match(callbackPasswordResponse.headers.get('set-cookie'), /Max-Age=0/, 'the password setup cookie is cleared immediately after use');
const callbackPasswordCall = calls.findLast(call => call.url.endsWith('/auth/v1/user') && call.options.method === 'PUT');
assert.deepEqual(JSON.parse(callbackPasswordCall.options.body), { password: 'correct-horse-crown' }, 'the direct callback sends only the new password to Supabase Auth');

const recoveryResponse = await onRequest({
  request: new Request('https://crownlizard.com/api/player/account/recovery', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'Pilot@Example.com' }),
  }),
  env,
  params: { path: ['player', 'account', 'recovery'] },
});
assert.equal(recoveryResponse.status, 202, 'password recovery returns the same accepted response for valid account-shaped requests');
const recoveryCall = calls.find(call => call.url.includes('/auth/v1/recover?redirect_to='));
assert.deepEqual(JSON.parse(recoveryCall.options.body), { email: 'pilot@example.com' }, 'recovery normalizes the email and never sends a password');

mockedAuthUser = { id: userId, is_anonymous: false, email: 'pilot@example.com' };
const setPasswordResponse = await onRequest({
  request: new Request('https://crownlizard.com/api/player/account/password', {
    method: 'POST', headers: { Authorization: 'Bearer header.payload.signature-access', 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'correct-horse-crown' }),
  }),
  env,
  params: { path: ['player', 'account', 'password'] },
});
assert.equal(setPasswordResponse.status, 200, 'a verified permanent player can create a password');
const passwordCall = calls.findLast(call => call.url.endsWith('/auth/v1/user') && call.options.method === 'PUT');
assert.deepEqual(JSON.parse(passwordCall.options.body), { password: 'correct-horse-crown' }, 'only Supabase Auth receives the new password');

const loginResponse = await onRequest({
  request: new Request('https://crownlizard.com/api/player/account/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'pilot@example.com', password: 'correct-horse-crown' }),
  }),
  env,
  params: { path: ['player', 'account', 'login'] },
});
assert.equal(loginResponse.status, 200, 'a permanent player can restore a session on another device');
const loginPayload = await loginResponse.json();
assert.equal(loginPayload.contract, 'player-session-v1', 'sign-in returns one versioned browser session contract');
assert.equal(loginPayload.session.player.anonymous, false, 'restored sessions are permanent identities');
assert.equal(loginPayload.session.player.id, userId, 'sign-in returns an explicit normalized session contract');
assert.equal(Object.hasOwn(loginPayload, 'accessToken'), false, 'sign-in does not duplicate session credentials at the response root');
assert.equal(loginPayload.wallet.balance, 420, 'sign-in returns the existing server-owned Vault atomically');
const clientLoginStorage = { value: null, getItem() { return this.value; }, setItem(key, value) { if (key === 'cl:player-session:v1') this.value = value; }, removeItem(key) { if (key === 'cl:player-session:v1') this.value = null; } };
const clientLoginAccount = new PlayerAccount(clientLoginStorage);
const clientLoginPayload = await clientLoginAccount.login('pilot@example.com', 'correct-horse-crown');
assert.equal(clientLoginAccount.getPlayer().id, userId, 'the browser accepts and stores the explicit nested sign-in session');
assert.equal(clientLoginPayload.wallet.balance, 420, 'session normalization preserves the restored server Vault payload');
const clientLogoutResult = await clientLoginAccount.logout();
assert.equal(clientLogoutResult.signedOut, true, 'the browser confirms local logout');
assert.equal(clientLoginAccount.getPlayer(), null, 'logout removes the permanent identity from browser memory');
assert.equal(clientLoginStorage.value, null, 'logout removes the stored player session');

const serverRenderedLoginResponse = await onRequest({
  request: new Request('https://crownlizard.com/api/player/account/login/complete', {
    method: 'POST',
    body: new URLSearchParams({ email: 'Pilot@Example.com', password: 'correct-horse-crown' }),
  }),
  env,
  params: { path: ['player', 'account', 'login', 'complete'] },
});
assert.equal(serverRenderedLoginResponse.status, 200, 'the robust sign-in path bypasses the failing client JSON session boundary');
const serverRenderedLoginPage = await serverRenderedLoginResponse.text();
assert.match(serverRenderedLoginPage, /localStorage\.setItem\('cl:player-session:v1'/, 'the server-rendered sign-in installs the verified session directly');
assert.match(serverRenderedLoginPage, /<h1>SIGNED IN<\/h1>/, 'fallback sign-in uses accurate copy instead of claiming a password was saved');
assert.doesNotMatch(serverRenderedLoginPage, /<h1>PASSWORD SAVED<\/h1>/, 'ordinary sign-in never reuses password-creation feedback');
assert.doesNotMatch(serverRenderedLoginPage, /correct-horse-crown/, 'the submitted password is never echoed into the completion page');
assert.match(serverRenderedLoginResponse.headers.get('content-security-policy'), /script-src 'nonce-[a-f0-9]+'/, 'server-rendered sign-in uses the same nonce-protected session bootstrap');

const bootstrapResponse = await onRequest({
  request: new Request('https://crownlizard.com/api/player/bootstrap', { method: 'POST', headers: { 'CF-Connecting-IP': '203.0.113.8' } }),
  env,
  params: { path: ['player', 'bootstrap'] },
});
assert.equal(bootstrapResponse.status, 201, 'a cold mobile client receives session and wallet atomically');
const bootstrapPayload = await bootstrapResponse.json();
assert.equal(bootstrapPayload.wallet.balance, 420, 'the atomic bootstrap response already contains the server wallet');
assert.equal(bootstrapPayload.accessToken, 'header.payload.signature-access', 'the atomic bootstrap response can bind the next run');

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
const ensureArmoryIndex = calls.findIndex(call => call.url.endsWith('/rest/v1/rpc/ensure_player_armory'));
const settleRewardIndex = calls.findIndex(call => call.url.endsWith('/rest/v1/rpc/settle_run_reward'));
assert.ok(ensureArmoryIndex >= 0 && ensureArmoryIndex < settleRewardIndex, 'historical rank backfill freezes before the current run becomes settled');

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

const redirectStorage = {
  values: new Map(),
  getItem(key) { return this.values.get(key) || null; },
  setItem(key, value) { this.values.set(key, value); },
  removeItem(key) { this.values.delete(key); },
};
const redirectAccount = new PlayerAccount(redirectStorage);
const encodedClaims = Buffer.from(JSON.stringify({ sub: userId, email: 'pilot@example.com', is_anonymous: false })).toString('base64url');
const redirectToken = `header.${encodedClaims}.signature-with-enough-entropy`;
const redirectResult = redirectAccount.consumeAuthRedirect({
  hash: `#access_token=${redirectToken}&refresh_token=verified-refresh-token-with-entropy&expires_in=3600`,
  href: `https://crownlizard.com/?account=verified#access_token=${redirectToken}&refresh_token=verified-refresh-token-with-entropy&expires_in=3600`,
  pathname: '/',
  search: '?account=verified',
}, { replaceState() {} });
assert.equal(redirectResult.verified, true, 'the email verification redirect upgrades the stored browser session');
assert.equal(redirectAccount.getPlayer().id, userId, 'identity linking preserves the anonymous player id and its inventory ownership');
assert.equal(redirectAccount.needsPasswordSetup(), true, 'verified email immediately requires password completion');

const messageStorage = {
  values: new Map(),
  getItem(key) { return this.values.get(key) || null; },
  setItem(key, value) { this.values.set(key, value); },
  removeItem(key) { this.values.delete(key); },
};
const messageAccount = new PlayerAccount(messageStorage);
messageAccount.saveSession({
  accessToken: 'anonymous.header.payload.signature-access',
  refreshToken: 'anonymous-refresh-token-with-entropy',
  player: { id: userId, anonymous: true, email: '' },
});
const messageResult = messageAccount.consumeAuthRedirect({
  hash: '#message=Confirmation+link+accepted',
  href: 'https://crownlizard.com/?account=verified#message=Confirmation+link+accepted',
  pathname: '/',
  search: '?account=verified',
}, { replaceState() {} });
assert.equal(messageResult.confirmed, true, 'a confirmation-only redirect is recognized without exposing tokens');
messageAccount.syncPlayer({ id: userId, anonymous: false, email: 'pilot@example.com' });
assert.equal(messageAccount.needsPasswordSetup(), true, 'the refreshed permanent identity opens password setup after a confirmation-only redirect');

const hashStorage = {
  values: new Map(),
  getItem(key) { return this.values.get(key) || null; },
  setItem(key, value) { this.values.set(key, value); },
  removeItem(key) { this.values.delete(key); },
};
const hashAccount = new PlayerAccount(hashStorage);
hashAccount.redirectResult = hashAccount.consumeAuthRedirect({
  hash: '#account=confirm&token_hash=valid-token-hash-with-enough-entropy&type=email_change',
  href: 'https://crownlizard.com/#account=confirm&token_hash=valid-token-hash-with-enough-entropy&type=email_change',
  pathname: '/',
  search: '',
}, { replaceState() {} });
assert.equal(hashAccount.redirectResult.pending, true, 'the branded email link is recognized without sending its secret hash to the web server');
await hashAccount.completeAuthRedirect();
assert.equal(hashAccount.getPlayer().anonymous, false, 'the browser switches to the verified permanent account before loading its wallet');
assert.equal(hashAccount.needsPasswordSetup(), true, 'the verified callback opens Create Password immediately');
assert.equal((await hashAccount.requestPasswordRecovery('pilot@example.com')).status, 'recovery_requested', 'the account client can request recovery without an active player session');

const recoveryHashAccount = new PlayerAccount(hashStorage);
recoveryHashAccount.redirectResult = recoveryHashAccount.consumeAuthRedirect({
  hash: '#account=confirm&token_hash=recovery-token-hash-with-enough-entropy&type=recovery',
  href: 'https://crownlizard.com/#account=confirm&token_hash=recovery-token-hash-with-enough-entropy&type=recovery',
  pathname: '/',
  search: '',
}, { replaceState() {} });
assert.equal(recoveryHashAccount.redirectResult.type, 'recovery', 'password recovery links use the same safe client-side token exchange');

const signedInResult = recoveryHashAccount.consumeAuthRedirect({
  hash: '',
  href: 'https://crownlizard.com/?account=signed-in',
  pathname: '/',
  search: '?account=signed-in',
}, { replaceState() {} });
assert.equal(signedInResult.sessionReturn, true, 'legacy completion URLs request a session check instead of claiming sign-in succeeded');
assert.equal(signedInResult.signedIn, undefined, 'a URL flag can never masquerade as authenticated account state');

globalThis.fetch = originalFetch;

console.log('Player account and legacy migration test passed');
