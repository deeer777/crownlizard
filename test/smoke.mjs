import assert from 'node:assert/strict';

globalThis.innerWidth = 1280;
globalThis.innerHeight = 720;
globalThis.devicePixelRatio = 2;
globalThis.addEventListener = () => {};

const { Game } = await import('../src/game.js');
const { CONFIG } = await import('../src/config.js');

const canvas = {
  width: 0,
  height: 0,
  style: {},
  getContext: () => ({}),
};
const input = {
  dashQueued: false,
  movement: () => ({ x: 0, y: -1 }),
  consumeDash() { const queued = this.dashQueued; this.dashQueued = false; return queued; },
};
let perkChoices = [];
const events = { hud: () => {}, toast: () => {}, combo: () => {}, gameover: () => {}, perk: choices => { perkChoices = choices; } };
const game = new Game(canvas, input, events);

assert.ok(CONFIG.perks.every(perk => perk.sprite?.endsWith('.png')), 'every Crown Power exposes a dedicated pixel-art sprite');

assert.equal(canvas.width, 2560, 'canvas renders sharply at capped device pixel ratio');
assert.equal(game.player.health, 3, 'new runs start with three lives');

game.start();
game.player.invulnerable = 999;
assert.ok(game.pickupTimer <= 3, 'the first weapon crate is scheduled almost immediately');
game.pickupTimer = 0;
game.update(1 / 60);
assert.equal(game.pickups.length, 1, 'weapon director spawns pickups');
const offeredWeapon = game.pickups[0].weapon;
assert.ok(['laser', 'tesla'].includes(offeredWeapon), 'the first crate showcases Laser or Tesla');
const previousWeaponLevel = game.weaponLevels[offeredWeapon];
assert.equal(previousWeaponLevel, 0, 'the first crate guarantees a previously unowned weapon');
assert.equal(game.pickups[0].targetLevel, previousWeaponLevel + 1, 'crate advertises its exact target level');
assert.equal(game.pickups[0].firstDrop, true, 'the first crate is marked for persistent on-screen guidance');
assert.ok(game.pickups[0].y >= 140, 'the first crate appears below the HUD instead of outside the arena');
game.pickups[0].x = game.player.x;
game.pickups[0].y = game.player.y;
game.update(1 / 60);
assert.equal(game.weapon, offeredWeapon, 'collecting a visible crate equips its advertised weapon');
assert.equal(game.weaponLevels[offeredWeapon], previousWeaponLevel + 1, 'collecting a crate permanently advances that weapon');
assert.equal(game.pickups[0].collected, true, 'the crate enters its opening animation state');
assert.ok(game.pickups[0].life > 0, 'the opened crate remains briefly visible');
assert.ok(game.snapshot().weaponIcon && game.snapshot().weaponColor, 'HUD receives weapon identity metadata');
assert.ok(game.snapshot().weaponUpgrade, 'HUD receives the named upgrade tier');

game.weaponLevels = { blaster: 5, spread: 5, pulse: 5, laser: 5, tesla: 5 };
assert.deepEqual(
  { count: game.weaponStats('blaster').count, pierce: game.weaponStats('blaster').pierce, ricochet: game.weaponStats('blaster').ricochet },
  { count: 3, pierce: 1, ricochet: 1 },
  'max Blaster combines royal salvo, penetration and ricochet',
);
assert.deepEqual(
  { count: game.weaponStats('spread').count, rearCount: game.weaponStats('spread').rearCount, pierce: game.weaponStats('spread').pierce },
  { count: 7, rearCount: 2, pierce: 1 },
  'max Spread combines seven forward shots with rear guard',
);
assert.deepEqual(
  { count: game.weaponStats('pulse').count, explosion: game.weaponStats('pulse').explosion, ricochet: game.weaponStats('pulse').ricochet },
  { count: 2, explosion: 88, ricochet: 2 },
  'max Pulse combines twin supernovas with chain targeting',
);
assert.deepEqual(
  { count: game.weaponStats('laser').count, pierce: game.weaponStats('laser').pierce, beamLength: game.weaponStats('laser').beamLength },
  { count: 3, pierce: 5, beamLength: 64 },
  'max Laser becomes a three-beam piercing prisma lance',
);
assert.deepEqual(
  { count: game.weaponStats('tesla').count, branches: game.weaponStats('tesla').branches, chainRange: game.weaponStats('tesla').chainRange },
  { count: 2, branches: 4, chainRange: 365 },
  'max Tesla becomes a twin coil with four attached branches per primary arc',
);

game.enemies = [];
for (let index = 0; index < 3; index += 1) {
  game.spawnEnemy('tank');
  Object.assign(game.enemies[index], { x: game.player.x + index * 70, y: game.player.y - 210, elite: null });
}
game.weapon = 'tesla';
game.weaponTimer = 0;
game.updateWeapons(1 / 60);
assert.ok(game.teslaArcs.length >= 3, 'Tesla attaches to a primary enemy and branches to nearby targets');
assert.equal(game.bullets.some(bullet => bullet.weapon === 'tesla'), false, 'Tesla uses persistent lightning links instead of fake ricochet projectiles');
assert.ok(game.impactFlashes.some(impact => impact.type === 'tesla'), 'Tesla damage creates its dedicated impact effect');
assert.ok(game.impactFlashes.every(impact => impact.life > 0 && impact.maxLife > 0), 'weapon impacts have short deterministic lifetimes');

game.offerPerks();
assert.equal(game.active, false, 'the game pauses while a perk is selected');
assert.equal(perkChoices.length, 3, 'a Warden reward offers three perks');
assert.equal(perkChoices.filter(perk => perk.cursed).length, 1, 'each Warden choice includes one explicit risk-reward curse');
const chosenPerk = perkChoices.find(perk => !perk.cursed);
assert.equal(game.selectPerk(chosenPerk.key), true, 'one of the offered perks can be applied');
assert.equal(game.perkCounts[chosenPerk.key], 1, 'perk stacks persist for the run');
assert.equal(game.active, true, 'the run resumes after selecting a perk');

const riskGame = new Game(canvas, input, events);
riskGame.start('arcade');
riskGame.awaitingPerk = true;
riskGame.offeredPerks = ['glassCrown'];
assert.equal(riskGame.selectPerk('glassCrown'), true, 'Glass Crown can be deliberately accepted');
assert.equal(riskGame.modifiers.score, 2, 'Glass Crown doubles score');
assert.equal(riskGame.snapshot().maxHealth, 2, 'Glass Crown permanently removes one maximum life');
riskGame.awaitingPerk = true;
riskGame.offeredPerks = ['cursedOverdrive'];
riskGame.selectPerk('cursedOverdrive');
assert.ok(riskGame.modifiers.fireRate < .6 && riskGame.modifiers.enemyPressure > 1.2, 'Cursed Overdrive trades fire rate for enemy pressure');
riskGame.awaitingPerk = true;
riskGame.offeredPerks = ['royalDebt'];
riskGame.selectPerk('royalDebt');
assert.equal(riskGame.modifiers.comboGain, 2, 'Royal Debt doubles combo growth');
assert.equal(riskGame.modifiers.bossHealth, 1.65, 'Royal Debt strengthens future Wardens');

const animationGame = new Game(canvas, input, events);
animationGame.start('arcade');
animationGame.spawnEnemy('tank');
const animatedEnemy = animationGame.enemies[0];
animatedEnemy.x = animationGame.player.x;
animatedEnemy.y = animationGame.player.y - 180;
animationGame.damageEnemy(animatedEnemy, 1, false, 'blaster');
assert.ok(animatedEnemy.hitTime > 0, 'a surviving enemy enters its type-specific hit-reaction window');
assert.ok(Math.hypot(animatedEnemy.recoilX, animatedEnemy.recoilY) > 0, 'weapon damage applies visual recoil to the enemy');
animationGame.damageEnemy(animatedEnemy, 999, false, 'pulse');
assert.equal(animatedEnemy.dead, true, 'lethal damage marks the enemy as defeated');
assert.equal(animationGame.deathAnimations.length, 1, 'lethal damage creates one persistent wreck animation');
assert.equal(animationGame.deathAnimations[0].type, 'tank', 'the wreck keeps the defeated enemy identity');
const wreckLife = animationGame.deathAnimations[0].life;
animationGame.updateEffects(.1);
assert.ok(animationGame.deathAnimations[0].life < wreckLife, 'wreck animations advance through the shared effects update');

const threatToasts = [];
const threatGame = new Game(canvas, input, { ...events, toast: message => threatToasts.push(message) });
threatGame.start('arcade');
threatGame.player.invulnerable = 999;
threatGame.time = CONFIG.stageDuration * 1.49;
threatGame.stageIndex = 1;
threatGame.spawnTimer = 99;
threatGame.formationTimer = 99;
threatGame.updateSpawning(1 / 60);
assert.ok(threatGame.enemies.some(enemy => enemy.type === 'weaver'), 'Crown Weaver is introduced midway through zone two');
assert.equal(threatGame.enemies.some(enemy => enemy.type === 'skimmer'), false, 'Void Skimmer is not exposed alongside the Weaver');
assert.ok(threatToasts.includes('NEW THREAT · CROWN WEAVER'), 'the first Weaver encounter receives a short readable announcement');

threatGame.enemies = [];
threatGame.time = CONFIG.stageDuration * 2.23;
threatGame.stageIndex = 2;
threatGame.updateSpawning(1 / 60);
const introducedSkimmer = threatGame.enemies.find(enemy => enemy.type === 'skimmer');
assert.ok(introducedSkimmer, 'Void Skimmer is introduced separately in zone three');
assert.ok(introducedSkimmer.skimmerIntro > 0, 'a Skimmer waits behind a side warning before crossing the arena');
const warnedX = introducedSkimmer.x;
threatGame.updateEnemies(.5);
assert.equal(introducedSkimmer.x, warnedX, 'Skimmer remains outside the arena during its warning window');
threatGame.updateEnemies(.6);
threatGame.updateEnemies(.1);
assert.ok(introducedSkimmer.x > warnedX, 'Skimmer crosses horizontally after the warning completes');

const shieldGame = new Game(canvas, input, events);
shieldGame.start('arcade');
shieldGame.spawnEnemy('weaver', { x: 500, y: 180, elite: null });
shieldGame.spawnEnemy('tank', { x: 550, y: 205, elite: null });
const weaver = shieldGame.enemies[0];
const protectedTank = shieldGame.enemies[1];
shieldGame.updateEnemies(0);
assert.ok(weaver.linkTargets.includes(protectedTank.id), 'Crown Weaver visibly selects a nearby ally to protect');
const protectedHealth = protectedTank.health;
shieldGame.damageEnemy(protectedTank, 1, false, 'blaster');
assert.ok(Math.abs((protectedHealth - protectedTank.health) - .32) < .001, 'Weaver link substantially reduces damage until the support enemy is destroyed');
shieldGame.damageEnemy(weaver, 999, false, 'pulse');
const unprotectedHealth = protectedTank.health;
shieldGame.damageEnemy(protectedTank, 1, false, 'blaster');
assert.ok(Math.abs((unprotectedHealth - protectedTank.health) - 1) < .001, 'destroying the Weaver immediately restores full damage against its former ally');

const formationGame = new Game(canvas, input, events);
formationGame.start('arcade');
formationGame.spawnFormation('ripperV');
assert.equal(formationGame.enemies.filter(enemy => enemy.type === 'chaser').length, 5, 'formation director can deploy a readable five-enemy Ripper V');

const bossGame = new Game(canvas, input, events);
bossGame.start('arcade');
bossGame.player.invulnerable = 999;
bossGame.enemies = [];
bossGame.spawnEnemy('boss');
const warden = bossGame.enemies[0];
assert.equal(warden.bossName, 'VERDANT WARDEN', 'the first zone receives its own Verdant Warden identity');
assert.equal(bossGame.snapshot().bossName, 'VERDANT WARDEN', 'HUD receives the active zone Warden identity');
assert.equal(warden.introMax, 2.35, 'Warden enters through a dedicated presentation window');
const shieldedHealth = warden.health;
bossGame.damageEnemy(warden, 99, false, 'laser');
assert.equal(warden.health, shieldedHealth, 'Warden cannot be damaged during its readable entrance');
warden.intro = 0;
warden.invulnerable = 0;
warden.y = 126;
warden.health = warden.maxHealth * .64;
bossGame.updateEnemies(1 / 60);
assert.equal(warden.bossPhase, 2, 'Warden enters its zone-specific second phase below two thirds health');
assert.ok(warden.phaseTransition > 0 && warden.invulnerable > 0, 'phase changes create a short protected transition');
warden.phaseTransition = 0;
warden.invulnerable = 0;
warden.patternIndex = 0;
warden.patternTimer = 0;
bossGame.updateEnemies(1 / 60);
assert.ok(bossGame.bossWarnings.some(warning => warning.type === 'ring'), 'phase two announces its projectile ring before firing');
const ringWarning = bossGame.bossWarnings[0];
bossGame.updateBossWarnings(ringWarning.warning + .01);
assert.ok(bossGame.enemyBullets.some(bullet => bullet.kind === 'wardenOrb'), 'announced Warden rings release their dedicated projectiles');
warden.health = warden.maxHealth * .3;
bossGame.updateEnemies(1 / 60);
assert.equal(warden.bossPhase, 3, 'Warden enters its zone-specific final phase below one third health');
warden.phaseTransition = 0;
warden.invulnerable = 0;
warden.patternIndex = 2;
warden.patternTimer = 0;
bossGame.hazards = [];
bossGame.updateEnemies(1 / 60);
assert.equal(bossGame.hazards.filter(hazard => hazard.type === 'poison' && hazard.bossHazard).length, 4, 'Verdant Warden surrounds the player with a warned Toxic Bloom');
bossGame.time = CONFIG.stageDuration - .19;
const lockedBossTime = bossGame.time;
bossGame.update(.25);
assert.equal(bossGame.time, lockedBossTime, 'the endless zone waits for its Warden to be defeated before advancing');

const signatureGame = new Game(canvas, input, events);
signatureGame.start('arcade');
for (const [stageIndex, expectedName, expectedType, expectedCount] of [
  [1, 'EMBER WARDEN', 'meteor', 4],
  [2, 'CRYSTAL WARDEN', 'laserLine', 2],
  [3, 'CROWN WARDEN', 'wardenBeam', 2],
]) {
  signatureGame.stageIndex = stageIndex;
  signatureGame.enemies = [];
  signatureGame.hazards = [];
  signatureGame.spawnEnemy('boss');
  const variant = signatureGame.enemies[0];
  assert.equal(variant.bossName, expectedName, `zone ${stageIndex + 1} loads ${expectedName}`);
  signatureGame.scheduleWardenSignature(variant, 3);
  assert.equal(signatureGame.hazards.filter(hazard => hazard.type === expectedType).length, expectedCount, `${expectedName} exposes its own warned signature attack`);
}

const poisonGame = new Game(canvas, input, events);
poisonGame.start('arcade');
poisonGame.zoneEventTimer = 99;
poisonGame.hazards = [{ type: 'poison', x: poisonGame.player.x, y: poisonGame.player.y, radius: 44, age: 0, warning: .65, life: 5.15 }];
const poisonHealth = poisonGame.player.health;
poisonGame.updateZoneMechanics(.5);
assert.equal(poisonGame.player.health, poisonHealth, 'poison warning never removes a life');
assert.equal(poisonGame.player.poisonExposure, 0, 'poison exposure starts only after the warning phase');
poisonGame.updateZoneMechanics(.5);
assert.equal(poisonGame.player.health, poisonHealth, 'brief poison contact does not remove a whole life');
assert.ok(poisonGame.player.poisonExposure > 0 && poisonGame.player.poisonExposure < 1, 'active poison builds a visible exposure value');
const partialExposure = poisonGame.player.poisonExposure;
poisonGame.player.x += 200;
poisonGame.updateZoneMechanics(.2);
assert.ok(poisonGame.player.poisonExposure < partialExposure, 'poison exposure drains after leaving the puddle');
poisonGame.player.x = poisonGame.hazards[0].x;
poisonGame.updateZoneMechanics(1.4);
assert.equal(poisonGame.player.health, poisonHealth - 1, 'continuous poison contact eventually costs exactly one life');
assert.ok(poisonGame.player.poisonSplash > 0, 'poison damage triggers its dedicated sprite effect');
poisonGame.player.invulnerable = 0;
poisonGame.updateZoneMechanics(2.8);
assert.equal(poisonGame.player.health, poisonHealth - 1, 'one uninterrupted puddle contact can never drain multiple lives');

game.hazards = [];
game.stageIndex = 1;
game.zoneEventTimer = 0;
game.updateZoneMechanics(1 / 60);
assert.ok(game.hazards.some(hazard => hazard.type === 'meteor'), 'Ember Rift schedules warned meteor strikes');
game.hazards = [];
game.stageIndex = 2;
game.zoneEventTimer = 0;
game.updateZoneMechanics(1 / 60);
assert.ok(game.hazards.some(hazard => hazard.type === 'laserLine'), 'Crystal Void schedules warned laser lines');
game.enemies = [];
game.stageIndex = 3;
game.zoneEventTimer = 0;
game.updateZoneMechanics(1 / 60);
assert.ok(game.enemies.length >= 2 && game.enemies.every(enemy => enemy.elite), 'Crown Core schedules a guaranteed elite wave');
game.stageIndex = 0;
game.enemies = [];
game.spawnEnemy('chaser');
assert.equal(game.enemies.length, 1, 'enemy director can create its primary enemy');
for (let frame = 0; frame < 60 * 20; frame += 1) game.update(1 / 60);

assert.ok(Number.isFinite(game.score) && game.score > 0, 'score advances');
game.enemies = [];
game.bullets = [];
game.spawnEnemy('chaser');
game.enemies[0].x = game.player.x;
game.enemies[0].y = game.player.y - 220;
game.weaponTimer = 0;
game.update(1 / 60);
assert.ok(game.bullets.length > 0 || game.teslaArcs.length > 0, 'auto-fire produces projectiles or attached Tesla arcs');

game.enemies = [];
game.bossStage = -1;
game.time = 102.1;
game.update(1 / 60);
assert.ok(game.enemies.some(enemy => enemy.type === 'boss'), 'each zone spawns a Warden before its transition');

game.enemies = [];
game.time = 119.99;
game.lastStageIndex = 0;
game.update(1 / 30);
assert.equal(game.stageIndex, 1, 'the run advances into the next endless zone');

game.enemies = [];
game.player.invulnerable = 0;
game.player.dashCooldown = 0;
game.spawnEnemy('chaser');
const target = game.enemies[0];
target.x = game.player.x;
target.y = game.player.y - 2;
input.dashQueued = true;
game.update(1 / 60);

assert.ok(game.player.dashTime > 0, 'dash starts from queued input');
assert.ok(game.combo > 1, 'dash collision defeats an enemy and builds combo');

game.start('crowned');
assert.equal(game.player.health, 2, 'Crowned difficulty starts with two lives');
assert.equal(game.snapshot().difficulty, 'crowned', 'difficulty is carried into score metadata');

console.log('Smoke test passed:', {
  score: Math.floor(game.score),
  combo: game.combo,
  particles: game.particles.length,
});
