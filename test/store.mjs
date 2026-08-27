import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { STORE_COSMETICS, STORE_PRODUCTS, chooseCosmetic } from '../src/cosmetics.js';
import { ShardWallet } from '../src/economy.js';
import { onRequest } from '../functions/api/[[path]].js';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

assert.equal(STORE_COSMETICS.length, 2, 'Pass 1 launches with two permanent store-exclusive chassis');
assert.equal(STORE_PRODUCTS.filter(product => product.type === 'service').length, 1, 'the callsign change is a separate player service');
STORE_COSMETICS.forEach(cosmetic => {
  assert.deepEqual(cosmetic.source, ['store'], `${cosmetic.name} is explicitly store-only`);
  assert.equal(existsSync(new URL(`../assets/sprites/${cosmetic.sprite}`, import.meta.url)), true, `${cosmetic.name} has a production sprite`);
});
for (const tier of ['uncommon', 'rare', 'royal', 'mythic', 'sovereign']) {
  assert.equal(STORE_COSMETICS.some(item => item.id === chooseCosmetic(tier, () => 0).id), false, `${tier} crate rolls exclude store items`);
}

const wallet = new ShardWallet(new MemoryStorage());
const funded = wallet.getState();
funded.balance = 5000;
wallet.write(funded);
const product = STORE_PRODUCTS.find(item => item.cosmeticId === 'ship_gilded_viper');
const purchase = wallet.purchaseStoreItem(product.sku);
assert.equal(purchase.balance, 5000 - product.price, 'the local preview deducts the published direct-sale price');
assert.equal(purchase.wallet.inventory.cosmetics[product.cosmeticId].source, 'shop', 'a store purchase records its acquisition source');
assert.equal(purchase.wallet.inventory.cosmetics[product.cosmeticId].seenAt, null, 'a direct purchase enters Collection as new');
assert.ok(wallet.markCosmeticSeen(product.cosmeticId).inventory.cosmetics[product.cosmeticId].seenAt, 'opening the Collection item clears NEW durably');
assert.throws(() => wallet.purchaseStoreItem(product.sku), error => error.code === 'ALREADY_OWNED', 'an owned product cannot be purchased twice');

const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
assert.match(schema, /create table if not exists public\.store_catalog[\s\S]*price integer not null/, 'the database owns the store catalog and price');
assert.match(schema, /create or replace function public\.purchase_store_cosmetic[\s\S]*for update;/, 'store purchase locks the authoritative wallet');
assert.match(schema, /wallet\.balance < product\.price[\s\S]*balance = balance - product\.price/, 'the database resolves and deducts its own price');
assert.match(schema, /external_id = 'store:' \|\| p_request_id::text/, 'store retries are idempotent');
assert.match(schema, /acquisition_source = 'crate'/, 'crate queries explicitly exclude direct-sale cosmetics');
assert.match(schema, /acquisition_source = 'store'/, 'store purchases verify the direct-sale acquisition channel');
assert.match(schema, /revoke all on function public\.purchase_store_cosmetic[\s\S]*from public, anon, authenticated/, 'the purchase RPC is service-role only');
assert.match(schema, /create or replace function public\.mark_inventory_seen[\s\S]*seen_at = coalesce\(seen_at, now\(\)\)/, 'the server persists Collection acknowledgement without rewriting acquisition time');
assert.match(schema, /revoke all on function public\.mark_inventory_seen[\s\S]*from public, anon, authenticated/, 'inventory acknowledgement is service-role only');

const env = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_server_only',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_browser_safe',
  SCORE_HASH_SALT: 'a-long-test-salt',
};
const userId = '123e4567-e89b-42d3-a456-426614174000';
const requestId = '923e4567-e89b-42d3-a456-426614174000';
const calls = [];
let rpcMode = 'purchase';
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  const target = String(url);
  calls.push({ url: target, options });
  if (target.includes('/auth/v1/user')) return Response.json({ id: userId, is_anonymous: false, email: 'pilot@example.com' });
  if (target.includes('/rest/v1/store_catalog?')) return Response.json(STORE_PRODUCTS.map(item => ({
    sku: item.sku, product_type: item.type, cosmetic_id: item.cosmeticId, name: item.name,
    description: item.description, price: item.price, rarity: item.rarity, sort_order: item.sortOrder,
    available_from: null, available_until: null,
  })));
  if (target.includes('player_wallets?on_conflict')) return new Response(null, { status: 201 });
  if (target.includes('/rest/v1/player_wallets?')) return Response.json([{
    balance: rpcMode === 'purchase' ? 3750 : 100, opens: 4, since_sovereign: 3,
    equipped_ship: 'ship_default', legacy_imported_at: null, updated_at: new Date().toISOString(),
  }]);
  if (target.includes('/rest/v1/player_inventory?')) return Response.json([]);
  if (target.endsWith('/rest/v1/rpc/purchase_store_cosmetic')) {
    if (rpcMode === 'poor') return Response.json({ error: 'NOT_ENOUGH_SHARDS', balance: 100, cost: product.price });
    if (rpcMode === 'owned') return Response.json({ error: 'ALREADY_OWNED', balance: 3750, cosmeticId: product.cosmeticId });
    return Response.json({
      duplicateRequest: rpcMode === 'replay',
      balance: 3750,
      purchase: { sku: product.sku, cosmeticId: product.cosmeticId, price: product.price },
    });
  }
  if (target.endsWith('/rest/v1/rpc/mark_inventory_seen')) return Response.json(true);
  throw new Error(`Unexpected store test request: ${target}`);
};

try {
  const catalogResponse = await onRequest({
    request: new Request('https://crownlizard.com/api/vault/store', { headers: { Authorization: 'Bearer access-token' } }),
    env,
    params: { path: ['vault', 'store'] },
  });
  assert.equal(catalogResponse.status, 200, 'an authenticated player can load the server catalog');
  assert.equal((await catalogResponse.json()).products.length, 3, 'the server returns the complete Pass 1 catalog');

  const purchaseRequest = () => onRequest({
    request: new Request('https://crownlizard.com/api/vault/store/purchase', {
      method: 'POST',
      headers: { Authorization: 'Bearer access-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku: product.sku, requestId, price: 1, cosmeticId: 'ship_crown_sovereign' }),
    }),
    env,
    params: { path: ['vault', 'store', 'purchase'] },
  });
  const response = await purchaseRequest();
  assert.equal(response.status, 201, 'a new purchase returns created');
  const rpcCall = calls.find(call => call.url.endsWith('/rest/v1/rpc/purchase_store_cosmetic'));
  assert.deepEqual(JSON.parse(rpcCall.options.body), { p_user_id: userId, p_sku: product.sku, p_request_id: requestId }, 'client price and cosmetic tampering never reach the purchase RPC');

  rpcMode = 'replay';
  assert.equal((await purchaseRequest()).status, 200, 'replaying the same purchase request does not debit twice');
  rpcMode = 'poor';
  assert.equal((await purchaseRequest()).status, 409, 'the authoritative wallet rejects insufficient shards');
  rpcMode = 'owned';
  assert.equal((await purchaseRequest()).status, 409, 'the authoritative inventory rejects a second purchase');

  const seenResponse = await onRequest({
    request: new Request('https://crownlizard.com/api/vault/inventory/seen', {
      method: 'POST',
      headers: { Authorization: 'Bearer access-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ cosmeticId: product.cosmeticId, userId: 'attacker' }),
    }),
    env,
    params: { path: ['vault', 'inventory', 'seen'] },
  });
  assert.equal(seenResponse.status, 200, 'an owned cosmetic can be acknowledged');
  const seenCall = calls.find(call => call.url.endsWith('/rest/v1/rpc/mark_inventory_seen'));
  assert.deepEqual(JSON.parse(seenCall.options.body), { p_user_id: userId, p_cosmetic_id: product.cosmeticId }, 'NEW can only be cleared for the authenticated player');
} finally {
  globalThis.fetch = originalFetch;
}

console.log('Crown Store catalog, purchase, isolation and replay tests passed');
