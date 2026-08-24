import assert from 'node:assert/strict';
import { calculateShardReward, ShardWallet } from '../src/economy.js';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

const instantDeath = calculateShardReward({ durationMs: 4_000, enemies: 0, zone: 1, wardens: 0 });
assert.equal(instantDeath.qualified, false, 'dying immediately is not a qualified reward run');
assert.equal(instantDeath.total, 0, 'dying immediately awards no shards');
assert.match(instantDeath.reason, /SURVIVE 30 SEC/, 'short runs explain the survival requirement');
assert.match(instantDeath.reason, /DEFEAT 5 ENEMIES/, 'inactive runs explain the enemy requirement');

assert.equal(calculateShardReward({ durationMs: 29_999, enemies: 5, zone: 1, wardens: 0 }).qualified, false, 'enemy kills cannot bypass minimum survival time');
assert.equal(calculateShardReward({ durationMs: 30_000, enemies: 4, zone: 1, wardens: 0 }).qualified, false, 'idling cannot bypass minimum enemy activity');

const shortQualified = calculateShardReward({ durationMs: 60_000, enemies: 10, zone: 1, wardens: 0 });
assert.equal(shortQualified.total, 12, 'a short legitimate run earns a small payout');
assert.equal(shortQualified.sponsoredEligible, false, 'a short reward run does not yet qualify for a sponsored crate');

const standardSummary = { durationMs: 120_000, enemies: 40, zone: 2, wardens: 1 };
const standardReward = calculateShardReward(standardSummary);
assert.deepEqual(standardReward.breakdown, { survival: 16, enemies: 16, zones: 8, wardens: 15 }, 'normal play is rewarded across four visible categories');
assert.equal(standardReward.total, 55, 'a normal first-Warden run lands in the intended payout range');
assert.equal(standardReward.sponsoredEligible, true, 'surviving 90 seconds or defeating a Warden qualifies for the future sponsored crate');

const storage = new MemoryStorage();
const wallet = new ShardWallet(storage);
assert.equal(wallet.getBalance(), 0, 'new local wallets start empty');
assert.equal(wallet.getBalance(), 0, 'starting and abandoning a run cannot change the wallet without an explicit game-over award');

const rejected = wallet.awardRun('run-too-short', { durationMs: 4_000, enemies: 0, zone: 1, wardens: 0 });
assert.equal(rejected.balance, 0, 'unqualified game over records no currency');
const replayedAsValid = wallet.awardRun('run-too-short', standardSummary);
assert.equal(replayedAsValid.duplicate, true, 'a recorded run cannot be resubmitted with better statistics');
assert.equal(replayedAsValid.balance, 0, 'replaying a rejected run cannot mint shards');

const awarded = wallet.awardRun('run-standard', standardSummary);
assert.equal(awarded.balance, 55, 'a qualified run credits its exact reward');
const duplicate = wallet.awardRun('run-standard', standardSummary);
assert.equal(duplicate.duplicate, true, 'the same run id is paid only once');
assert.equal(duplicate.balance, 55, 'duplicate callbacks never double-pay');

const reloadedWallet = new ShardWallet(storage);
assert.equal(reloadedWallet.getBalance(), 55, 'wallet balance survives a page reload');
assert.equal(reloadedWallet.awardRun('run-standard', standardSummary).balance, 55, 'reload cannot replay an already settled run');

console.log('Shard economy test passed:', { normalReward: standardReward.total, balance: reloadedWallet.getBalance() });
