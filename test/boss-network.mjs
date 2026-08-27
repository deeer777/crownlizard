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
assert.match(await readFile(new URL('../src/boss-network.js', import.meta.url), 'utf8'), /cl:boss-pending-settlement:v1/, 'a dropped connection preserves one idempotent pending settlement');
const debugFlow = main.slice(main.indexOf("if (debugParams.has('assault'))"));
assert.doesNotMatch(debugFlow, /startBossAssault\(\)/, 'the debug URL opens Armory but never auto-starts gameplay');

console.log('Global Warden event network tests passed');
