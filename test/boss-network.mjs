import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BossNetwork } from '../src/boss-network.js';
import { bossAttemptMultiplier, validateBossSettlementPayload } from '../functions/api/[[path]].js';

const network = new BossNetwork({ preview: true, playerName: () => 'TEST_PILOT' });
const first = await network.getEvent();
assert.equal(first.event.status, 'active', 'the event entry exposes one active Global Warden');
assert.ok(first.event.currentHp < first.event.maxHp, 'the global HP snapshot is meaningful');

const started = await network.start({
  eventId: first.event.id, blueprintId: 'laser_prism_array', gameVersion: '0.26.0-83', arsenalRank: 5,
});
assert.equal(started.assault.attemptNumber, 1);
assert.equal(started.assault.attemptMultiplier, 1);
const settled = await network.settle({
  assaultId: started.assault.assaultId, requestId: crypto.randomUUID(), elapsedMs: 90_000,
  phaseDamage: [500, 700, 900], outcome: 'timeout', targetsDestroyed: 8,
});
assert.equal(settled.settlement.effectiveDamage, 2100, 'a verified preview strike reduces global HP once');
assert.equal(settled.ranking.player.playerName, 'TEST_PILOT', 'the pilot immediately appears in personal event placement');

const rewardNetwork = new BossNetwork({ preview: true, previewDamage: 5400, previewStatus: 'active' });
const rewardSnapshot = await rewardNetwork.getEvent();
assert.equal(rewardSnapshot.rewards.rewards.filter(reward => reward.claimable).length, 2, 'earned personal milestones become claimable immediately');
assert.equal(rewardSnapshot.rewards.rewards.find(reward => reward.key === 'sovereign_slayer').claimable, false, 'global rewards stay locked before victory');
const rewardClaim = await rewardNetwork.claimReward({ eventId: rewardSnapshot.event.id, rewardKey: 'first_strike' });
assert.equal(rewardClaim.claim.shards, 25);
assert.equal(rewardClaim.rewards.rewards.find(reward => reward.key === 'first_strike').claimed, true, 'claimed rewards become terminal in the UI model');
await assert.rejects(() => rewardNetwork.claimReward({ eventId: rewardSnapshot.event.id, rewardKey: 'first_strike' }), /not claimable/i, 'a reward cannot be claimed twice');
const victoryNetwork = new BossNetwork({ preview: true, previewDamage: 1200, previewStatus: 'victory' });
assert.equal((await victoryNetwork.getEvent()).rewards.rewards.find(reward => reward.key === 'sovereign_slayer').claimable, true, 'qualified pilots unlock the global reward only after victory');

assert.equal(bossAttemptMultiplier(3), 1);
assert.equal(bossAttemptMultiplier(4), .75);
assert.equal(bossAttemptMultiplier(7), .5);
assert.ok(validateBossSettlementPayload({
  assaultId: crypto.randomUUID(), requestId: crypto.randomUUID(), elapsedMs: 90_000,
  phaseDamage: [1, 2, 3], outcome: 'timeout', targetsDestroyed: 0,
}).value, 'a bounded three-phase settlement is accepted');
assert.ok(validateBossSettlementPayload({
  assaultId: crypto.randomUUID(), requestId: crypto.randomUUID(), elapsedMs: 90_001,
  phaseDamage: [1, 2, 3], outcome: 'timeout', targetsDestroyed: 0,
}).error, 'time and telemetry bounds reject an impossible settlement');

const schema = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const api = await readFile(new URL('../functions/api/[[path]].js', import.meta.url), 'utf8');
const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
assert.match(schema, /where id = p_assault_id for update/, 'settlement locks its server-issued assault before mutation');
assert.match(schema, /settlement_request_id uuid unique/, 'settlement request IDs are replay protected');
assert.match(schema, /where id = event_row\.id\s+returning \* into event_row/, 'global HP and victory state update atomically');
assert.match(api, /rpc\/boss_event_leaderboard/, 'ranking is aggregated server-side');
assert.match(schema, /unique \(event_id, user_id, reward_key\)/, 'each server reward has one permanent claim boundary per player');
assert.match(schema, /reward_row\.reward_type = 'global_victory' and event_row\.status <> 'victory'/, 'global victory rewards are enforced inside the database transaction');
assert.match(schema, /'boss-reward:' \|\| p_event_id::text \|\| ':' \|\| p_reward_key/, 'wallet credits carry a deterministic economy ledger identity');
assert.match(await readFile(new URL('../src/boss-network.js', import.meta.url), 'utf8'), /cl:boss-pending-settlement:v1/, 'a dropped connection preserves one idempotent pending settlement');
const debugFlow = main.slice(main.indexOf("if (debugParams.has('assault'))"));
assert.doesNotMatch(debugFlow, /startBossAssault\(\)/, 'the debug URL opens Armory but never auto-starts gameplay');

console.log('Global Warden event network tests passed');
