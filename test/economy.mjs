import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { calculateShardReward, ShardWallet, SPONSORED_RULES } from '../src/economy.js';
import { COLLECTION_COSMETICS, CROWN_CRATE_COST, rollTier } from '../src/cosmetics.js';
import { REWARDED_AD_STATUS, SimulatedRewardedAdAdapter } from '../src/rewarded-ad.js';

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

assert.equal(rollTier(() => 0).key, 'uncommon', 'the odds table begins with uncommon');
assert.equal(rollTier(() => .58).key, 'rare', 'rare begins at its published boundary');
assert.equal(rollTier(() => .995).key, 'sovereign', 'sovereign occupies the final half percent');
assert.equal(new Set(COLLECTION_COSMETICS.map(cosmetic => cosmetic.sprite)).size, COLLECTION_COSMETICS.length, 'every ship cosmetic uses a distinct sprite asset');
COLLECTION_COSMETICS.forEach(cosmetic => {
  assert.equal(existsSync(new URL(`../assets/sprites/${cosmetic.sprite}`, import.meta.url)), true, `${cosmetic.name} has a production sprite`);
});
['closed', 'signal', 'open'].forEach(state => {
  assert.equal(existsSync(new URL(`../assets/sprites/crown-crate-${state}-v1.png`, import.meta.url)), true, `the Crown Crate ${state} state has a production sprite`);
});

const vaultStorage = new MemoryStorage();
const vaultWallet = new ShardWallet(vaultStorage);
const funded = vaultWallet.getState();
funded.balance = 600;
vaultWallet.write(funded);

const firstOpen = vaultWallet.openCrate(() => 0);
assert.equal(firstOpen.outcome.cosmeticId, 'ship_verdant_scout', 'a deterministic crate returns the expected chassis');
assert.equal(firstOpen.outcome.duplicate, false, 'the first crate awards a new cosmetic');
assert.equal(firstOpen.balance, 600 - CROWN_CRATE_COST, 'opening a crate deducts its published price');
assert.ok(firstOpen.inventory.cosmetics.ship_verdant_scout, 'new cosmetics are stored in the market-ready inventory');
assert.equal(vaultWallet.equipCosmetic('ship_verdant_scout').inventory.equipped.ship, 'ship_verdant_scout', 'an owned ship cosmetic can be equipped');
assert.throws(() => vaultWallet.equipCosmetic('ship_void_hunter'), error => error.code === 'COSMETIC_LOCKED', 'a locked cosmetic cannot be equipped');
assert.equal(new ShardWallet(vaultStorage).getState().inventory.equipped.ship, 'ship_verdant_scout', 'the equipped ship survives a reload');
assert.equal(vaultWallet.equipCosmetic('ship_default').inventory.equipped.ship, 'ship_default', 'the original Crown Lizard can always be re-equipped');

const duplicateOpen = vaultWallet.openCrate(() => 0);
assert.equal(duplicateOpen.outcome.duplicate, true, 'a repeated cosmetic becomes a duplicate');
assert.equal(duplicateOpen.outcome.salvageValue, 15, 'duplicate salvage follows its rarity tier');
assert.throws(() => vaultWallet.openCrate(() => 0), error => error.code === 'PENDING_REWARD', 'the next crate waits until the duplicate is resolved');
const salvaged = vaultWallet.salvagePending();
assert.equal(salvaged.balance, 600 - CROWN_CRATE_COST * 2 + 15, 'salvage returns the displayed shard amount');
assert.equal(salvaged.vault.pendingReward, null, 'salvage clears the durable pending reward');

const guaranteeStorage = new MemoryStorage();
const guaranteeWallet = new ShardWallet(guaranteeStorage);
const guaranteeState = guaranteeWallet.getState();
guaranteeState.balance = CROWN_CRATE_COST;
guaranteeState.vault.opens = 199;
guaranteeState.vault.sinceSovereign = 199;
guaranteeWallet.write(guaranteeState);
const guaranteed = guaranteeWallet.openCrate(() => 0);
assert.equal(guaranteed.outcome.tier, 'sovereign', 'opening 200 forces the sovereign tier after 199 misses');
assert.equal(guaranteed.outcome.guaranteedSovereign, true, 'the guaranteed reveal is explicitly identified');
assert.equal(guaranteed.vault.sinceSovereign, 0, 'a sovereign resets its guarantee counter');

const poorWallet = new ShardWallet(new MemoryStorage());
assert.throws(() => poorWallet.openCrate(), error => error.code === 'NOT_ENOUGH_SHARDS', 'crates cannot create a negative shard balance');

const sponsoredStorage = new MemoryStorage();
const sponsoredWallet = new ShardWallet(sponsoredStorage);
sponsoredWallet.awardRun('sponsored-run', standardSummary);
assert.equal(sponsoredWallet.getSponsoredOffer('sponsored-run').eligible, true, 'a legitimate long run unlocks one optional sponsored crate');
assert.equal(sponsoredWallet.getPendingSponsoredOffer().runId, 'sponsored-run', 'the optional crate is stored for the Vault');
assert.equal(new ShardWallet(sponsoredStorage).getPendingSponsoredOffer().runId, 'sponsored-run', 'the stored signal survives a page reload');
sponsoredWallet.awardRun('sponsored-run-stacked', standardSummary);
assert.equal(sponsoredWallet.getPendingSponsoredOffer().runId, 'sponsored-run', 'qualified runs cannot stack multiple waiting sponsored crates');
const balanceBeforeSponsoredOpen = sponsoredWallet.getBalance();
const sponsoredOpen = sponsoredWallet.openSponsoredCrate('sponsored-run', () => 0);
assert.equal(sponsoredOpen.balance, balanceBeforeSponsoredOpen, 'a sponsored crate never deducts shards');
assert.equal(sponsoredOpen.outcome.source, 'sponsored', 'the cosmetic records its sponsored acquisition source');
assert.equal(sponsoredWallet.getSponsoredOffer('sponsored-run').claimed, true, 'the same run cannot display another sponsored offer');
assert.equal(sponsoredWallet.getPendingSponsoredOffer(), null, 'claiming the waiting crate clears the Vault signal without releasing older runs');
assert.throws(() => sponsoredWallet.openSponsoredCrate('sponsored-run'), error => error.code === 'RUN_ALREADY_CLAIMED', 'a claimed run cannot mint a second crate');
assert.throws(() => sponsoredWallet.openSponsoredCrate('missing-run'), error => error.code === 'RUN_NOT_ELIGIBLE', 'instant death and invented run ids cannot open sponsored crates');

const cappedWallet = new ShardWallet(new MemoryStorage());
const sponsoredDay = new Date('2026-08-24T12:00:00.000Z');
for (let index = 0; index < SPONSORED_RULES.dailyLimit; index += 1) {
  const runId = `daily-run-${index}`;
  cappedWallet.awardRun(runId, standardSummary);
  cappedWallet.openSponsoredCrate(runId, () => 0, sponsoredDay);
  cappedWallet.salvagePending();
}
cappedWallet.awardRun('daily-run-capped', standardSummary);
assert.equal(cappedWallet.getSponsoredOffer('daily-run-capped', sponsoredDay).reason, 'DAILY_LIMIT_REACHED', 'the daily cap remains enforced across separate runs');

const cancelledAd = new SimulatedRewardedAdAdapter({ durationMs: 20, tickMs: 2 });
const cancelledPromise = cancelledAd.show();
cancelledAd.cancel();
assert.equal((await cancelledPromise).status, REWARDED_AD_STATUS.dismissed, 'cancelling a simulated ad grants nothing');
const completedAd = new SimulatedRewardedAdAdapter({ durationMs: 2, tickMs: 1 });
assert.equal((await completedAd.show()).status, REWARDED_AD_STATUS.granted, 'only a completed simulated ad emits a granted result');

console.log('Shard economy and Crown Vault tests passed:', { normalReward: standardReward.total, balance: reloadedWallet.getBalance() });
