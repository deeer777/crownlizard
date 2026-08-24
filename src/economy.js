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

const emptyState = () => ({ version: SHARD_RULES.version, balance: 0, transactions: [] });
const cloneState = state => JSON.parse(JSON.stringify(state));

const normalizeState = value => {
  if (!value || value.version !== SHARD_RULES.version) return emptyState();
  return {
    version: SHARD_RULES.version,
    balance: safeInteger(value.balance),
    transactions: Array.isArray(value.transactions)
      ? value.transactions.filter(transaction => transaction && typeof transaction.runId === 'string').slice(-250)
      : [],
  };
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
}
