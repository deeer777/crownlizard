import assert from 'node:assert/strict';

globalThis.innerWidth = 1280;
globalThis.innerHeight = 720;
globalThis.devicePixelRatio = 1;
globalThis.addEventListener = () => {};

const { Game } = await import('../src/game.js');
const { CONFIG } = await import('../src/config.js');

const canvas = { width: 0, height: 0, style: {}, getContext: () => ({}) };
const input = { movement: () => ({ x: 0, y: 0 }), consumeDash: () => false };
const game = new Game(canvas, input, { hud: () => {} });
game.start('arcade');

assert.deepEqual(CONFIG.weaponProgression.discoveryInterval, [14, 18], 'new weapons are introduced on a readable early cadence');
assert.deepEqual(CONFIG.weaponProgression.upgradeInterval, [27, 35], 'later weapon upgrades require a longer commitment');
assert.ok(CONFIG.weaponProgression.upgradeInterval[0] > CONFIG.weaponProgression.discoveryInterval[1], 'upgrade cadence cannot collapse into discovery cadence');
assert.equal(CONFIG.player.acceleration / CONFIG.player.drag, 1900 / 7.5, 'faster acceleration and braking preserve sustained movement speed');
assert.ok(CONFIG.player.drag >= 9, 'movement reaches and releases its intended speed promptly');

const discoveryGame = new Game(canvas, input, { hud: () => {} });
discoveryGame.start('arcade');
for (let drop = 0; drop < 4; drop += 1) {
  discoveryGame.pickupTimer = 0;
  discoveryGame.updateSpawning(0);
}
const discoveryOrder = discoveryGame.pickups.map(pickup => pickup.weapon);
assert.deepEqual(new Set(discoveryOrder.slice(0, 2)), new Set(['laser', 'tesla']), 'Laser and Tesla are guaranteed to appear in the first two discovery crates');
assert.deepEqual(new Set(discoveryOrder), new Set(['laser', 'tesla', 'spread', 'pulse']), 'missed crates cannot cause repeated discoveries to hide a weapon');

game.weaponLevels.laser = 1;
const laserMk1 = game.weaponStats('laser');
game.weaponLevels.laser = 5;
const laserMk5 = game.weaponStats('laser');
const directDps = stats => stats.count * stats.damage / stats.interval;
const laserGrowth = directDps(laserMk5) / directDps(laserMk1);

assert.ok(laserGrowth >= 2.5 && laserGrowth <= 2.8, `Laser direct DPS grows horizontally (${laserGrowth.toFixed(2)}x), not exponentially`);
assert.equal(laserMk5.count, 2, 'max Laser uses two beams');
assert.equal(laserMk5.pierce, 3, 'max Laser cannot erase six enemies per beam');

const applyPerk = key => {
  game.awaitingPerk = true;
  game.offeredPerks = [key];
  assert.equal(game.selectPerk(key), true, `${key} can be applied in the balance fixture`);
};
for (let stack = 0; stack < 3; stack += 1) applyPerk('overclock');
for (let stack = 0; stack < 3; stack += 1) applyPerk('heavyCrown');
applyPerk('cursedOverdrive');
const extremeLaser = game.weaponStats('laser');

assert.equal(extremeLaser.interval, CONFIG.weapons.laser.minimumInterval, 'stacked fire-rate perks respect the Laser hardware floor');
assert.ok(directDps(extremeLaser) < 31, 'even a seven-Warden damage build remains under the late-run direct DPS ceiling');
for (const key of Object.keys(CONFIG.weapons)) {
  game.weaponLevels[key] = 5;
  game.modifiers.fireRate = .01;
  assert.equal(game.weaponStats(key).interval, CONFIG.weapons[key].minimumInterval, `${key} respects its own fire-rate floor`);
}

const scalingGame = new Game(canvas, input, { hud: () => {} });
scalingGame.start('arcade');
scalingGame.stageIndex = 4;
for (const type of ['chaser', 'shooter', 'tank']) scalingGame.spawnEnemy(type, { elite: null });
const [chaser, shooter, tank] = scalingGame.enemies;
const expectedCycleScale = 1 + 4 * CONFIG.enemyScaling.healthPerStage + CONFIG.enemyScaling.healthPerCycle;
assert.ok(Math.abs(chaser.health - 1.4 * expectedCycleScale) < .001, 'the second world cycle receives the intended health step');

const balancedLaserVolley = laserMk5.count * laserMk5.damage;
assert.equal(Math.ceil(chaser.health / balancedLaserVolley), 2, 'a cycle-two Ripper survives one max-Laser volley');
assert.equal(Math.ceil(shooter.health / balancedLaserVolley), 3, 'a cycle-two Hex Moth takes three max-Laser volleys');
assert.equal(Math.ceil(tank.health / balancedLaserVolley), 7, 'a cycle-two Iron Scarab retains its tank identity');

console.log('Balance test passed:', {
  laserGrowth: Number(laserGrowth.toFixed(2)),
  extremeLaserDps: Number(directDps(extremeLaser).toFixed(2)),
  cycleTwoLaserVolleys: { chaser: 2, shooter: 3, tank: 7 },
});
