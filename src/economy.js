import {
  COSMETIC_BY_ID,
  COSMETICS,
  CROWN_CRATE_COST,
  STORE_PRODUCTS,
  SOVEREIGN_GUARANTEE,
  TIER_BY_KEY,
  chooseCosmetic,
  rollTier,
  secureRandom,
} from './cosmetics.js?v=20260828-91-weapon-skins4';

export const SHARD_RULES = Object.freeze({
  version: 1,
  minimumDurationSeconds: 30,
  minimumEnemies: 5,
  sponsoredDurationSeconds: 90,
  survivalStepSeconds: 30,
  survivalStepShards: 4,
  survivalCap: 24,
  enemiesPerStep: 5,
  enemyStepShards: 2,
  enemyCap: 30,
  zoneShards: 8,
  zoneCap: 32,
  wardenShards: 15,
  wardenCap: 60,
  maximumRunReward: 150,
});

export const SPONSORED_RULES = Object.freeze({
  dailyLimit: 3,
});

export const SHARD_STORAGE_KEY = 'cl:economy:v1';

const safeInteger = (value, minimum = 0) => Math.max(minimum, Math.floor(Number(value) || 0));

export const calculateShardReward = summary => {
  const durationSeconds = safeInteger((summary?.durationMs || 0) / 1000);
  const enemies = safeInteger(summary?.enemies);
  const zone = safeInteger(summary?.zone, 1);
  const wardens = safeInteger(summary?.wardens);
  const missing = [];
  if (durationSeconds < SHARD_RULES.minimumDurationSeconds) missing.push(`SURVIVE ${SHARD_RULES.minimumDurationSeconds} SEC`);
  if (enemies < SHARD_RULES.minimumEnemies) missing.push(`DEFEAT ${SHARD_RULES.minimumEnemies} ENEMIES`);
  const qualified = missing.length === 0;

  const breakdown = qualified ? {
    survival: Math.min(SHARD_RULES.survivalCap, Math.floor(durationSeconds / SHARD_RULES.survivalStepSeconds) * SHARD_RULES.survivalStepShards),
    enemies: Math.min(SHARD_RULES.enemyCap, Math.floor(enemies / SHARD_RULES.enemiesPerStep) * SHARD_RULES.enemyStepShards),
    zones: Math.min(SHARD_RULES.zoneCap, Math.max(0, zone - 1) * SHARD_RULES.zoneShards),
    wardens: Math.min(SHARD_RULES.wardenCap, wardens * SHARD_RULES.wardenShards),
  } : { survival: 0, enemies: 0, zones: 0, wardens: 0 };

  return {
    qualified,
    sponsoredEligible: qualified && (durationSeconds >= SHARD_RULES.sponsoredDurationSeconds || wardens > 0),
    reason: qualified ? '' : missing.join(' + '),
    durationSeconds,
    breakdown,
    total: qualified ? Math.min(SHARD_RULES.maximumRunReward, Object.values(breakdown).reduce((sum, value) => sum + value, 0)) : 0,
  };
};

const emptyState = () => ({
  version: SHARD_RULES.version,
  balance: 0,
  transactions: [],
  inventory: { cosmetics: {}, equipped: { ship: 'ship_default', weapons: { laser: 'weapon_laser_default', tesla: 'weapon_tesla_default', pulse: 'weapon_pulse_default' } } },
  vault: { opens: 0, sinceSovereign: 0, pendingReward: null },
  sponsored: { pendingRunId: '' },
});
const cloneState = state => JSON.parse(JSON.stringify(state));
const acquisitionSources = new Set(['crate', 'shop', 'sponsored', 'grant', 'market']);

const normalizeOutcome = outcome => {
  if (!outcome || typeof outcome.openingId !== 'string' || !TIER_BY_KEY[outcome.tier]) return null;
  if (!COSMETICS.some(cosmetic => cosmetic.id === outcome.cosmeticId)) return null;
  return {
    openingId: outcome.openingId,
    openingNumber: safeInteger(outcome.openingNumber, 1),
    cosmeticId: outcome.cosmeticId,
    tier: outcome.tier,
    duplicate: Boolean(outcome.duplicate),
    salvageValue: safeInteger(outcome.salvageValue),
    guaranteedSovereign: Boolean(outcome.guaranteedSovereign),
    source: acquisitionSources.has(outcome.source) ? outcome.source : 'crate',
    createdAt: typeof outcome.createdAt === 'string' ? outcome.createdAt : new Date().toISOString(),
  };
};

const normalizeState = value => {
  if (!value || value.version !== SHARD_RULES.version) return emptyState();
  const cosmetics = {};
  if (value.inventory?.cosmetics && typeof value.inventory.cosmetics === 'object') {
    Object.entries(value.inventory.cosmetics).forEach(([id, acquisition]) => {
      if (!COSMETICS.some(cosmetic => cosmetic.id === id)) return;
      cosmetics[id] = {
        acquiredAt: typeof acquisition?.acquiredAt === 'string' ? acquisition.acquiredAt : new Date().toISOString(),
        source: acquisitionSources.has(acquisition?.source) ? acquisition.source : 'crate',
        seenAt: typeof acquisition?.seenAt === 'string' ? acquisition.seenAt : null,
      };
    });
  }
  const requestedShip = typeof value.inventory?.equipped?.ship === 'string' ? value.inventory.equipped.ship : 'ship_default';
  const equippedShip = requestedShip === 'ship_default' || cosmetics[requestedShip] ? requestedShip : 'ship_default';
  const equippedWeapons = Object.fromEntries(['laser', 'tesla', 'pulse'].map(weaponKey => {
    const defaultId = `weapon_${weaponKey}_default`;
    const requestedId = typeof value.inventory?.equipped?.weapons?.[weaponKey] === 'string' ? value.inventory.equipped.weapons[weaponKey] : defaultId;
    const cosmetic = COSMETIC_BY_ID[requestedId];
    return [weaponKey, cosmetic?.slot === `weapon_${weaponKey}` && (requestedId === defaultId || cosmetics[requestedId]) ? requestedId : defaultId];
  }));
  const transactions = Array.isArray(value.transactions)
    ? value.transactions.filter(transaction => transaction && typeof transaction.id === 'string').slice(-250)
    : [];
  const hasSponsoredState = Boolean(value.sponsored && Object.prototype.hasOwnProperty.call(value.sponsored, 'pendingRunId'));
  const requestedPendingRunId = typeof value.sponsored?.pendingRunId === 'string' ? value.sponsored.pendingRunId : '';
  const sponsoredClaimed = runId => transactions.some(transaction => transaction.kind === 'sponsored_crate' && transaction.runId === runId);
  const sponsoredEligible = runId => transactions.some(transaction => transaction.kind === 'run_reward' && transaction.runId === runId && transaction.reward?.sponsoredEligible);
  const latestEligibleRun = [...transactions].reverse().find(transaction => transaction.kind === 'run_reward' && transaction.reward?.sponsoredEligible && !sponsoredClaimed(transaction.runId));
  const pendingRunId = requestedPendingRunId && sponsoredEligible(requestedPendingRunId) && !sponsoredClaimed(requestedPendingRunId)
    ? requestedPendingRunId
    : hasSponsoredState ? '' : latestEligibleRun?.runId || '';
  return {
    version: SHARD_RULES.version,
    balance: safeInteger(value.balance),
    transactions,
    inventory: {
      cosmetics,
      equipped: { ship: equippedShip, weapons: equippedWeapons },
    },
    vault: {
      opens: safeInteger(value.vault?.opens),
      sinceSovereign: Math.min(SOVEREIGN_GUARANTEE - 1, safeInteger(value.vault?.sinceSovereign)),
      pendingReward: normalizeOutcome(value.vault?.pendingReward),
    },
    sponsored: { pendingRunId },
  };
};

const walletError = (code, message) => Object.assign(new Error(message), { code });
const randomItem = (items, random) => items[Math.min(items.length - 1, Math.floor(Math.max(0, Math.min(.999999, Number(random()) || 0)) * items.length))];
const utcDayKey = value => {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

export class ShardWallet {
  constructor(storage = globalThis.localStorage, storageKey = SHARD_STORAGE_KEY) {
    this.storage = storage;
    this.storageKey = storageKey;
    this.memoryState = emptyState();
  }

  read() {
    try {
      const serialized = this.storage?.getItem(this.storageKey);
      if (serialized) this.memoryState = normalizeState(JSON.parse(serialized));
    } catch {}
    return cloneState(this.memoryState);
  }

  write(state) {
    this.memoryState = normalizeState(state);
    try { this.storage?.setItem(this.storageKey, JSON.stringify(this.memoryState)); } catch {}
    return cloneState(this.memoryState);
  }

  getBalance() { return this.read().balance; }
  getState() { return this.read(); }

  equipCosmetic(cosmeticId) {
    if (typeof cosmeticId !== 'string' || !cosmeticId) throw new TypeError('A cosmetic id is required.');
    const state = this.read();
    const cosmetic = COSMETIC_BY_ID[cosmeticId];
    const isDefault = cosmetic?.source?.includes('default');
    if (!isDefault && !state.inventory.cosmetics[cosmeticId]) throw walletError('COSMETIC_LOCKED', 'This cosmetic is not owned.');
    if (!cosmetic) throw walletError('INVALID_COSMETIC', 'This cosmetic cannot be equipped.');
    if (cosmetic.slot === 'ship') state.inventory.equipped.ship = cosmeticId;
    else if (cosmetic.slot.startsWith('weapon_') && cosmetic.weaponKey) state.inventory.equipped.weapons[cosmetic.weaponKey] = cosmeticId;
    else throw walletError('INVALID_COSMETIC', 'This cosmetic cannot be equipped.');
    return this.write(state);
  }

  awardRun(runId, summary) {
    if (typeof runId !== 'string' || !runId) throw new TypeError('A local run id is required.');
    const state = this.read();
    const existing = state.transactions.find(transaction => transaction.runId === runId);
    if (existing) return { reward: existing.reward, balance: state.balance, duplicate: true };

    const reward = calculateShardReward(summary);
    if (reward.qualified) state.balance += reward.total;
    state.transactions.push({
      id: `run:${runId}`,
      runId,
      kind: 'run_reward',
      amount: reward.total,
      createdAt: new Date().toISOString(),
      reward,
    });
    if (reward.sponsoredEligible && !state.sponsored.pendingRunId) state.sponsored.pendingRunId = runId;
    state.transactions = state.transactions.slice(-250);
    const saved = this.write(state);
    return { reward, balance: saved.balance, duplicate: false };
  }

  purchaseStoreItem(sku) {
    const product = STORE_PRODUCTS.find(item => item.sku === sku && item.type === 'cosmetic');
    if (!product) throw walletError('PRODUCT_UNAVAILABLE', 'This store item is unavailable.');
    const state = this.read();
    if (state.inventory.cosmetics[product.cosmeticId]) throw walletError('ALREADY_OWNED', 'This item is already owned.');
    if (state.balance < product.price) throw walletError('NOT_ENOUGH_SHARDS', 'Not enough shards.');
    if (!globalThis.crypto?.randomUUID) throw walletError('SECURE_RANDOM_UNAVAILABLE', 'Secure store identifiers are unavailable.');
    const requestId = globalThis.crypto.randomUUID();
    const acquiredAt = new Date().toISOString();
    state.balance -= product.price;
    state.inventory.cosmetics[product.cosmeticId] = { acquiredAt, source: 'shop', seenAt: null };
    state.transactions.push({
      id: `store:${requestId}`,
      kind: 'store_purchase',
      amount: -product.price,
      createdAt: acquiredAt,
      sku: product.sku,
      cosmeticId: product.cosmeticId,
    });
    state.transactions = state.transactions.slice(-250);
    const saved = this.write(state);
    return {
      duplicateRequest: false,
      balance: saved.balance,
      purchase: { ...product, purchasedAt: acquiredAt },
      wallet: saved,
    };
  }

  previewMarketBuy(cosmeticId, price) {
    const state = this.read();
    const cost = safeInteger(price);
    if (!COSMETIC_BY_ID[cosmeticId] || state.inventory.cosmetics[cosmeticId]) throw walletError('ALREADY_OWNED', 'This item is already owned.');
    if (state.balance < cost) throw walletError('NOT_ENOUGH_SHARDS', 'Not enough shards.');
    state.balance -= cost;
    state.inventory.cosmetics[cosmeticId] = { acquiredAt: new Date().toISOString(), source: 'market', seenAt: null };
    return this.write(state);
  }

  previewMarketList(cosmeticId) {
    const state = this.read();
    const cosmetic = COSMETIC_BY_ID[cosmeticId];
    if (!state.inventory.cosmetics[cosmeticId]) throw walletError('ITEM_NOT_OWNED', 'This item is not owned.');
    if (state.inventory.equipped.ship === cosmeticId || (cosmetic?.weaponKey && state.inventory.equipped.weapons[cosmetic.weaponKey] === cosmeticId)) throw walletError('ITEM_EQUIPPED', 'Unequip this item first.');
    delete state.inventory.cosmetics[cosmeticId];
    return this.write(state);
  }

  previewMarketCancel(cosmeticId) {
    const state = this.read();
    if (!state.inventory.cosmetics[cosmeticId]) state.inventory.cosmetics[cosmeticId] = { acquiredAt: new Date().toISOString(), source: 'crate', seenAt: new Date().toISOString() };
    return this.write(state);
  }

  markCosmeticSeen(cosmeticId) {
    const state = this.read();
    const cosmetic = state.inventory.cosmetics[cosmeticId];
    if (!cosmetic) throw walletError('COSMETIC_LOCKED', 'This cosmetic is not owned.');
    if (!cosmetic.seenAt) cosmetic.seenAt = new Date().toISOString();
    return this.write(state);
  }

  getSponsoredOffer(runId, now = new Date()) {
    const state = this.read();
    const runReward = state.transactions.find(transaction => transaction.kind === 'run_reward' && transaction.runId === runId);
    const claimed = state.transactions.some(transaction => transaction.kind === 'sponsored_crate' && transaction.runId === runId);
    const dayKey = utcDayKey(now);
    const usedToday = state.transactions.filter(transaction => transaction.kind === 'sponsored_crate' && utcDayKey(transaction.createdAt) === dayKey).length;
    const remainingToday = Math.max(0, SPONSORED_RULES.dailyLimit - usedToday);
    let reason = '';
    if (!runReward?.reward?.sponsoredEligible) reason = 'RUN_NOT_ELIGIBLE';
    else if (claimed) reason = 'RUN_ALREADY_CLAIMED';
    else if (remainingToday <= 0) reason = 'DAILY_LIMIT_REACHED';
    else if (state.vault.pendingReward) reason = 'PENDING_REWARD';
    return {
      eligible: !reason,
      runId,
      reason,
      claimed,
      usedToday,
      remainingToday,
      dailyLimit: SPONSORED_RULES.dailyLimit,
    };
  }

  getPendingSponsoredOffer(now = new Date()) {
    const pendingRunId = this.read().sponsored.pendingRunId;
    return pendingRunId ? this.getSponsoredOffer(pendingRunId, now) : null;
  }

  openCrate(random = secureRandom) {
    return this.openCrateWith({ random, cost: CROWN_CRATE_COST, source: 'crate', transactionKind: 'crate_open' });
  }

  openSponsoredCrate(runId, random = secureRandom, now = new Date()) {
    if (typeof runId !== 'string' || !runId) throw new TypeError('A local run id is required.');
    const offer = this.getSponsoredOffer(runId, now);
    if (!offer.eligible) throw walletError(offer.reason, 'This run cannot claim a sponsored crate.');
    const result = this.openCrateWith({ random, cost: 0, source: 'sponsored', transactionKind: 'sponsored_crate', runId, now });
    const state = this.read();
    if (state.sponsored.pendingRunId === runId) {
      state.sponsored.pendingRunId = '';
      this.write(state);
    }
    return { ...result, sponsored: this.read().sponsored };
  }

  openCrateWith({ random = secureRandom, cost, source, transactionKind, runId = '', now = new Date() }) {
    const state = this.read();
    if (state.vault.pendingReward) throw walletError('PENDING_REWARD', 'Salvage the pending duplicate first.');
    if (state.balance < cost) throw walletError('NOT_ENOUGH_SHARDS', 'Not enough shards for a Crown Crate.');

    const guaranteedSovereign = state.vault.sinceSovereign >= SOVEREIGN_GUARANTEE - 1;
    const tier = guaranteedSovereign ? TIER_BY_KEY.sovereign : rollTier(random);
    let cosmetic = chooseCosmetic(tier.key, random);
    if (state.vault.opens === 0 && state.inventory.cosmetics[cosmetic.id]) {
      const sameTier = COSMETICS.filter(item => item.rarity === tier.key && !state.inventory.cosmetics[item.id]);
      const anyUnowned = COSMETICS.filter(item => !state.inventory.cosmetics[item.id]);
      cosmetic = randomItem(sameTier.length ? sameTier : anyUnowned, random) || cosmetic;
    }

    const duplicate = Boolean(state.inventory.cosmetics[cosmetic.id]);
    const openingNumber = state.vault.opens + 1;
    const createdAt = now.toISOString();
    if (!globalThis.crypto?.randomUUID) throw walletError('SECURE_RANDOM_UNAVAILABLE', 'Secure crate opening is unavailable.');
    const openingId = globalThis.crypto.randomUUID();
    const outcome = {
      openingId,
      openingNumber,
      cosmeticId: cosmetic.id,
      tier: tier.key,
      duplicate,
      salvageValue: duplicate ? tier.salvage : 0,
      guaranteedSovereign,
      source,
      createdAt,
    };

    state.balance -= cost;
    state.vault.opens = openingNumber;
    state.vault.sinceSovereign = tier.key === 'sovereign' ? 0 : state.vault.sinceSovereign + 1;
    if (duplicate) state.vault.pendingReward = outcome;
    else state.inventory.cosmetics[cosmetic.id] = { acquiredAt: createdAt, source };
    state.transactions.push({
      id: `${transactionKind}:${openingId}`,
      kind: transactionKind,
      runId: runId || undefined,
      amount: -cost,
      createdAt,
      outcome,
    });
    state.transactions = state.transactions.slice(-250);
    const saved = this.write(state);
    return { outcome, balance: saved.balance, inventory: saved.inventory, vault: saved.vault };
  }

  salvagePending() {
    const state = this.read();
    const outcome = state.vault.pendingReward;
    if (!outcome) return null;
    state.balance += outcome.salvageValue;
    state.vault.pendingReward = null;
    state.transactions.push({
      id: `salvage:${outcome.openingId}`,
      kind: 'duplicate_salvage',
      amount: outcome.salvageValue,
      createdAt: new Date().toISOString(),
      cosmeticId: outcome.cosmeticId,
      openingId: outcome.openingId,
    });
    state.transactions = state.transactions.slice(-250);
    const saved = this.write(state);
    return { outcome, balance: saved.balance, inventory: saved.inventory, vault: saved.vault };
  }
}
