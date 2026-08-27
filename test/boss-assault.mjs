import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

globalThis.innerWidth = 390;
globalThis.innerHeight = 844;
globalThis.devicePixelRatio = 3;
globalThis.addEventListener = () => {};

const {
  ASSAULT_DURATION,
  ASSAULT_PHASE_DURATION,
  ASSAULT_PHASES,
  BOSS_BLUEPRINTS,
  assaultPhaseAt,
  assaultDamageBudget,
  assaultResult,
} = await import('../src/boss-assault.js');
const { Game } = await import('../src/game.js');

assert.equal(ASSAULT_DURATION, 90, 'the local Boss Assault lasts exactly 90 seconds');
assert.equal(ASSAULT_PHASE_DURATION, 30, 'each of its three readable phases receives 30 seconds');
assert.equal(assaultPhaseAt(0).key, 'core');
assert.equal(assaultPhaseAt(29.999).key, 'core');
assert.equal(assaultPhaseAt(30).key, 'relay');
assert.equal(assaultPhaseAt(60).key, 'pylon');
assert.equal(assaultPhaseAt(90).key, 'pylon');

const masteryBlueprints = Object.entries(BOSS_BLUEPRINTS).filter(([, blueprint]) => blueprint.masteryKey);
assert.equal(masteryBlueprints.length, 10, 'all ten mastery blueprints can enter the assault');
assert.equal(new Set(masteryBlueprints.map(([, blueprint]) => blueprint.masteryKey)).size, 10, 'no mastery is duplicated or omitted');

const phaseIndex = { core: 0, relay: 1, pylon: 2 };
const totals = [];
const phaseWinners = new Set();
for (const [id, blueprint] of masteryBlueprints) {
  const budget = assaultDamageBudget(blueprint.masteryKey);
  assert.equal(budget.length, 3, `${id} has a complete three-phase damage budget`);
  assert.equal(budget.indexOf(Math.max(...budget)), phaseIndex[blueprint.phase], `${id} peaks only in its declared specialist phase`);
  assert.ok(Math.max(...budget) / Math.min(...budget) >= 1.2, `${id} exposes a meaningful strength and trade-off`);
  totals.push(budget.reduce((sum, value) => sum + value, 0));
  phaseWinners.add(blueprint.phase);
}
assert.equal(phaseWinners.size, 3, 'the roster covers focus, crowd/chain and piercing roles');
assert.ok(Math.max(...totals) / Math.min(...totals) < 2.1, 'no mastery has more than twice the full-assault theoretical budget of another');

assert.deepEqual(assaultResult({ damage: -50, elapsed: 999, phase: 8, targetsDestroyed: 2.9, arsenalRank: 99 }), {
  outcome: 'timeout', damage: 0, phaseDamage: [0, 0, 0], elapsed: 90, phase: 3, targetsDestroyed: 2, blueprintId: 'blaster_standard', arsenalRank: 10,
}, 'results are normalized before they reach the presentation layer');

let assaultSpriteBytes = 0;
for (const asset of ['global-warden-v1.png', 'crown-relay-v1.png', 'shield-pylon-v1.png']) {
  const info = await stat(new URL(`../assets/sprites/${asset}`, import.meta.url));
  assert.ok(info.size > 10_000, `${asset} is a real production sprite rather than a placeholder`);
  assaultSpriteBytes += info.size;
}
assert.ok(assaultSpriteBytes < 500_000, 'the complete assault sprite set stays below 500 KB for mobile delivery');

const gameSource = await readFile(new URL('../src/game.js', import.meta.url), 'utf8');
const indexSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
assert.match(gameSource, /global-warden-v1\.png\?v=82-opt/, 'the optimized boss sprite bypasses the former oversized browser cache entry');
assert.match(gameSource, /Math\.min\(190, this\.arenaWidth \* \.31\)/, 'the Global Warden is capped below its first-pass render size');
assert.ok(indexSource.indexOf('warden-assault-entry') > indexSource.indexOf('armorySelected'), 'the primary assault action follows the selected loadout instead of hiding in the briefing');

const canvas = { width: 0, height: 0, style: {}, getContext: () => ({}) };
const input = { movement: () => ({ x: 0, y: 0 }), consumeDash: () => false };
const observedPhases = [];
let finished = null;
const game = new Game(canvas, input, {
  hud: () => {}, stage: () => {}, cinematic: () => {}, haptic: () => {},
  assaultPhase: phase => observedPhases.push(phase.number),
  assaultover: result => { finished = result; },
});
game.startAssault({
  blueprintId: 'laser_prism_array', weaponKey: 'laser', masteryKey: 'prismArray', arsenalRank: 7, damageBonus: .14,
});
const boss = game.enemies.find(enemy => enemy.assaultBoss);
boss.maxHealth = 1_000_000_000;
boss.health = boss.maxHealth;
for (let frame = 0; frame < 5_700 && game.active; frame += 1) {
  game.player.invulnerable = 10;
  game.update(1 / 60);
}
assert.deepEqual([...new Set(observedPhases)], [1, 2, 3], 'a full simulation enters each phase once in order');
assert.equal(finished?.outcome, 'timeout', 'the full assault reaches a safe result instead of hanging after a transition');
assert.equal(finished?.elapsed, 90, 'cinematic time cannot inflate the recorded assault duration');
assert.equal(finished?.blueprintId, 'laser_prism_array', 'the result preserves the Armory loadout used for the run');
assert.equal(finished?.arsenalRank, 7, 'the result preserves the server-owned Arsenal Rank');
assert.equal(finished?.phaseDamage.length, 3, 'settlement telemetry preserves an independent damage total for all three phases');

console.log('Boss Assault tests passed');
