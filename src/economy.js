import {
  COSMETICS,
  CROWN_CRATE_COST,
  SOVEREIGN_GUARANTEE,
  TIER_BY_KEY,
  chooseCosmetic,
  rollTier,
} from './cosmetics.js?v=20260824-44';

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
  inventory: { cosmetics: {}, equipped: { ship: 'ship_default' } },
  vault: { opens: 0, sinceSovereign: 0, pendingReward: null },
});
const cloneState = state => JSON.parse(JSON.stringify(state));
const acquisitionSources = new Set(['crate', 'shop', 'sponsored', 'grant']);

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
      };
    });
  }
  const requestedShip = typeof value.inventory?.equipped?.ship === 'string' ? value.inventory.equipped.ship : 'ship_default';
  const equippedShip = requestedShip === 'ship_default' || cosmetics[requestedShip] ? requestedShip : 'ship_default';
  return {
    version: SHARD_RULES.version,
    balance: safeInteger(value.balance),
    transactions: Array.isArray(value.transactions)
      ? value.transactions.filter(transaction => transaction && typeof transaction.id === 'string').slice(-250)
      : [],
    inventory: {
      cosmetics,
      equipped: { ship: equippedShip },
    },
    vault: {
      opens: safeInteger(value.vault?.opens),
      sinceSovereign: Math.min(SOVEREIGN_GUARANTEE - 1, safeInteger(value.vault?.sinceSovereign)),
      pendingReward: normalizeOutcome(value.vault?.pendingReward),
    },
  };
};

const walletError = (code, message) => Object.assign(new Error(message), { code });
const randomItem = (items, random) => items[Math.min(items.length - 1, Math.floor(Math.max(0, Math.min(.999999, Number(random()) || 0)) * items.length))];

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
    if (cosmeticId !== 'ship_default' && !state.inventory.cosmetics[cosmeticId]) throw walletError('COSMETIC_LOCKED', 'This cosmetic is not owned.');
    const cosmetic = cosmeticId === 'ship_default' ? { slot: 'ship' } : COSMETICS.find(item => item.id === cosmeticId);
    if (!cosmetic || cosmetic.slot !== 'ship') throw walletError('INVALID_COSMETIC', 'This cosmetic cannot be equipped as a ship.');
    state.inventory.equipped.ship = cosmeticId;
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
    state.transactions = state.transactions.slice(-250);
    const saved = this.write(state);
    return { reward, balance: saved.balance, duplicate: false };
  }

  openCrate(random = Math.random) {
    const state = this.read();
    if (state.vault.pendingReward) throw walletError('PENDING_REWARD', 'Salvage the pending duplicate first.');
    if (state.balance < CROWN_CRATE_COST) throw walletError('NOT_ENOUGH_SHARDS', 'Not enough shards for a Crown Crate.');

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
    const createdAt = new Date().toISOString();
    const openingId = globalThis.crypto?.randomUUID?.() || `vault-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const outcome = {
      openingId,
      openingNumber,
      cosmeticId: cosmetic.id,
      tier: tier.key,
      duplicate,
      salvageValue: duplicate ? tier.salvage : 0,
      guaranteedSovereign,
      createdAt,
    };

    state.balance -= CROWN_CRATE_COST;
    state.vault.opens = openingNumber;
    state.vault.sinceSovereign = tier.key === 'sovereign' ? 0 : state.vault.sinceSovereign + 1;
    if (duplicate) state.vault.pendingReward = outcome;
    else state.inventory.cosmetics[cosmetic.id] = { acquiredAt: createdAt, source: 'crate' };
    state.transactions.push({
      id: `crate:${openingId}`,
      kind: 'crate_open',
      amount: -CROWN_CRATE_COST,
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
