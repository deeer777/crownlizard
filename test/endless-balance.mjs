import assert from 'node:assert/strict';

globalThis.innerWidth = 390;
globalThis.innerHeight = 844;
globalThis.devicePixelRatio = 2;
globalThis.addEventListener = () => {};

const { Game } = await import('../src/game.js');
const { CONFIG } = await import('../src/config.js');

const canvas = { width: 0, height: 0, style: {}, getContext: () => ({}) };
const input = { movement: () => ({ x: 0, y: 0 }), consumeDash: () => false };
const createGame = () => {
  const game = new Game(canvas, input, { hud: () => {}, toast: () => {} });
  game.start('arcade');
  return game;
};

const game = createGame();
assert.deepEqual(game.threatProfile(), {
  completedCycles: 0,
  pressureCap: 4.2,
  enemyCap: 26,
  specialCap: 2,
  eliteBonus: 0,
  formationDelayMin: 15,
  formationDelayMax: 21,
}, 'the learning cycle keeps the established encounter profile');

game.stageIndex = 4;
const cycleTwoProfile = game.threatProfile();
assert.deepEqual(cycleTwoProfile, {
  completedCycles: 1,
  pressureCap: 4.45,
  enemyCap: 29,
  specialCap: 3,
  eliteBonus: .035,
  formationDelayMin: 13.75,
  formationDelayMax: 19.25,
}, 'cycle two adds variety before raw density');

game.stageIndex = 16;
const deepProfile = game.threatProfile();
assert.equal(deepProfile.enemyCap, 35, 'deep endless runs retain a mobile-safe enemy ceiling');
assert.equal(deepProfile.eliteBonus, .14, 'elite growth is capped');
assert.equal(deepProfile.formationDelayMin, 10.5, 'formations never collapse into constant spam');
assert.equal(deepProfile.formationDelayMax, 14.5, 'late formation recovery preserves a readable gap');

game.stageIndex = 0;
game.spawnEnemy('boss');
const firstWarden = game.enemies.at(-1);
assert.equal(firstWarden.health, 64, 'the first Warden remains the known baseline');
game.enemies = [];
game.stageIndex = 4;
game.spawnEnemy('boss');
const cycleTwoWarden = game.enemies.at(-1);
const expectedCycleTwoHealth = 64 * (1 + 4 * CONFIG.enemyScaling.wardenHealthPerStage + CONFIG.enemyScaling.wardenHealthPerCycle);
assert.ok(Math.abs(cycleTwoWarden.health - expectedCycleTwoHealth) < .001, 'later Wardens use explicit stage and cycle scaling');

const formations = createGame();
formations.stageIndex = 4;
formations.spawnFormation('armoredAdvance');
assert.deepEqual(formations.enemies.map(enemy => enemy.type), ['tank', 'tank', 'tank'], 'cycle two can deploy an armored advance');
assert.equal(formations.enemies[1].elite, 'armored', 'the formation has a readable armored anchor');
formations.enemies = [];
formations.spawnFormation('crossfire');
assert.deepEqual(formations.enemies.map(enemy => enemy.type), ['skimmer', 'skimmer', 'shooter'], 'cycle two can combine crossing and aimed fire');
formations.enemies = [];
formations.stageIndex = 8;
formations.spawnFormation('royalEscort');
assert.deepEqual(formations.enemies.map(enemy => enemy.type), ['weaver', 'tank', 'tank'], 'cycle three unlocks the protected royal escort');

const capped = createGame();
capped.stageIndex = 4;
capped.time = CONFIG.stageDuration * 4 + 60;
capped.spawnTimer = 0;
capped.formationTimer = 999;
capped.pickupTimer = 999;
capped.enemies = Array.from({ length: capped.threatProfile().enemyCap }, (_, index) => ({ id: index + 1, type: 'chaser', dead: false }));
capped.updateSpawning(1 / 60);
assert.equal(capped.enemies.length, capped.threatProfile().enemyCap, 'the director does not exceed the active-enemy ceiling');
assert.ok(capped.spawnTimer > 0, 'the director waits briefly before checking a full arena again');

const masteryBalance = createGame();
masteryBalance.weaponLevels.blaster = 5;
masteryBalance.weaponMasteries.blaster = 'royalBarrage';
const barrage = masteryBalance.weaponStats('blaster');
const barrageDirectDps = barrage.count * barrage.damage / barrage.interval;
assert.ok(barrageDirectDps < 21, 'Royal Barrage gains coverage without recreating the old runaway Laser curve');

console.log('Endless balance test passed:', {
  cycleTwoEnemyCap: cycleTwoProfile.enemyCap,
  maximumEnemyCap: deepProfile.enemyCap,
  cycleTwoWardenHealth: Number(cycleTwoWarden.health.toFixed(2)),
  royalBarrageDirectDps: Number(barrageDirectDps.toFixed(2)),
});
