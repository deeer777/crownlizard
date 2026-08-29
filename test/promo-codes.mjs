import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateRewardCode, normalizeRewardCode, onRequest, validatePromoCreation } from '../functions/api/[[path]].js';

const migration = readFileSync(new URL('../supabase/promo-codes-build92.sql', import.meta.url), 'utf8');
assert.match(migration, /create table if not exists public\.admin_users[\s\S]*references auth\.users/, 'admin authority is attached to a real Supabase account');
assert.match(migration, /create table if not exists public\.promo_codes[\s\S]*code_hash text not null unique/, 'campaign codes are stored as hashes only');
assert.doesNotMatch(migration, /code_plain|plain_code|raw_code/, 'plaintext campaign codes never enter the database');
assert.match(migration, /unique \(code_id, user_id\)/, 'one account can redeem an MVP campaign only once');
assert.match(migration, /from public\.promo_codes where code_hash = p_code_hash for update/, 'redemption locks the campaign row atomically');
assert.match(migration, /from public\.player_wallets where user_id = p_user_id for update/, 'redemption and crate opening lock the wallet');
assert.match(migration, /free_crate_credits = free_crate_credits \+ promo\.reward_amount/, 'crate rewards mint server-owned opening credits');
assert.match(migration, /free_crate_credits = free_crate_credits - case when uses_free_credit then 1 else 0 end/, 'the normal crate transaction consumes exactly one free credit');
assert.match(migration, /recent_attempts >= 8/, 'valid-looking redemption guesses are rate-limited in the atomic boundary');
for (const table of ['admin_users', 'promo_codes', 'promo_redemptions', 'promo_redemption_attempts', 'admin_audit_log']) {
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`), `${table} has RLS enabled`);
  assert.match(migration, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`), `${table} denies direct browser access`);
}

const codes = new Set(Array.from({ length: 64 }, generateRewardCode));
assert.equal(codes.size, 64, 'secure generated codes do not repeat in a representative batch');
for (const code of codes) assert.match(code, /^CROWN-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/, 'generated codes omit ambiguous characters');
assert.equal(normalizeRewardCode(' crown abcd efgh jkmn '), 'CROWN-ABCD-EFGH-JKMN', 'player input accepts spaces and normalizes to one canonical code');
assert.equal(normalizeRewardCode('CROWN-O000-1111-IIII'), '', 'ambiguous and malformed code alphabets are rejected');

const now = Date.now();
const validCampaign = {
  campaignName: 'Launch crew', rewardType: 'shards', rewardAmount: 250,
  expiresAt: new Date(now + 7 * 86_400_000).toISOString(), maxRedemptions: 500, note: 'Social launch',
};
assert.equal(validatePromoCreation(validCampaign, now).value.campaignName, 'LAUNCH CREW', 'campaign settings are normalized server-side');
assert.ok(validatePromoCreation({ ...validCampaign, rewardAmount: 2501 }, now).error, 'admin cannot exceed the shard hard cap');
assert.ok(validatePromoCreation({ ...validCampaign, rewardType: 'crate_credit', rewardAmount: 6 }, now).error, 'admin cannot exceed the crate-credit hard cap');
assert.ok(validatePromoCreation({ ...validCampaign, expiresAt: new Date(now + 91 * 86_400_000).toISOString() }, now).error, 'campaign lifetime is capped at 90 days');

const originalFetch = globalThis.fetch;
const calls = [];
const adminId = '123e4567-e89b-42d3-a456-426614174000';
const promoId = '223e4567-e89b-42d3-a456-426614174000';
let isAdmin = true;
let redeemResult = { redeemed: true, campaignName: 'LAUNCH CREW', rewardType: 'crate_credit', rewardAmount: 1, balance: 420, freeCrateCredits: 2 };
globalThis.fetch = async (url, options = {}) => {
  const target = String(url);
  calls.push({ target, options });
  if (target.endsWith('/auth/v1/user')) return Response.json({ id: adminId, is_anonymous: false, email: 'owner@example.com' });
  if (target.endsWith('/rest/v1/rpc/is_crown_admin')) return Response.json(isAdmin);
  if (target.endsWith('/rest/v1/rpc/create_reward_code')) return Response.json({
    id: promoId, codeHint: 'CROWN-****-****-ABCD', campaignName: 'LAUNCH CREW', rewardType: 'shards', rewardAmount: 250,
    startsAt: new Date(now).toISOString(), expiresAt: validCampaign.expiresAt, maxRedemptions: 500, redeemedCount: 0, status: 'active', createdAt: new Date(now).toISOString(),
  });
  if (target.includes('/rest/v1/promo_codes?')) return Response.json([{
    id: promoId, code_hint: 'CROWN-****-****-ABCD', campaign_name: 'LAUNCH CREW', reward_type: 'shards', reward_amount: 250,
    starts_at: new Date(now).toISOString(), expires_at: validCampaign.expiresAt, max_redemptions: 500, redeemed_count: 0,
    status: 'active', note: 'Social launch', created_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString(),
  }]);
  if (target.endsWith('/rest/v1/rpc/set_reward_code_status')) return Response.json({ id: promoId, status: 'paused', updatedAt: new Date(now).toISOString() });
  if (target.endsWith('/rest/v1/rpc/redeem_reward_code')) return Response.json(redeemResult);
  if (target.includes('/rest/v1/player_wallets?on_conflict')) return new Response(null, { status: 201 });
  if (target.includes('/rest/v1/player_wallets?')) return Response.json([{
    balance: 420, opens: 4, since_sovereign: 2, free_crate_credits: 2, equipped_ship: 'ship_default', equipped_weapon_skins: {}, updated_at: new Date(now).toISOString(),
  }]);
  if (target.includes('/rest/v1/player_inventory?')) return Response.json([]);
  throw new Error(`Unexpected promo request: ${target}`);
};

const env = {
  SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_server_only',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_browser_safe', SCORE_HASH_SALT: 'a-long-test-salt',
};
const route = (path, method = 'GET', body) => onRequest({
  request: new Request(`https://crownlizard.com/api/${path}`, {
    method,
    headers: { Authorization: 'Bearer header.payload.signature-access', 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.25' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }),
  env,
  params: { path: path.split('/') },
});

const sessionResponse = await route('admin/session');
assert.equal(sessionResponse.status, 200, 'the owner account receives an admin session');
assert.deepEqual(await sessionResponse.json(), { admin: true, role: 'owner' }, 'admin session reveals no email or auth user id');

const createResponse = await route('admin/codes', 'POST', validCampaign);
assert.equal(createResponse.status, 201, 'the owner can create a campaign code');
const createdPayload = await createResponse.json();
assert.match(createdPayload.code, /^CROWN-[A-HJ-NP-Z2-9-]{14}$/, 'the plaintext code is returned exactly once to the owner');
const createCall = calls.find(call => call.target.endsWith('/rest/v1/rpc/create_reward_code'));
const createBody = JSON.parse(createCall.options.body);
assert.match(createBody.p_code_hash, /^[a-f0-9]{64}$/, 'only a SHA-256 code hash reaches Supabase');
assert.equal(createBody.p_code_hint.startsWith('CROWN-****-****-'), true, 'the database receives only a masked display hint');
assert.equal(JSON.stringify(createBody).includes(createdPayload.code), false, 'the plaintext code is never sent into the database');

const listPayload = await (await route('admin/codes')).json();
assert.equal(listPayload.codes[0].codeHint, 'CROWN-****-****-ABCD', 'admin history exposes only the safe code hint');
assert.equal(Object.hasOwn(listPayload.codes[0], 'codeHash'), false, 'admin responses never expose code hashes');

const statusResponse = await route(`admin/codes/${promoId}/status`, 'PUT', { status: 'paused' });
assert.equal(statusResponse.status, 200, 'the owner can pause a campaign without deleting its audit history');

const redeemResponse = await route('player/redeem', 'POST', { code: createdPayload.code });
assert.equal(redeemResponse.status, 201, 'a permanent account can redeem a valid server code');
const redeemPayload = await redeemResponse.json();
assert.equal(redeemPayload.wallet.freeCrateCredits, 2, 'the refreshed wallet exposes server-owned crate credits');
const redeemCall = calls.find(call => call.target.endsWith('/rest/v1/rpc/redeem_reward_code'));
assert.match(JSON.parse(redeemCall.options.body).p_ip_hash, /^[a-f0-9]{64}$/, 'redemption rate limits use a salted IP hash');

redeemResult = { error: 'RATE_LIMITED' };
assert.equal((await route('player/redeem', 'POST', { code: createdPayload.code })).status, 429, 'repeated valid-looking guesses return an explicit cooldown');
isAdmin = false;
assert.equal((await route('admin/codes')).status, 403, 'a normal signed-in account cannot list owner campaigns');

globalThis.fetch = originalFetch;
console.log('Owner campaign code, redemption and free-crate security tests passed');
