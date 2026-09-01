import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildDuelWavePlan, DUEL_BLUEPRINTS, DUEL_DURATION_SECONDS } from '../src/duel-match.js';

assert.equal(DUEL_DURATION_SECONDS, 90, 'Crown Duel is a fixed 90-second score race');
assert.equal(DUEL_BLUEPRINTS.length, 6, 'the match server can offer two normalized forms from each weapon role group');
assert.equal(new Set(DUEL_BLUEPRINTS.map(item => item.id)).size, DUEL_BLUEPRINTS.length, 'blueprint ids are unique');
for (const blueprint of DUEL_BLUEPRINTS) {
  assert.match(blueprint.id, /^[a-z0-9_]+$/);
  assert.ok(blueprint.weaponKey && blueprint.masteryKey && blueprint.role);
  assert.ok(blueprint.damageScale > 0 && blueprint.damageScale <= 1, 'normalized damage cannot exceed the base mastery scale');
}

const first = buildDuelWavePlan('0123456789abcdef');
const replay = buildDuelWavePlan('0123456789abcdef');
const rivalSeed = buildDuelWavePlan('fedcba9876543210');
assert.deepEqual(first, replay, 'the same server seed produces byte-identical wave timing and placement');
assert.notDeepEqual(first, rivalSeed, 'a different server seed changes the match pattern');
assert.ok(first.length >= 80, 'the mirrored race has sustained enemy density');
assert.ok(first.every(wave => wave.at >= 0 && wave.at < 90 && wave.xRatio >= 0 && wave.xRatio <= 1), 'all waves stay inside the match time and arena');
assert.ok(new Set(first.map(wave => wave.type)).size >= 4, 'the race exercises several enemy roles');

const gameSource = await readFile(new URL('../src/game.js', import.meta.url), 'utf8');
assert.match(gameSource, /startDuel\([\s\S]*buildDuelWavePlan\(seed\)/, 'the game consumes only the deterministic plan for duel waves');
assert.match(gameSource, /if \(!this\.assault && !this\.duel[\s\S]*type: 'poison'/, 'random endless poison rewards cannot enter a duel');
assert.match(gameSource, /wallElapsed[\s\S]*resumedAfterThrottle/, 'the 90-second clock cannot be extended by pausing or background throttling');

console.log('Crown Duel deterministic wave, normalized blueprint and fixed-clock tests passed.');
