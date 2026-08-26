import assert from 'node:assert/strict';

globalThis.innerWidth = 1280;
globalThis.innerHeight = 720;
globalThis.devicePixelRatio = 1;
globalThis.addEventListener = () => {};

const { Game } = await import('../src/game.js');
const { CONFIG } = await import('../src/config.js');

const canvas = { width: 0, height: 0, style: {}, getContext: () => ({}) };
const input = { movement: () => ({ x: 0, y: 0 }), consumeDash: () => false };
let masteryOffer = null;
let perkOffer = null;
const game = new Game(canvas, input, {
  hud: () => {}, toast: () => {},
  mastery: (weapon, choices) => { masteryOffer = { weapon, choices }; },
  perk: choices => { perkOffer = choices; },
});
game.start('arcade');

assert.equal(Object.keys(CONFIG.weaponMasteries).length, 5, 'all five weapons expose mastery paths');
assert.ok(Object.values(CONFIG.weaponMasteries).every(choices => choices.length === 2), 'every weapon has exactly two final forms');
assert.equal(new Set(Object.values(CONFIG.weaponMasteries).flat().map(choice => choice.key)).size, 10, 'all ten mastery keys are unique');

game.weaponLevels.laser = 5;
assert.equal(game.queueWeaponMastery('laser'), true, 'reaching MK5 queues mastery');
assert.equal(game.queueWeaponMastery('laser'), false, 'the same weapon cannot enter the queue twice');
game.offerWardenReward();
assert.equal(game.awaitingMastery, true, 'the next Warden reward prioritizes pending mastery');
assert.equal(game.active, false, 'gameplay pauses while mastery is chosen');
assert.equal(masteryOffer.weapon.name, 'LASER', 'the offer names the mastered weapon');
assert.deepEqual(masteryOffer.choices.map(choice => choice.key), ['sovereignLance', 'prismArray'], 'Laser offers its two exclusive branches');
assert.equal(game.selectMastery('notARealPath'), false, 'unoffered mastery cannot be injected');
assert.equal(game.selectMastery('sovereignLance'), true, 'an offered mastery can be selected');
assert.equal(game.active, true, 'gameplay resumes after mastery selection');
assert.equal(game.weaponMasteries.laser, 'sovereignLance', 'the selection is permanent for the run');
assert.equal(game.selectMastery('prismArray'), false, 'the opposite path cannot replace a chosen mastery');
game.weapon = 'laser';
assert.equal(game.snapshot().weaponUpgrade, 'SOVEREIGN LANCE', 'HUD displays the final-form name');
assert.equal(game.runSummary().weaponMastery, 'SOVEREIGN LANCE', 'run summary retains the final-form name');

const lance = game.weaponStats('laser');
assert.deepEqual({ count: lance.count, pierce: lance.pierce, focusRamp: lance.focusRamp }, { count: 1, pierce: 4, focusRamp: .08 }, 'Sovereign Lance is a single-target focus weapon');
game.weaponMasteries.laser = 'prismArray';
const prism = game.weaponStats('laser');
assert.deepEqual({ count: prism.count, ricochet: prism.ricochet, chainRange: prism.chainRange }, { count: 3, ricochet: 1, chainRange: 250 }, 'Prism Array refracts three lighter beams');

const expectedProfiles = {
  royalBarrage: stats => stats.count === 4 && stats.ricochet === 1,
  crownrail: stats => stats.count === 1 && stats.pierce === 4,
  haloGuard: stats => stats.count === 7 && stats.rearCount === 7,
  guillotineFan: stats => stats.count === 5 && stats.pierce === 2,
  singularity: stats => stats.count === 1 && stats.explosion === 135,
  cometCores: stats => stats.count === 3 && stats.ricochet === 1,
  sovereignLance: stats => stats.count === 1 && stats.focusRamp === .08,
  prismArray: stats => stats.count === 3 && stats.ricochet === 1,
  stormWeb: stats => stats.branches === 6 && stats.chainRange === 400,
  thunderAnchor: stats => stats.branches === 0 && stats.eliteMultiplier === 1.75,
};
for (const [weaponKey, choices] of Object.entries(CONFIG.weaponMasteries)) {
  game.weaponLevels[weaponKey] = 5;
  for (const choice of choices) {
    game.weaponMasteries[weaponKey] = choice.key;
    assert.ok(expectedProfiles[choice.key](game.weaponStats(weaponKey)), `${choice.name} has its own mechanical identity`);
  }
}

game.weaponMasteries.blaster = '';
game.masteryQueue = [];
game.awaitingMastery = false;
game.offerWardenReward();
assert.equal(perkOffer.length, 3, 'Wardens still offer Crown Powers when no mastery is pending');

console.log('Weapon mastery test passed: 10 exclusive final forms and Warden reward routing verified.');
