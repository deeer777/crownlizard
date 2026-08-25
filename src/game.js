import { CONFIG } from './config.js?v=20260825-67-account-overhaul';

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const random = (min, max) => min + Math.random() * (max - min);
const circlesTouch = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < a.radius + b.radius;
const ENVIRONMENT_FILES = [
  ['verdant-decal-v1.png', 'verdant-relic-v1.png'],
  ['ember-decal-v1.png', 'ember-meteor-v1.png'],
  ['crystal-decal-v1.png', 'crystal-cluster-v1.png'],
  ['crown-decal-v1.png', 'crown-relic-v1.png'],
];
const WEAPON_ASSET_FILES = {
  blaster: ['blaster-mount-v1.png', 'blaster-impact-v1.png'],
  spread: ['spread-mount-v1.png', 'spread-impact-v1.png'],
  pulse: ['pulse-mount-v1.png', 'pulse-impact-v1.png'],
  laser: ['laser-mount-v1.png', 'laser-impact-v1.png'],
  tesla: ['tesla-mount-v1.png', 'tesla-impact-v1.png'],
};
const SPECIAL_ENEMY_FILES = {
  weaver: 'sprites/crown-weaver-v1.png',
  skimmer: 'sprites/void-skimmer-v1.png',
};
const WARDEN_VARIANTS = [
  { key: 'verdant', name: 'VERDANT WARDEN', sprite: 'warden-verdant-v1.png', wreck: 'warden-verdant-wreck-v1.png', phase2: 'ROOT NETWORK', phase3: 'TOXIC BLOOM' },
  { key: 'ember', name: 'EMBER WARDEN', sprite: 'warden-ember-v1.png', wreck: 'warden-ember-wreck-v1.png', phase2: 'FURNACE RISE', phase3: 'FINAL ERUPTION' },
  { key: 'crystal', name: 'CRYSTAL WARDEN', sprite: 'warden-crystal-v1.png', wreck: 'warden-crystal-wreck-v1.png', phase2: 'PRISM STORM', phase3: 'SHATTERPOINT' },
  { key: 'crown', name: 'CROWN WARDEN', sprite: 'warden-v1.png', wreck: 'warden-wreck-v1.png', phase2: 'CROWN STORM', phase3: 'LAST DECREE' },
];
const ENEMY_DEATH_FILES = {
  chaser: 'ripper-wreck-v1.png',
  shooter: 'hex-moth-wreck-v1.png',
  tank: 'iron-scarab-wreck-v1.png',
  weaver: 'crown-weaver-wreck-v1.png',
  skimmer: 'void-skimmer-wreck-v1.png',
  boss: 'warden-wreck-v1.png',
};
const ENEMY_DRAW_SIZES = {
  chaser: { width: 60, height: 64 },
  shooter: { width: 80, height: 69 },
  tank: { width: 74, height: 80 },
  weaver: { width: 74, height: 66 },
  skimmer: { width: 96, height: 64 },
  boss: { width: 148, height: 158 },
};

export class Game {
  constructor(canvas, input, events = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.input = input;
    this.events = events;
    this.difficulty = 'arcade';
    this.sprites = this.loadSprites();
    this.environmentSprites = new Map();
    this.weaponFxSprites = new Map();
    this.enemyDeathSprites = new Map();
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.active = false;
    this.paused = false;
    this.reducedEffects = false;
    this.resize();
    addEventListener('resize', () => this.resize());
    this.reset();
  }

  resize() {
    this.width = innerWidth;
    this.height = innerHeight;
    this.arenaWidth = Math.min(this.width, 860);
    this.arenaLeft = (this.width - this.arenaWidth) / 2;
    this.arenaRight = this.arenaLeft + this.arenaWidth;
    this.dpr = Math.min(2, Math.max(1, devicePixelRatio || 1));
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
  }

  loadSprites() {
    if (typeof Image === 'undefined') return {};
    const files = {
      player: 'runtime/sprites/crown-lizard-player-v1.png',
      chaser: 'runtime/sprites/ripper-v1.png',
      shooter: 'runtime/sprites/hex-moth-v1.png',
      tank: 'runtime/sprites/iron-scarab-v1.png',
      crateClosed: 'runtime/sprites/weapon-crate-closed-v1.png',
      crateOpen: 'runtime/sprites/weapon-crate-open-v1.png',
      poisonPuddle: 'runtime/hazards/poison-puddle-v1.png',
      poisonWarning: 'runtime/hazards/poison-warning-v1.png',
      poisonHit: 'runtime/hazards/poison-hit-v1.png',
      meteorWarning: 'hazards/meteor-warning-v1.png',
      meteorCore: 'hazards/meteor-core-v1.png',
      meteorImpact: 'hazards/meteor-impact-v1.png',
    };
    return Object.fromEntries(Object.entries(files).map(([key, filename]) => {
      const image = new Image();
      image.decoding = 'async';
      image.src = new URL(`../assets/${filename}`, import.meta.url).href;
      return [key, image];
    }));
  }

  setPlayerSkin(filename = 'crown-lizard-player-v1.png') {
    if (typeof Image === 'undefined') return;
    const image = new Image();
    image.decoding = 'async';
    const directory = filename === 'crown-lizard-player-v1.png' ? 'runtime/sprites' : 'sprites';
    image.src = new URL(`../assets/${directory}/${filename}`, import.meta.url).href;
    this.sprites.player = image;
  }

  loadEnvironmentSprites(zone) {
    if (typeof Image === 'undefined') return [];
    if (this.environmentSprites.has(zone)) return this.environmentSprites.get(zone);
    const sprites = ENVIRONMENT_FILES[zone].map(filename => {
      const image = new Image();
      image.decoding = 'async';
      image.src = new URL(`../assets/environment/${filename}`, import.meta.url).href;
      return image;
    });
    // Bara aktuell zon hålls av motorn. Webbläsarcachen gör återbesök snabba utan att alla stora sprites ligger avkodade i minnet.
    this.environmentSprites.clear();
    this.environmentSprites.set(zone, sprites);
    return sprites;
  }

  loadEnemySprite(type) {
    if (typeof Image === 'undefined' || !SPECIAL_ENEMY_FILES[type]) return null;
    if (this.sprites[type]) return this.sprites[type];
    const image = new Image();
    image.decoding = 'async';
    image.src = new URL(`../assets/${SPECIAL_ENEMY_FILES[type]}`, import.meta.url).href;
    this.sprites[type] = image;
    return image;
  }

  loadWardenSprite(variant) {
    if (typeof Image === 'undefined') return null;
    const profile = WARDEN_VARIANTS[variant] || WARDEN_VARIANTS[3];
    const key = `boss-${variant}`;
    if (this.sprites[key]) return this.sprites[key];
    const image = new Image();
    image.decoding = 'async';
    image.src = new URL(`../assets/sprites/${profile.sprite}`, import.meta.url).href;
    this.sprites[key] = image;
    return image;
  }

  loadWeaponFx(weapon) {
    if (typeof Image === 'undefined') return [];
    if (this.weaponFxSprites.has(weapon)) return this.weaponFxSprites.get(weapon);
    const [mountFile, impactFile] = WEAPON_ASSET_FILES[weapon];
    const sprites = [
      ['weapons', mountFile],
      ['impacts', impactFile],
    ].map(([folder, filename]) => {
      const image = new Image();
      image.decoding = 'async';
      image.src = new URL(`../assets/${folder}/${filename}`, import.meta.url).href;
      return image;
    });
    this.weaponFxSprites.set(weapon, sprites);
    return sprites;
  }

  loadEnemyDeathSprite(type, variant = 3) {
    if (typeof Image === 'undefined') return null;
    const key = type === 'boss' ? `boss-${variant}` : type;
    if (this.enemyDeathSprites.has(key)) return this.enemyDeathSprites.get(key);
    const image = new Image();
    image.decoding = 'async';
    const filename = type === 'boss' ? (WARDEN_VARIANTS[variant] || WARDEN_VARIANTS[3]).wreck : ENEMY_DEATH_FILES[type];
    image.src = new URL(`../assets/enemies/${filename}`, import.meta.url).href;
    this.enemyDeathSprites.set(key, image);
    return image;
  }

  reset() {
    this.time = 0;
    this.stageIndex = 0;
    this.lastStageIndex = 0;
    this.bossStage = -1;
    this.score = 0;
    this.displayScore = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.spawnTimer = .8;
    this.formationTimer = 18;
    this.introducedThreats = new Set();
    this.pickupTimer = 2.8;
    this.pickupCount = 0;
    this.runStats = { wardens: 0, enemies: 0, crates: 0, bestCombo: 1 };
    this.shake = 0;
    this.flash = 0;
    this.weapon = 'blaster';
    this.weaponLevels = { blaster: 1, spread: 0, pulse: 0, laser: 0, tesla: 0 };
    this.perkCounts = Object.fromEntries(CONFIG.perks.map(perk => [perk.key, 0]));
    this.modifiers = {
      dashCooldown: 1,
      maxHealthBonus: 0,
      pickupRange: 0,
      fireRate: 1,
      damage: 1,
      movement: 1,
      comboWindow: 1,
      score: 1,
      enemyPressure: 1,
      comboGain: 1,
      bossHealth: 1,
    };
    this.awaitingPerk = false;
    this.weaponTimer = 0;
    this.nextEntityId = 1;
    this.enemies = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.bossWarnings = [];
    this.teslaArcs = [];
    this.impactFlashes = [];
    this.deathAnimations = [];
    this.pickups = [];
    this.hazards = [];
    this.zoneEventTimer = 5;
    this.particles = [];
    this.trails = [];
    this.stars = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), size: random(.5, 1.8), speed: random(.01, .06) }));
    this.scenery = Array.from({ length: 22 }, (_, index) => ({
      x: Math.random(), y: Math.random(), depth: random(.25, 1), size: random(12, 46), spin: index % 2 ? 1 : -1, variant: index % 4,
    }));
    this.player = {
      x: this.width / 2,
      y: this.height * .76,
      vx: 0,
      vy: 0,
      radius: CONFIG.player.radius,
      health: CONFIG.difficulties[this.difficulty].health,
      invulnerable: 0,
      dashTime: 0,
      dashCooldown: 0,
      dashX: 0,
      dashY: -1,
      facingX: 0,
      facingY: -1,
      aim: -Math.PI / 2,
      poisonExposure: 0,
      poisonSplash: 0,
      poisonLatched: false,
    };
    this.events.hud?.(this.snapshot());
  }

  start(difficulty = 'arcade') {
    this.difficulty = CONFIG.difficulties[difficulty] ? difficulty : 'arcade';
    this.reset();
    this.active = true;
    this.paused = false;
    this.events.stage?.(this.stageInfo());
  }
  stop() { this.active = false; this.paused = false; }

  snapshot() {
    const stage = this.stageInfo();
    const boss = this.enemies.find(enemy => enemy.type === 'boss' && !enemy.dead);
    const weapon = CONFIG.weapons[this.weapon];
    const weaponLevel = this.weaponLevels[this.weapon];
    return {
      score: Math.floor(this.score),
      health: this.player.health,
      maxHealth: CONFIG.difficulties[this.difficulty].health + this.modifiers.maxHealthBonus,
      combo: this.combo,
      dash: clamp(1 - this.player.dashCooldown / (CONFIG.dash.cooldown * this.modifiers.dashCooldown), 0, 1),
      weapon: weapon.name,
      weaponKey: this.weapon,
      weaponIcon: weapon.icon,
      weaponColor: weapon.color,
      weaponLevel,
      weaponUpgrade: weapon.upgrades[weaponLevel - 1],
      difficulty: this.difficulty,
      stage: stage.number,
      stageName: stage.name,
      stageProgress: stage.progress,
      boss: Boolean(boss),
      bossName: boss?.bossName || '',
      bossPhase: boss?.bossPhase || 0,
      bossHealth: boss ? clamp(boss.health / boss.maxHealth, 0, 1) : 0,
    };
  }

  runSummary() {
    const powers = CONFIG.perks
      .filter(perk => this.perkCounts[perk.key] > 0)
      .map(perk => ({ name: perk.name, level: this.perkCounts[perk.key] }));
    return {
      durationMs: Math.max(0, Math.round(this.time * 1000)),
      zone: this.stageIndex + 1,
      wardens: this.runStats.wardens,
      enemies: this.runStats.enemies,
      crates: this.runStats.crates,
      bestCombo: this.runStats.bestCombo,
      weapon: CONFIG.weapons[this.weapon].name,
      weaponLevel: this.weaponLevels[this.weapon],
      powers,
    };
  }

  weaponStats(key = this.weapon) {
    const level = Math.max(1, this.weaponLevels[key] || 1);
    const stats = { ...CONFIG.weapons[key], level, pierce: 0, ricochet: 0, explosion: 0, rearCount: 0 };
    if (key === 'blaster') {
      if (level >= 2) { stats.count = 2; stats.spread = .07; }
      if (level >= 3) stats.pierce = 1;
      if (level >= 4) stats.ricochet = 1;
      if (level >= 5) { stats.count = 3; stats.interval = .15; stats.damage = 1.2; }
    } else if (key === 'spread') {
      if (level >= 2) stats.count = 5;
      if (level >= 3) { stats.spread = .25; stats.damage = .9; }
      if (level >= 4) stats.rearCount = 2;
      if (level >= 5) { stats.count = 7; stats.interval = .26; stats.pierce = 1; }
    } else if (key === 'pulse') {
      if (level >= 2) { stats.radius = 8; stats.damage = 3.1; }
      if (level >= 3) stats.explosion = 58;
      if (level >= 4) stats.ricochet = 2;
      if (level >= 5) { stats.count = 2; stats.spread = .12; stats.interval = .42; stats.damage = 3.5; stats.explosion = 88; }
    } else if (key === 'laser') {
      stats.pierce = 1;
      stats.beamLength = 34;
      if (level >= 2) { stats.interval = .155; stats.damage = 1; }
      if (level >= 3) { stats.pierce = 3; stats.beamLength = 48; }
      if (level >= 4) { stats.count = 2; stats.spread = .045; }
      if (level >= 5) { stats.count = 3; stats.spread = .055; stats.interval = .125; stats.damage = 1.18; stats.pierce = 5; stats.beamLength = 64; }
    } else if (key === 'tesla') {
      stats.branches = 1;
      stats.chainRange = 245;
      stats.attachDuration = .24;
      if (level >= 2) { stats.branches = 2; stats.chainRange = 275; }
      if (level >= 3) { stats.damage = .72; stats.attachDuration = .3; }
      if (level >= 4) { stats.count = 2; stats.chainRange = 315; }
      if (level >= 5) { stats.branches = 4; stats.chainRange = 365; stats.interval = .22; stats.damage = .9; stats.attachDuration = .36; }
    }
    stats.interval *= this.modifiers.fireRate;
    stats.damage *= this.modifiers.damage;
    return stats;
  }

  stageInfo() {
    const number = this.stageIndex + 1;
    const definition = CONFIG.stages[this.stageIndex % CONFIG.stages.length];
    return {
      ...definition,
      number,
      cycle: Math.floor(this.stageIndex / CONFIG.stages.length) + 1,
      progress: (this.time % CONFIG.stageDuration) / CONFIG.stageDuration,
    };
  }

  update(dt) {
    if (this.paused) return;
    if (!this.active) return;
    this.updateStars(dt);
    this.flash = Math.max(0, this.flash - dt * 3.5);
    this.shake = Math.max(0, this.shake - dt * 18);
    const bossLocksStage = this.enemies.some(enemy => enemy.type === 'boss' && !enemy.dead) && (this.time % CONFIG.stageDuration) >= CONFIG.stageDuration - .2;
    if (!bossLocksStage) this.time += dt;
    this.stageIndex = Math.floor(this.time / CONFIG.stageDuration);
    if (this.stageIndex !== this.lastStageIndex) {
      this.lastStageIndex = this.stageIndex;
      const maxHealth = CONFIG.difficulties[this.difficulty].health + this.modifiers.maxHealthBonus;
      this.player.health = Math.min(maxHealth, this.player.health + 1);
      this.score += 1000 * (this.stageIndex + 1) * CONFIG.difficulties[this.difficulty].score * this.modifiers.score;
      this.enemyBullets = [];
      this.hazards = [];
      this.zoneEventTimer = 4.5;
      this.formationTimer = 12;
      this.events.stage?.(this.stageInfo());
      this.events.haptic?.([20, 30, 20]);
    }
    this.score += dt * (12 + Math.min(24, this.time * .1)) * CONFIG.difficulties[this.difficulty].score * this.modifiers.score;
    this.comboTimer -= dt;
    if (this.comboTimer <= 0 && this.combo > 1) this.combo = Math.max(1, this.combo - dt * 1.8);

    this.updatePlayer(dt);
    this.updateSpawning(dt);
    this.updateZoneMechanics(dt);
    this.updateWeapons(dt);
    this.updateEnemies(dt);
    this.updateBossWarnings(dt);
    this.updateProjectiles(dt);
    this.updatePickups(dt);
    this.updateEffects(dt);
    this.events.hud?.(this.snapshot());
  }

  updateStars(dt) {
    for (const star of this.stars || []) star.y = (star.y + dt * star.speed) % 1;
    for (const object of this.scenery || []) object.y = (object.y + dt * (.012 + object.depth * .045)) % 1;
  }

  updatePlayer(dt) {
    const player = this.player;
    const movement = this.input.movement(player);
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    player.dashCooldown = Math.max(0, player.dashCooldown - dt);

    if (this.input.consumeDash() && player.dashCooldown <= 0) {
      const hasDirection = Math.hypot(movement.x, movement.y) > .1;
      player.dashX = hasDirection ? movement.x : player.facingX;
      player.dashY = hasDirection ? movement.y : player.facingY;
      player.dashTime = CONFIG.dash.duration;
      player.dashCooldown = CONFIG.dash.cooldown * this.modifiers.dashCooldown;
      player.invulnerable = CONFIG.dash.duration + .06;
      this.shake = 4;
      this.burst(player.x, player.y, '#6fffd2', 16, 250);
      this.events.haptic?.(18);
      this.events.sfx?.('dash');
    }

    if (player.dashTime > 0) {
      player.dashTime -= dt;
      player.vx = player.dashX * CONFIG.dash.speed;
      player.vy = player.dashY * CONFIG.dash.speed;
      this.trails.push({ x: player.x, y: player.y, life: .22, radius: player.radius });
    } else {
      if (Math.hypot(movement.x, movement.y) > .1) {
        player.facingX = movement.x;
        player.facingY = movement.y;
      }
      const poisonMovement = 1 - player.poisonExposure * .18;
      player.vx += movement.x * CONFIG.player.acceleration * this.modifiers.movement * poisonMovement * dt;
      player.vy += movement.y * CONFIG.player.acceleration * this.modifiers.movement * poisonMovement * dt;
      const drag = Math.exp(-CONFIG.player.drag * dt);
      player.vx *= drag;
      player.vy *= drag;
      const speed = Math.hypot(player.vx, player.vy);
      const maxSpeed = CONFIG.player.maxSpeed * this.modifiers.movement * poisonMovement;
      if (speed > maxSpeed) {
        player.vx *= maxSpeed / speed;
        player.vy *= maxSpeed / speed;
      }
    }

    player.x = clamp(player.x + player.vx * dt, this.arenaLeft + player.radius + 8, this.arenaRight - player.radius - 8);
    player.y = clamp(player.y + player.vy * dt, 72 + player.radius, this.height - player.radius - 10);
  }

  updateSpawning(dt) {
    const difficulty = CONFIG.difficulties[this.difficulty];
    const stage = this.stageInfo();
    const stageProgress = stage.progress;
    const pressure = Math.min(4.8, (.68 + this.stageIndex * .15 + stageProgress * .48) * difficulty.pressure * this.modifiers.enemyPressure);
    const bossAlive = this.enemies.some(enemy => enemy.type === 'boss' && !enemy.dead);
    const weaverUnlocked = this.stageIndex >= 4 || (this.stageIndex >= 1 && (this.stageIndex !== 1 || stageProgress >= .48));
    const skimmerUnlocked = this.stageIndex >= 4 || (this.stageIndex >= 2 && (this.stageIndex !== 2 || stageProgress >= .22));

    if (!bossAlive && weaverUnlocked && !this.introducedThreats.has('weaver')) {
      this.introducedThreats.add('weaver');
      this.spawnFormation('weaverIntro');
      this.events.toast?.('NEW THREAT · CROWN WEAVER', 'threat');
      this.events.haptic?.([18, 30, 18]);
    }
    if (!bossAlive && skimmerUnlocked && !this.introducedThreats.has('skimmer')) {
      this.introducedThreats.add('skimmer');
      this.spawnFormation('skimmerCross');
      this.events.toast?.('NEW THREAT · VOID SKIMMER', 'threat');
      this.events.haptic?.([18, 20, 18, 20, 35]);
    }

    this.formationTimer -= dt;
    if (!bossAlive && this.stageIndex >= 1 && stageProgress > .22 && stageProgress < .76 && this.formationTimer <= 0) {
      const formations = skimmerUnlocked
        ? ['ripperV', 'weaverEscort', 'skimmerCross']
        : weaverUnlocked ? ['ripperV', 'weaverEscort'] : ['ripperV'];
      this.spawnFormation(formations[Math.floor(Math.random() * formations.length)]);
      this.formationTimer = random(15, 21);
      this.spawnTimer = Math.max(this.spawnTimer, 1.25);
    }

    this.spawnTimer -= dt;
    if (!bossAlive && stageProgress < .85 && this.spawnTimer <= 0) {
      this.spawnTimer = random(.72, 1.16) / pressure;
      const roll = Math.random();
      const weaverCount = this.enemies.filter(enemy => enemy.type === 'weaver' && !enemy.dead).length;
      const skimmerCount = this.enemies.filter(enemy => enemy.type === 'skimmer' && !enemy.dead).length;
      let spawnedSpecial = false;
      if (weaverUnlocked && weaverCount < 2 && roll < .075) {
        this.spawnEnemy('weaver');
        spawnedSpecial = true;
      }
      if (!spawnedSpecial && skimmerUnlocked && skimmerCount < 2 && roll >= .075 && roll < .145) {
        this.spawnEnemy('skimmer');
        spawnedSpecial = true;
      }
      if (!spawnedSpecial) {
        let weights = stageProgress < .2
          ? { chaser: Math.min(.9, stage.weights.chaser + .2), shooter: Math.max(.1, stage.weights.shooter - .1), tank: 0 }
          : stageProgress < .55
            ? { chaser: stage.weights.chaser + stage.weights.tank * .5, shooter: stage.weights.shooter, tank: stage.weights.tank * .5 }
            : stage.weights;
        if (this.stageIndex === 0 && stageProgress < .14) weights = { chaser: 1, shooter: 0, tank: 0 };
        else if (this.stageIndex === 0) weights = { chaser: weights.chaser + weights.tank * .6, shooter: weights.shooter + weights.tank * .4, tank: 0 };
        const weightedRoll = roll * (weights.chaser + weights.shooter + weights.tank);
        if (weightedRoll < weights.chaser) this.spawnEnemy('chaser');
        else if (weightedRoll < weights.chaser + weights.shooter) this.spawnEnemy('shooter');
        else this.spawnEnemy('tank');
      }
    }
    const stageTime = this.time % CONFIG.stageDuration;
    if (stageTime > CONFIG.stageDuration - 18 && this.bossStage !== this.stageIndex && !this.enemies.some(enemy => enemy.type === 'boss')) {
      this.bossStage = this.stageIndex;
      this.enemies = this.enemies.filter(enemy => enemy.type === 'boss');
      this.enemyBullets = [];
      this.bossWarnings = [];
      this.hazards = this.hazards.filter(hazard => hazard.type === 'poison' && hazard.age < (hazard.warning ?? .65));
      this.spawnEnemy('boss');
      const warden = this.enemies.find(enemy => enemy.type === 'boss');
      this.events.haptic?.([30, 35, 60]);
    }
    this.pickupTimer -= dt;
    if (this.pickupTimer <= 0) {
      const available = Object.keys(CONFIG.weapons).filter(key => this.weaponLevels[key] < 5);
      if (available.length) {
        const firstDrop = this.pickupCount === 0;
        const unowned = available.filter(key => this.weaponLevels[key] === 0);
        const showcase = unowned.filter(key => key === 'laser' || key === 'tesla');
        const discoveryDrop = unowned.length > 0 && this.pickupCount < 4;
        const favorCurrent = !discoveryDrop && this.pickupCount > 0 && available.includes(this.weapon) && Math.random() < .52;
        const pool = firstDrop && showcase.length ? showcase : discoveryDrop ? unowned : available;
        const weapon = favorCurrent ? this.weapon : pool[Math.floor(Math.random() * pool.length)];
        this.pickups.push({
          x: firstDrop ? clamp(this.player.x, this.arenaLeft + 70, this.arenaRight - 70) : random(this.arenaLeft + 55, this.arenaRight - 55),
          y: firstDrop ? clamp(this.height * .22, 145, 190) : 105,
          radius: 32,
          vy: firstDrop ? 28 : 48,
          life: firstDrop ? 26 : 20,
          weapon,
          targetLevel: this.weaponLevels[weapon] + 1,
          firstDrop,
          discoveryDrop,
        });
        this.pickupCount += 1;
        const remainingDiscoveries = unowned.length - 1;
        this.pickupTimer = remainingDiscoveries > 0 && this.pickupCount < 4 ? random(8, 11) : random(16, 22);
        const weaponName = CONFIG.weapons[weapon].name;
      } else this.pickupTimer = random(16, 22);
    }
  }

  spawnFormation(kind) {
    const center = (this.arenaLeft + this.arenaRight) / 2;
    if (kind === 'weaverIntro') {
      this.spawnEnemy('weaver', { x: center, y: -72, formation: true, elite: null });
      this.spawnEnemy('chaser', { x: clamp(center + 52, this.arenaLeft + 24, this.arenaRight - 24), y: -30, formation: true, elite: null });
      return;
    }
    if (kind === 'weaverEscort') {
      this.spawnEnemy('weaver', { x: center, y: -72, formation: true });
      for (const offset of [-68, 68]) this.spawnEnemy('chaser', { x: clamp(center + offset, this.arenaLeft + 24, this.arenaRight - 24), y: -28, formation: true, elite: null });
      return;
    }
    if (kind === 'skimmerCross') {
      const firstY = clamp(this.height * .28, 155, this.height - 190);
      this.spawnEnemy('skimmer', { side: 1, y: firstY, formation: true });
      if (this.stageIndex >= 3) this.spawnEnemy('skimmer', { side: -1, y: firstY + 92, introDelay: .38, formation: true });
      return;
    }
    for (const [offset, depth] of [[-92, -8], [-46, -38], [0, -68], [46, -38], [92, -8]]) {
      this.spawnEnemy('chaser', { x: clamp(center + offset, this.arenaLeft + 22, this.arenaRight - 22), y: depth, formation: true, elite: null });
    }
  }

  updateZoneMechanics(dt) {
    const zone = this.stageIndex % CONFIG.stages.length;
    const bossActive = this.enemies.some(enemy => enemy.type === 'boss' && !enemy.dead);
    this.zoneEventTimer -= dt;
    if (!bossActive && this.zoneEventTimer <= 0) {
      if (zone === 1) {
        const leadX = clamp(this.player.x + this.player.vx * .42, this.arenaLeft + 50, this.arenaRight - 50);
        const leadY = clamp(this.player.y + this.player.vy * .42, 120, this.height - 55);
        this.hazards.push({ type: 'meteor', x: leadX + random(-55, 55), y: leadY + random(-45, 45), radius: 42, age: 0, warning: 1.15, active: .34, life: 2.15, triggered: false });
        this.zoneEventTimer = random(5.2, 7.2);
      } else if (zone === 2) {
        const vertical = Math.random() < .5;
        this.hazards.push({ type: 'laserLine', vertical, position: vertical ? random(this.arenaLeft + 50, this.arenaRight - 50) : random(135, this.height - 65), width: 34, age: 0, warning: 1.3, active: .55, life: 1.85 });
        this.zoneEventTimer = random(5.8, 8.2);
      } else if (zone === 3) {
        for (let index = 0; index < 2; index += 1) {
          const before = this.enemies.length;
          this.spawnEnemy(index ? 'shooter' : 'chaser');
          const enemy = this.enemies[before];
          if (enemy && !enemy.elite) {
            enemy.elite = index ? 'armored' : 'swift';
            enemy.value *= 2;
            if (enemy.elite === 'armored') { enemy.health *= 2.4; enemy.maxHealth = enemy.health; }
            else enemy.speed *= 1.55;
          }
        }
        this.events.toast?.('CROWN CORE · ELITE WAVE', 'threat');
        this.zoneEventTimer = random(7, 9.5);
      } else this.zoneEventTimer = random(4, 6);
    }

    let poisonContact = false;
    let poisonSource = null;
    for (const hazard of this.hazards) {
      hazard.age += dt;
      if (hazard.type === 'poison') {
        const warning = hazard.warning ?? .65;
        if (hazard.age >= warning && Math.hypot(this.player.x - hazard.x, this.player.y - hazard.y) < hazard.radius + this.player.radius) {
          poisonContact = true;
          poisonSource = hazard;
        }
      } else if (hazard.type === 'meteor') {
        if (!hazard.triggered && hazard.age >= hazard.warning) {
          hazard.triggered = true;
          this.shake = Math.max(this.shake, 7);
          this.burst(hazard.x, hazard.y, '#ff9b64', 16, 220);
        }
        if (hazard.age >= hazard.warning && hazard.age <= hazard.warning + hazard.active && Math.hypot(this.player.x - hazard.x, this.player.y - hazard.y) < hazard.radius + this.player.radius) this.hitPlayer(hazard.x, hazard.y);
      } else if ((hazard.type === 'laserLine' || hazard.type === 'wardenBeam') && hazard.age >= hazard.warning && hazard.age <= hazard.warning + hazard.active) {
        const distance = hazard.vertical ? Math.abs(this.player.x - hazard.position) : Math.abs(this.player.y - hazard.position);
        if (distance < hazard.width / 2 + this.player.radius) this.hitPlayer(hazard.vertical ? hazard.position : this.player.x, hazard.vertical ? this.player.y : hazard.position);
      }
    }
    if (poisonContact && !this.player.poisonLatched) {
      this.player.poisonExposure = Math.min(1, this.player.poisonExposure + dt / 1.35);
      if (this.player.poisonExposure >= 1) {
        const healthBefore = this.player.health;
        this.hitPlayer(poisonSource.x, poisonSource.y);
        this.player.poisonExposure = 0;
        if (this.player.health < healthBefore) {
          this.player.poisonLatched = true;
          this.player.poisonSplash = .36;
        }
      }
    } else if (!poisonContact) {
      this.player.poisonLatched = false;
      this.player.poisonExposure = Math.max(0, this.player.poisonExposure - dt / .7);
    } else {
      this.player.poisonExposure = 0;
    }
    this.hazards = this.hazards.filter(hazard => hazard.age < hazard.life);
  }

  spawnEnemy(type, options = {}) {
    this.loadEnemySprite(type);
    const stage = this.stageInfo();
    const bossVariant = this.stageIndex % WARDEN_VARIANTS.length;
    const bossProfile = WARDEN_VARIANTS[bossVariant];
    if (type === 'boss') this.loadWardenSprite(bossVariant);
    const scaling = 1 + this.stageIndex * .16;
    const base = type === 'boss'
      ? { radius: 46, health: 64 * scaling, speed: 34, value: 2200 + this.stageIndex * 600, color: stage.palette.accent }
      : type === 'weaver'
      ? { radius: 23, health: 6.5, speed: 58, value: 380, color: '#62f7c6' }
      : type === 'skimmer'
      ? { radius: 21, health: 6, speed: 235, value: 330, color: '#ff65df' }
      : type === 'tank'
      ? { radius: 27, health: 8, speed: 48, value: 280, color: '#ff9b64' }
      : type === 'shooter'
        ? { radius: 19, health: 3, speed: 62, value: 190, color: '#d99cff' }
        : { radius: 14, health: 1.4, speed: 95, value: 110, color: '#ff587b' };
    const zone = this.stageIndex % CONFIG.stages.length;
    const learningNewThreat = (type === 'weaver' || type === 'skimmer') && this.stageIndex < 4;
    const eliteChance = type === 'boss' || learningNewThreat ? 0 : (zone === 3 ? .28 : .07 + Math.min(.12, this.stageIndex * .012));
    const eliteTypes = ['swift', 'armored', 'splitter', 'volatile'];
    const elite = options.elite !== undefined ? options.elite : Math.random() < eliteChance ? eliteTypes[Math.floor(Math.random() * eliteTypes.length)] : null;
    let health = type === 'boss' ? base.health * this.modifiers.bossHealth : base.health * (1 + this.stageIndex * .055);
    let speed = base.speed * (1 + Math.min(.65, this.stageIndex * .035));
    let value = base.value;
    if (elite === 'swift') speed *= 1.55;
    if (elite === 'armored') health *= 2.4;
    if (elite) value *= 2;
    const side = options.side || (Math.random() < .5 ? 1 : -1);
    const x = type === 'skimmer'
      ? (side > 0 ? this.arenaLeft - base.radius - 72 : this.arenaRight + base.radius + 72)
      : random(this.arenaLeft + base.radius + 5, this.arenaRight - base.radius - 5);
    const y = type === 'skimmer' ? random(145, Math.max(165, this.height * .58)) : -base.radius - 8;
    this.enemies.push({
      ...base,
      id: this.nextEntityId++,
      type,
      x: options.x ?? x,
      y: options.y ?? y,
      health,
      maxHealth: health,
      speed,
      value,
      elite,
      shoot: random(1.2, 2.2),
      phase: random(0, TAU),
      burst: 1.8,
      intro: type === 'boss' ? 2.35 : 0,
      introMax: type === 'boss' ? 2.35 : 0,
      invulnerable: type === 'boss' ? 2.35 : 0,
      bossPhase: type === 'boss' ? 1 : 0,
      bossVariant: type === 'boss' ? bossVariant : -1,
      bossName: type === 'boss' ? bossProfile.name : '',
      phaseTransition: 0,
      phaseTransitionMax: 0,
      patternTimer: type === 'boss' ? .7 : 0,
      patternIndex: 0,
      side,
      skimmerIntro: type === 'skimmer' ? .95 + (options.introDelay || 0) : 0,
      skimmerIntroMax: type === 'skimmer' ? .95 + (options.introDelay || 0) : 0,
      holdY: type === 'weaver' ? random(150, Math.min(285, this.height * .42)) : 0,
      linkTargets: [],
      formation: Boolean(options.formation),
      hitTime: 0,
      recoilX: 0,
      recoilY: 0,
      dead: false,
    });
  }

  updateWeapons(dt) {
    this.weaponTimer -= dt;
    if (this.weaponTimer > 0) return;
    const weapon = this.weaponStats();
    this.weaponTimer = weapon.interval;
    let target = null;
    let best = Infinity;
    for (const enemy of this.enemies) {
      const distance = Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y);
      if (enemy.y < this.player.y + 80 && distance < best) { best = distance; target = enemy; }
    }
    const angle = target ? Math.atan2(target.y - this.player.y, target.x - this.player.x) : -Math.PI / 2;
    this.player.aim = angle;
    if (this.weapon === 'tesla') {
      this.fireTesla(weapon);
      return;
    }
    const fireGroup = (baseAngle, count, spread) => {
      for (let index = 0; index < count; index += 1) {
        const offset = (index - (count - 1) / 2) * spread;
      this.bullets.push({
        x: this.player.x,
        y: this.player.y - 8,
          vx: Math.cos(baseAngle + offset) * weapon.speed,
          vy: Math.sin(baseAngle + offset) * weapon.speed,
        radius: weapon.radius || 3.5,
        damage: weapon.damage,
        color: weapon.color,
        weapon: this.weapon,
          pierce: weapon.pierce,
          ricochet: weapon.ricochet,
          explosion: weapon.explosion,
          chainRange: weapon.chainRange,
          beamLength: weapon.beamLength,
          hitIds: new Set(),
        life: 1.5,
      });
      }
    };
    fireGroup(angle, weapon.count, weapon.spread);
    if (weapon.rearCount) fireGroup(angle + Math.PI, weapon.rearCount, .18);
  }

  fireTesla(weapon) {
    const candidates = this.enemies
      .filter(enemy => !enemy.dead && enemy.y < this.player.y + 80)
      .sort((a, b) => Math.hypot(a.x - this.player.x, a.y - this.player.y) - Math.hypot(b.x - this.player.x, b.y - this.player.y));
    if (!candidates.length) return;
    const hitIds = new Set();
    const primaries = candidates.slice(0, weapon.count);
    for (const primary of primaries) {
      if (hitIds.has(primary.id)) continue;
      hitIds.add(primary.id);
      this.teslaArcs.push({ fromPlayer: true, toId: primary.id, x1: this.player.x, y1: this.player.y - 24, x2: primary.x, y2: primary.y, life: weapon.attachDuration, maxLife: weapon.attachDuration });
      this.damageEnemy(primary, weapon.damage, false, 'tesla');
      let source = primary;
      for (let hop = 0; hop < weapon.branches; hop += 1) {
        let next = null;
        let nearest = Infinity;
        for (const enemy of this.enemies) {
          if (enemy.dead || hitIds.has(enemy.id)) continue;
          const distance = Math.hypot(enemy.x - source.x, enemy.y - source.y);
          if (distance < nearest && distance <= weapon.chainRange) { nearest = distance; next = enemy; }
        }
        if (!next) break;
        hitIds.add(next.id);
        this.teslaArcs.push({ fromId: source.id, toId: next.id, x1: source.x, y1: source.y, x2: next.x, y2: next.y, life: weapon.attachDuration, maxLife: weapon.attachDuration });
        this.damageEnemy(next, weapon.damage * Math.pow(.74, hop + 1), false, 'tesla');
        source = next;
      }
    }
  }

  updateEnemies(dt) {
    const player = this.player;
    for (const weaver of this.enemies.filter(enemy => enemy.type === 'weaver' && !enemy.dead)) {
      weaver.linkTargets = this.enemies
        .filter(enemy => enemy !== weaver && !enemy.dead && enemy.type !== 'boss' && enemy.type !== 'weaver' && Math.hypot(enemy.x - weaver.x, enemy.y - weaver.y) <= 245)
        .sort((a, b) => Math.hypot(a.x - weaver.x, a.y - weaver.y) - Math.hypot(b.x - weaver.x, b.y - weaver.y))
        .slice(0, 2)
        .map(enemy => enemy.id);
    }
    for (const enemy of this.enemies) {
      enemy.hitTime = Math.max(0, enemy.hitTime - dt);
      enemy.invulnerable = Math.max(0, (enemy.invulnerable || 0) - dt);
      enemy.x += enemy.recoilX * dt;
      enemy.y += enemy.recoilY * dt;
      const recoilDrag = Math.exp(-13 * dt);
      enemy.recoilX *= recoilDrag;
      enemy.recoilY *= recoilDrag;
      const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
      if (enemy.type === 'chaser') {
        enemy.x += Math.cos(angle) * enemy.speed * dt;
        enemy.y += Math.sin(angle) * enemy.speed * dt;
      } else if (enemy.type === 'tank') {
        enemy.y += enemy.speed * dt;
        enemy.x += Math.sin(this.time * 1.4 + enemy.phase) * 25 * dt;
      } else if (enemy.type === 'weaver') {
        enemy.y += (enemy.holdY - enemy.y) * Math.min(1, dt * 1.45);
        const center = (this.arenaLeft + this.arenaRight) / 2;
        const targetX = center + Math.sin(this.time * .72 + enemy.phase) * Math.min(230, this.arenaWidth * .3);
        enemy.x += (targetX - enemy.x) * Math.min(1, dt * 1.7);
      } else if (enemy.type === 'skimmer') {
        if (enemy.skimmerIntro > 0) {
          enemy.skimmerIntro = Math.max(0, enemy.skimmerIntro - dt);
        } else {
          enemy.x += enemy.speed * enemy.side * dt;
          enemy.y += Math.sin(this.time * 3.2 + enemy.phase) * 22 * dt;
          enemy.shoot -= dt;
          if (enemy.shoot <= 0 && enemy.x > this.arenaLeft - 10 && enemy.x < this.arenaRight + 10) {
            enemy.shoot = random(1.05, 1.45);
            const baseAngle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
            for (const offset of [-.13, .13]) {
              const shot = baseAngle + offset;
              this.enemyBullets.push({ x: enemy.x, y: enemy.y, vx: Math.cos(shot) * 270, vy: Math.sin(shot) * 270, radius: 5, life: 4, kind: 'skimmerBolt' });
            }
          }
        }
      } else if (enemy.type === 'boss') {
        this.updateBoss(enemy, dt, angle);
      } else {
        enemy.y += enemy.speed * dt;
        enemy.x += Math.sin(this.time * 2 + enemy.phase) * 55 * dt;
        enemy.shoot -= dt;
        if (enemy.shoot <= 0 && enemy.y > 40) {
          enemy.shoot = random(1.4, 2.2);
          this.enemyBullets.push({ x: enemy.x, y: enemy.y, vx: Math.cos(angle) * 235, vy: Math.sin(angle) * 235, radius: 5, life: 4 });
        }
      }

      if (circlesTouch(player, enemy)) {
        if (player.dashTime > 0) this.damageEnemy(enemy, CONFIG.dash.impactDamage, true);
        else this.hitPlayer(enemy.x, enemy.y);
      }
      if (enemy.type === 'skimmer') {
        if (enemy.skimmerIntro <= 0 && (enemy.x < this.arenaLeft - 130 || enemy.x > this.arenaRight + 130)) enemy.dead = true;
      } else if (enemy.y > this.height + 60) enemy.dead = true;
    }
    this.enemies = this.enemies.filter(enemy => !enemy.dead);
  }

  updateBoss(enemy, dt, aimAngle) {
    if (enemy.intro > 0) {
      enemy.intro = Math.max(0, enemy.intro - dt);
      enemy.y += Math.min(enemy.speed * 1.85 * dt, Math.max(0, 126 - enemy.y));
      enemy.x += ((this.arenaLeft + this.arenaRight) / 2 - enemy.x) * Math.min(1, dt * 3.2);
      if (enemy.intro === 0) {
        enemy.patternTimer = .5;
      }
      return;
    }

    const healthRatio = clamp(enemy.health / enemy.maxHealth, 0, 1);
    const nextPhase = healthRatio <= .33 ? 3 : healthRatio <= .66 ? 2 : 1;
    if (nextPhase > enemy.bossPhase) this.beginBossPhase(enemy, nextPhase);

    if (enemy.phaseTransition > 0) {
      enemy.phaseTransition = Math.max(0, enemy.phaseTransition - dt);
      enemy.x += ((this.arenaLeft + this.arenaRight) / 2 - enemy.x) * Math.min(1, dt * 2.8);
      enemy.y += (126 - enemy.y) * Math.min(1, dt * 2.8);
      return;
    }

    const amplitude = Math.min(this.arenaWidth * (enemy.bossPhase === 1 ? .25 : .32), enemy.bossPhase === 3 ? 300 : 250);
    const pace = enemy.bossPhase === 1 ? .62 : enemy.bossPhase === 2 ? .82 : 1.05;
    enemy.y += (126 + Math.sin(this.time * .9) * 8 - enemy.y) * Math.min(1, dt * 2.4);
    enemy.x = clamp((this.arenaLeft + this.arenaRight) / 2 + Math.sin(this.time * pace + enemy.phase) * amplitude, this.arenaLeft + enemy.radius, this.arenaRight - enemy.radius);
    enemy.patternTimer -= dt;
    if (enemy.patternTimer <= 0) this.scheduleBossPattern(enemy, aimAngle);
  }

  beginBossPhase(enemy, phase) {
    enemy.bossPhase = phase;
    enemy.phaseTransition = phase === 3 ? 1.35 : 1.05;
    enemy.phaseTransitionMax = enemy.phaseTransition;
    enemy.invulnerable = enemy.phaseTransition;
    enemy.patternIndex = 0;
    enemy.patternTimer = .45;
    this.enemyBullets = [];
    this.bossWarnings = [];
    this.hazards = this.hazards.filter(hazard => hazard.type !== 'wardenBeam' && !hazard.bossHazard);
    this.shake = 8;
    const profile = WARDEN_VARIANTS[enemy.bossVariant] || WARDEN_VARIANTS[3];
    this.events.haptic?.(phase === 2 ? [25, 35, 45] : [30, 25, 30, 25, 65]);
  }

  scheduleBossPattern(enemy, aimAngle) {
    const phase = enemy.bossPhase;
    const pattern = enemy.patternIndex++ % 3;
    if (phase === 1) {
      if (pattern === 1) this.addBossWarning(enemy, 'ring', { warning: .72, count: 14, speed: 178, safeAngle: aimAngle, gap: .38 });
      else if (pattern === 2) this.scheduleWardenSignature(enemy, phase);
      else this.addBossWarning(enemy, 'fan', { warning: .48, angle: aimAngle, count: 3, spread: .17, speed: 255 });
      enemy.patternTimer = pattern === 1 ? 1.55 : pattern === 2 ? 1.72 : 1.08;
      return;
    }
    if (phase === 2) {
      if (pattern === 0) this.addBossWarning(enemy, 'ring', { warning: .64, count: 17, speed: 198, safeAngle: aimAngle, gap: .31 });
      else if (pattern === 1) this.addBossWarning(enemy, 'fan', { warning: .44, angle: aimAngle, count: 4, spread: .14, speed: 275 });
      else this.scheduleWardenSignature(enemy, phase);
      enemy.patternTimer = pattern === 2 ? 1.62 : 1.12;
      return;
    }
    if (pattern === 0) this.addBossWarning(enemy, 'fan', { warning: .4, angle: aimAngle, count: 5, spread: .125, speed: 292 });
    else if (pattern === 1) this.addBossWarning(enemy, 'ring', { warning: .58, count: 20, speed: 218, safeAngle: aimAngle, gap: .25 });
    else this.scheduleWardenSignature(enemy, phase);
    enemy.patternTimer = pattern === 2 ? 1.42 : .92;
  }

  scheduleWardenSignature(enemy, phase) {
    if (enemy.bossVariant === 0) {
      const count = phase + 1;
      for (let index = 0; index < count; index += 1) {
        const angle = index / count * TAU + enemy.phase;
        const distance = phase === 1 ? 70 : 82;
        this.hazards.push({
          type: 'poison',
          x: clamp(this.player.x + Math.cos(angle) * distance, this.arenaLeft + 42, this.arenaRight - 42),
          y: clamp(this.player.y + Math.sin(angle) * distance, 145, this.height - 55),
          radius: phase === 3 ? 39 : 34,
          age: 0,
          warning: .88,
          life: phase === 3 ? 4.6 : 4.05,
          bossHazard: true,
        });
      }
      return;
    }
    if (enemy.bossVariant === 1) {
      const count = phase === 3 ? 4 : phase + 1;
      for (let index = 0; index < count; index += 1) {
        const spread = (index - (count - 1) / 2) * 66;
        this.hazards.push({
          type: 'meteor',
          x: clamp(this.player.x + spread + random(-22, 22), this.arenaLeft + 45, this.arenaRight - 45),
          y: clamp(this.player.y + random(-55, 35), 145, this.height - 55),
          radius: phase === 3 ? 46 : 41,
          age: 0,
          warning: phase === 3 ? .92 : 1.08,
          active: .34,
          life: phase === 3 ? 1.92 : 2.08,
          triggered: false,
          bossHazard: true,
        });
      }
      return;
    }
    if (enemy.bossVariant === 2) {
      const vertical = Math.abs(this.player.vx) < Math.abs(this.player.vy);
      this.hazards.push({ type: 'laserLine', vertical, position: vertical ? this.player.x : this.player.y, width: phase === 3 ? 29 : 34, age: 0, warning: phase === 3 ? .88 : 1.08, active: .42, life: phase === 3 ? 1.46 : 1.66, bossHazard: true });
      if (phase >= 2) this.hazards.push({ type: 'laserLine', vertical: !vertical, position: vertical ? this.player.y : this.player.x, width: 26, age: 0, warning: phase === 3 ? 1.02 : 1.2, active: .36, life: phase === 3 ? 1.52 : 1.7, bossHazard: true });
      return;
    }
    this.addWardenBeams(phase === 3);
  }

  addBossWarning(enemy, type, options) {
    this.bossWarnings.push({
      type,
      bossId: enemy.id,
      x: enemy.x,
      y: enemy.y,
      age: 0,
      fired: false,
      life: options.warning + .18,
      ...options,
    });
  }

  addWardenBeams(crossed) {
    const warning = crossed ? .88 : 1.02;
    const width = crossed ? 28 : 32;
    this.hazards.push({ type: 'wardenBeam', vertical: true, position: clamp(this.player.x, this.arenaLeft + 35, this.arenaRight - 35), width, age: 0, warning, active: .34, life: warning + .58 });
    if (crossed) this.hazards.push({ type: 'wardenBeam', vertical: false, position: clamp(this.player.y, 145, this.height - 55), width: 24, age: 0, warning: warning + .12, active: .32, life: warning + .7 });
  }

  updateBossWarnings(dt) {
    for (const warning of this.bossWarnings) {
      warning.age += dt;
      const boss = this.enemies.find(enemy => enemy.id === warning.bossId && !enemy.dead);
      if (boss) { warning.x = boss.x; warning.y = boss.y; }
      else warning.life = 0;
      if (!warning.fired && warning.age >= warning.warning) {
        warning.fired = true;
        if (warning.type === 'fan') {
          for (let index = 0; index < warning.count; index += 1) {
            const shot = warning.angle + (index - (warning.count - 1) / 2) * warning.spread;
            this.enemyBullets.push({ x: warning.x, y: warning.y, vx: Math.cos(shot) * warning.speed, vy: Math.sin(shot) * warning.speed, radius: 6, life: 4.4, kind: 'wardenShard' });
          }
        } else {
          for (let index = 0; index < warning.count; index += 1) {
            const shot = index / warning.count * TAU + this.time * .16;
            const gapDistance = Math.abs(Math.atan2(Math.sin(shot - warning.safeAngle), Math.cos(shot - warning.safeAngle)));
            if (gapDistance < warning.gap) continue;
            this.enemyBullets.push({ x: warning.x, y: warning.y, vx: Math.cos(shot) * warning.speed, vy: Math.sin(shot) * warning.speed, radius: 5.5, life: 5, kind: 'wardenOrb' });
          }
        }
      }
      warning.life -= dt;
    }
    this.bossWarnings = this.bossWarnings.filter(warning => warning.life > 0);
  }

  updateProjectiles(dt) {
    for (const bullet of this.bullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      for (const enemy of this.enemies) {
        if (!enemy.dead && !bullet.hitIds.has(enemy.id) && circlesTouch(bullet, enemy)) {
          bullet.hitIds.add(enemy.id);
          this.damageEnemy(enemy, bullet.damage, false, bullet.weapon);
          if (bullet.explosion > 0) {
            this.burst(enemy.x, enemy.y, bullet.color, 14, 180);
            for (const nearby of this.enemies) {
              if (nearby === enemy || nearby.dead || bullet.hitIds.has(nearby.id)) continue;
              if (Math.hypot(nearby.x - enemy.x, nearby.y - enemy.y) <= bullet.explosion + nearby.radius) {
                bullet.hitIds.add(nearby.id);
                this.damageEnemy(nearby, bullet.damage * .58, false, bullet.weapon);
              }
            }
          }

          let continued = false;
          if (bullet.ricochet > 0) {
            let target = null;
            let nearest = Infinity;
            for (const candidate of this.enemies) {
              if (candidate.dead || bullet.hitIds.has(candidate.id)) continue;
              const distance = Math.hypot(candidate.x - bullet.x, candidate.y - bullet.y);
              if (distance < nearest && distance < (bullet.chainRange || 320)) { nearest = distance; target = candidate; }
            }
            if (target) {
              const speed = Math.hypot(bullet.vx, bullet.vy);
              const angle = Math.atan2(target.y - bullet.y, target.x - bullet.x);
              bullet.vx = Math.cos(angle) * speed;
              bullet.vy = Math.sin(angle) * speed;
              bullet.ricochet -= 1;
              continued = true;
            }
          }
          if (!continued && bullet.pierce > 0) { bullet.pierce -= 1; continued = true; }
          if (!continued) bullet.life = 0;
          break;
        }
      }
    }
    for (const bullet of this.enemyBullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      if (circlesTouch(bullet, this.player)) { this.hitPlayer(bullet.x, bullet.y); bullet.life = 0; }
    }
    const visible = bullet => bullet.life > 0 && bullet.x > -50 && bullet.x < this.width + 50 && bullet.y > -50 && bullet.y < this.height + 50;
    this.bullets = this.bullets.filter(visible);
    this.enemyBullets = this.enemyBullets.filter(visible);
  }

  damageEnemy(enemy, damage, dashed, impactType = null) {
    if (enemy.type === 'boss' && enemy.invulnerable > 0) {
      enemy.hitTime = .08;
      if (impactType && WEAPON_ASSET_FILES[impactType]) this.addWeaponImpact(enemy.x, enemy.y, impactType, damage * .35);
      return;
    }
    const protector = enemy.type === 'boss' || enemy.type === 'weaver'
      ? null
      : this.enemies.find(candidate => candidate.type === 'weaver' && !candidate.dead && candidate.linkTargets?.includes(enemy.id));
    if (protector) {
      damage *= .32;
      this.burst(enemy.x, enemy.y, '#62f7c6', 5, 75);
    }
    enemy.health -= damage;
    const recoilDistance = Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y) || 1;
    const recoilForce = enemy.type === 'boss' ? 34 : enemy.type === 'tank' || enemy.type === 'weaver' ? 52 : enemy.type === 'shooter' ? 72 : 108;
    enemy.recoilX += (enemy.x - this.player.x) / recoilDistance * recoilForce;
    enemy.recoilY += (enemy.y - this.player.y) / recoilDistance * recoilForce;
    enemy.hitTime = enemy.type === 'boss' ? .18 : enemy.type === 'tank' ? .15 : .13;
    if (impactType && WEAPON_ASSET_FILES[impactType]) this.addWeaponImpact(enemy.x, enemy.y, impactType, damage);
    this.burst(enemy.x, enemy.y, enemy.color, dashed ? 14 : 4, dashed ? 280 : 100);
    if (enemy.health > 0 || enemy.dead) return;
    enemy.dead = true;
    this.addDeathAnimation(enemy);
    this.combo = Math.min(9, Math.floor(this.combo + this.modifiers.comboGain));
    this.runStats.enemies += 1;
    this.runStats.bestCombo = Math.max(this.runStats.bestCombo, Math.floor(this.combo));
    this.comboTimer = CONFIG.comboWindow * this.modifiers.comboWindow;
    this.score += enemy.value * this.combo * (dashed ? 1.5 : 1) * CONFIG.difficulties[this.difficulty].score * this.modifiers.score;
    this.shake = enemy.type === 'boss' ? 16 : dashed ? 7 : enemy.type === 'tank' || enemy.type === 'weaver' ? 6 : 2;
    this.burst(enemy.x, enemy.y, enemy.color, enemy.type === 'boss' ? 60 : enemy.type === 'tank' || enemy.type === 'weaver' ? 24 : 12, enemy.type === 'boss' ? 360 : 210);
    this.events.combo?.();
    if (enemy.type !== 'boss' && this.stageIndex % CONFIG.stages.length === 0 && Math.random() < .38) {
      this.hazards.push({ type: 'poison', x: enemy.x, y: enemy.y, radius: enemy.elite ? 48 : 36, age: 0, warning: .65, life: 5.15 });
    }
    if (enemy.elite === 'volatile') {
      for (let index = 0; index < 8; index += 1) {
        const angle = index / 8 * TAU;
        this.enemyBullets.push({ x: enemy.x, y: enemy.y, vx: Math.cos(angle) * 175, vy: Math.sin(angle) * 175, radius: 5, life: 3.2 });
      }
    } else if (enemy.elite === 'splitter' && enemy.type !== 'boss') {
      for (const offset of [-15, 15]) {
        const before = this.enemies.length;
        this.spawnEnemy('chaser');
        const child = this.enemies[before];
        child.x = enemy.x + offset; child.y = enemy.y; child.elite = null; child.radius = 10; child.health = .8; child.maxHealth = .8; child.value = 70;
      }
    }
    if (enemy.type === 'boss') {
      this.runStats.wardens += 1;
      this.enemyBullets = [];
      this.bossWarnings = [];
      this.hazards = this.hazards.filter(hazard => hazard.type !== 'wardenBeam' && !hazard.bossHazard);
      this.events.haptic?.([35, 30, 35, 30, 80]);
      this.events.sfx?.('boss');
      this.offerPerks();
    }
  }

  hitPlayer(x, y) {
    const player = this.player;
    if (player.invulnerable > 0 || player.dashTime > 0) return;
    player.health -= 1;
    player.invulnerable = CONFIG.player.hitInvulnerability;
    player.vx += Math.sign(player.x - x || 1) * 260;
    player.vy += Math.sign(player.y - y || 1) * 260;
    this.combo = 1;
    this.comboTimer = 0;
    this.flash = 1;
    this.shake = 14;
    this.events.haptic?.([30, 30, 45]);
    this.events.sfx?.('hit');
    this.burst(player.x, player.y, '#ffffff', 28, 300);
    if (player.health <= 0) {
      this.active = false;
      this.events.gameover?.(Math.floor(this.score), this.runSummary());
    }
  }

  updatePickups(dt) {
    for (const pickup of this.pickups) {
      pickup.life -= dt;
      if (pickup.collected) {
        pickup.openTime += dt;
        continue;
      }
      const magnetDistance = this.modifiers.pickupRange;
      if (magnetDistance > 0) {
        const dx = this.player.x - pickup.x;
        const dy = this.player.y - pickup.y;
        const distance = Math.hypot(dx, dy);
        if (distance > 1 && distance < magnetDistance) {
          const pull = 190 + magnetDistance * .35;
          pickup.x += dx / distance * pull * dt;
          pickup.y += dy / distance * pull * dt;
        }
      }
      pickup.y += pickup.vy * dt;
      if (circlesTouch(pickup, this.player)) {
        const previousLevel = this.weaponLevels[pickup.weapon];
        this.weaponLevels[pickup.weapon] = Math.min(5, previousLevel + 1);
        this.weapon = pickup.weapon;
        this.weaponTimer = 0;
        pickup.collected = true;
        pickup.openTime = 0;
        pickup.life = .48;
        this.score += 250;
        this.runStats.crates += 1;
        const weapon = CONFIG.weapons[this.weapon];
        this.burst(pickup.x, pickup.y, weapon.color, 20, 190);
        const level = this.weaponLevels[this.weapon];
        const prefix = previousLevel > 0 ? 'UPGRADED' : 'NEW WEAPON';
        this.events.toast?.(`${prefix} · ${weapon.name} MK ${level}`, 'weapon', weapon.color);
        this.events.haptic?.([18, 25, 30]);
        this.events.sfx?.('pickup');
      }
    }
    this.pickups = this.pickups.filter(pickup => pickup.life > 0 && pickup.y < this.height + 40);
  }

  offerPerks() {
    if (this.awaitingPerk) return;
    if (typeof this.events.perk !== 'function') {
      this.events.toast?.('PERK INTERFACE MISSING · RUN CONTINUES', 'critical');
      return;
    }
    const eligible = CONFIG.perks.filter(perk => this.perkCounts[perk.key] < perk.maxStacks);
    if (!eligible.length) return;
    const cursed = eligible.filter(perk => perk.cursed).sort(() => Math.random() - .5);
    const normal = eligible.filter(perk => !perk.cursed).sort(() => Math.random() - .5);
    const choices = cursed.length && normal.length >= 2 ? [...normal.slice(0, 2), cursed[0]].sort(() => Math.random() - .5) : [...eligible].sort(() => Math.random() - .5).slice(0, 3);
    this.offeredPerks = choices.map(perk => perk.key);
    this.awaitingPerk = true;
    this.shake = 0;
    try {
      this.events.perk(choices.map(perk => ({ ...perk, stack: this.perkCounts[perk.key] + 1 })));
      this.active = false;
    } catch (error) {
      console.error('Could not open perk selection', error);
      this.awaitingPerk = false;
      this.offeredPerks = [];
      this.active = true;
    }
  }

  selectPerk(key) {
    if (!this.awaitingPerk) return false;
    const perk = CONFIG.perks.find(item => item.key === key);
    if (!perk || !this.offeredPerks?.includes(key) || this.perkCounts[key] >= perk.maxStacks) return false;
    this.perkCounts[key] += 1;
    if (key === 'quickstep') this.modifiers.dashCooldown *= .82;
    else if (key === 'royalHeart') {
      this.modifiers.maxHealthBonus += 1;
      this.player.health += 1;
    } else if (key === 'magnet') this.modifiers.pickupRange += 135;
    else if (key === 'overclock') this.modifiers.fireRate *= .85;
    else if (key === 'heavyCrown') { this.modifiers.damage *= 1.22; this.modifiers.movement *= .93; }
    else if (key === 'velocity') this.modifiers.movement *= 1.12;
    else if (key === 'comboKeeper') this.modifiers.comboWindow *= 1.4;
    else if (key === 'royalFavor') this.modifiers.score *= 1.15;
    else if (key === 'glassCrown') {
      this.modifiers.score *= 2;
      this.modifiers.maxHealthBonus -= 1;
      this.player.health = Math.max(1, Math.min(this.player.health, CONFIG.difficulties[this.difficulty].health + this.modifiers.maxHealthBonus));
    } else if (key === 'cursedOverdrive') {
      this.modifiers.fireRate *= .54;
      this.modifiers.enemyPressure *= 1.28;
    } else if (key === 'royalDebt') {
      this.modifiers.comboGain = 2;
      this.modifiers.bossHealth *= 1.65;
    }
    this.awaitingPerk = false;
    this.offeredPerks = [];
    this.active = true;
    this.events.perkApplied?.(perk, this.perkCounts[key]);
    this.events.haptic?.([18, 24, 35]);
    this.events.sfx?.('perk');
    return true;
  }

  burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = random(0, TAU);
      const velocity = random(speed * .25, speed);
      this.particles.push({ x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity, radius: random(1.2, 3.5), life: random(.25, .65), maxLife: .65, color });
    }
  }

  addWeaponImpact(x, y, type, damage = 1) {
    const profile = {
      blaster: { size: 36, life: .17 },
      spread: { size: 42, life: .2 },
      pulse: { size: 66, life: .3 },
      laser: { size: 52, life: .14 },
      tesla: { size: 58, life: .22 },
    }[type];
    const maxLife = profile.life;
    this.impactFlashes.push({
      x, y, type,
      size: profile.size * clamp(.82 + damage * .13, .85, 1.35),
      rotation: random(0, TAU),
      life: maxLife,
      maxLife,
    });
    this.impactFlashes = this.impactFlashes.slice(-90);
  }

  addDeathAnimation(enemy) {
    const boss = enemy.type === 'boss';
    const maxLife = boss ? 1.35 : enemy.type === 'tank' || enemy.type === 'weaver' ? .82 : .62;
    this.deathAnimations.push({
      x: enemy.x,
      y: enemy.y,
      type: enemy.type,
      elite: enemy.elite,
      side: enemy.side,
      bossVariant: enemy.bossVariant,
      rotation: random(-.12, .12),
      spin: random(-.7, .7) * (boss ? .25 : 1),
      vx: enemy.recoilX * .28,
      vy: enemy.recoilY * .28 + (boss ? 8 : 18),
      life: maxLife,
      maxLife,
    });
    this.deathAnimations = this.deathAnimations.slice(-70);
  }

  updateEffects(dt) {
    for (const particle of this.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.exp(-4 * dt);
      particle.vy *= Math.exp(-4 * dt);
      particle.life -= dt;
    }
    for (const trail of this.trails) trail.life -= dt;
    for (const arc of this.teslaArcs) arc.life -= dt;
    for (const impact of this.impactFlashes) impact.life -= dt;
    for (const death of this.deathAnimations) {
      death.x += death.vx * dt;
      death.y += death.vy * dt;
      death.rotation += death.spin * dt;
      death.vx *= Math.exp(-3.5 * dt);
      death.vy *= Math.exp(-3.5 * dt);
      death.life -= dt;
    }
    this.player.poisonSplash = Math.max(0, this.player.poisonSplash - dt);
    this.particles = this.particles.filter(particle => particle.life > 0).slice(-600);
    this.trails = this.trails.filter(trail => trail.life > 0);
    this.teslaArcs = this.teslaArcs.filter(arc => arc.life > 0).slice(-40);
    this.impactFlashes = this.impactFlashes.filter(impact => impact.life > 0);
    this.deathAnimations = this.deathAnimations.filter(death => death.life > 0);
  }

  render() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#050b11';
    ctx.fillRect(0, 0, this.width, this.height);
    this.drawBackground(ctx);
    const shake = this.reducedEffects ? this.shake * .18 : this.shake;
    const shakeX = shake ? random(-shake, shake) : 0;
    const shakeY = shake ? random(-shake, shake) : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);
    this.drawHazards(ctx);
    this.drawThreatWarnings(ctx);
    this.drawBossWarnings(ctx);
    this.drawTrails(ctx);
    this.drawPickups(ctx);
    this.drawProjectiles(ctx);
    this.drawWeaverLinks(ctx);
    this.drawEnemies(ctx);
    this.drawDeathAnimations(ctx);
    this.drawWeaponImpacts(ctx);
    this.drawTeslaArcs(ctx);
    this.drawPlayer(ctx);
    this.drawPoisonStatus(ctx);
    this.drawParticles(ctx);
    ctx.restore();
    this.drawBossPresentation(ctx);
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255, 70, 100, ${this.flash * (this.reducedEffects ? .04 : .15)})`;
      ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  drawBackground(ctx) {
    const stage = this.stageInfo();
    const palette = stage.palette;
    const gradient = ctx.createRadialGradient(this.width * .5, this.height * .75, 0, this.width * .5, this.height * .55, Math.max(this.width, this.height));
    gradient.addColorStop(0, palette.center);
    gradient.addColorStop(.48, palette.mid);
    gradient.addColorStop(1, palette.edge);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);

    // Flera lager rör sig olika fort och ger banan djup utan tunga bakgrundsbilder.
    const shift = (this.player.x - this.width * .5) * .08;
    ctx.fillStyle = palette.stars;
    for (const star of this.stars) {
      const depth = clamp(star.speed / .06, .15, 1);
      const x = ((star.x * this.width - shift * depth) % this.width + this.width) % this.width;
      ctx.globalAlpha = .14 + depth * .38;
      ctx.fillRect(Math.round(x), Math.round(star.y * this.height), Math.max(1, Math.round(star.size * depth)), Math.max(1, Math.round(star.size * depth)));
    }
    ctx.globalAlpha = 1;

    this.drawScenery(ctx, stage, shift);

    // Ett plant, parallellt lager under spelobjekten – ingen horisont eller perspektivflykt.
    ctx.save();
    ctx.beginPath(); ctx.rect(this.arenaLeft, 0, this.arenaWidth, this.height); ctx.clip();
    ctx.strokeStyle = palette.grid; ctx.lineWidth = 1; ctx.globalAlpha = .025;
    const tile = 112;
    const offsetY = (this.time * 7) % tile;
    const offsetX = ((-shift * .22) % tile + tile) % tile;
    for (let x = this.arenaLeft + offsetX - tile; x < this.arenaRight + tile; x += tile) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.height); ctx.stroke();
    }
    for (let y = offsetY - tile; y < this.height + tile; y += tile) {
      ctx.beginPath(); ctx.moveTo(this.arenaLeft, y); ctx.lineTo(this.arenaRight, y); ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    if (this.arenaLeft > 0) {
      ctx.fillStyle = 'rgba(1, 5, 9, .52)';
      ctx.fillRect(0, 0, this.arenaLeft, this.height);
      ctx.fillRect(this.arenaRight, 0, this.width - this.arenaRight, this.height);
      ctx.strokeStyle = palette.grid;
      ctx.globalAlpha = .12;
      ctx.beginPath(); ctx.moveTo(this.arenaLeft, 0); ctx.lineTo(this.arenaLeft, this.height); ctx.moveTo(this.arenaRight, 0); ctx.lineTo(this.arenaRight, this.height); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  drawScenery(ctx, stage, shift) {
    const zone = this.stageIndex % CONFIG.stages.length;
    const zoneSprites = this.loadEnvironmentSprites(zone);
    ctx.save();
    ctx.beginPath(); ctx.rect(this.arenaLeft, 0, this.arenaWidth, this.height); ctx.clip();
    const layeredObjects = [...this.scenery].sort((a, b) => a.depth - b.depth);
    for (const object of layeredObjects) {
      const scale = .45 + object.depth * .9;
      const x = this.arenaLeft + object.x * this.arenaWidth - shift * object.depth;
      const y = object.y * this.height;
      const size = object.size * scale;
      ctx.save();
      ctx.translate(x, y);
      const decal = object.variant % 2 === 0;
      ctx.rotate(this.time * (decal ? .002 : .006) * object.spin * object.depth + object.variant + object.x * TAU);
      const sprite = zoneSprites[decal ? 0 : 1];
      if (sprite?.complete && sprite.naturalWidth) {
        const targetWidth = size * (decal ? 5.7 : 3.35);
        const targetHeight = targetWidth / (sprite.naturalWidth / sprite.naturalHeight);
        ctx.globalAlpha = decal ? .075 + object.depth * .13 : .11 + object.depth * .22;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sprite, -targetWidth / 2, -targetHeight / 2, targetWidth, targetHeight);
        ctx.restore();
        continue;
      }
      ctx.globalAlpha = .035 + object.depth * .115;
      ctx.strokeStyle = stage.palette.grid;
      ctx.fillStyle = stage.palette.mid;
      ctx.lineWidth = Math.max(1, Math.round(object.depth * 2));
      if (zone === 0) {
        ctx.beginPath();
        for (let corner = 0; corner < 6; corner += 1) {
          const angle = corner / 6 * TAU;
          const radius = size * (corner % 2 ? .68 : 1);
          const px = Math.cos(angle) * radius;
          const py = Math.sin(angle) * radius;
          if (!corner) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, size * .38, 0, TAU); ctx.stroke();
      } else if (zone === 1) {
        ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(size * .65, -size * .12); ctx.lineTo(size * .3, size); ctx.lineTo(-size * .75, size * .45); ctx.lineTo(-size * .55, -size * .35); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.globalAlpha *= 1.8; ctx.beginPath(); ctx.moveTo(-size * .2, -size * .45); ctx.lineTo(size * .12, 0); ctx.lineTo(-size * .05, size * .55); ctx.stroke();
      } else if (zone === 2) {
        ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(size * .48, 0); ctx.lineTo(0, size); ctx.lineTo(-size * .48, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(0, size); ctx.moveTo(-size * .48, 0); ctx.lineTo(size * .48, 0); ctx.stroke();
      } else {
        ctx.fillRect(-size * .55, -size * .7, size * 1.1, size * 1.4);
        ctx.strokeRect(-size * .55, -size * .7, size * 1.1, size * 1.4);
        ctx.beginPath(); ctx.moveTo(-size * .7, -size * .7); ctx.lineTo(-size * .48, -size * 1.08); ctx.lineTo(0, -size * .72); ctx.lineTo(size * .48, -size * 1.08); ctx.lineTo(size * .7, -size * .7); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  drawPlayer(ctx) {
    const player = this.player;
    if (player.invulnerable > 0 && Math.floor(player.invulnerable * 16) % 2 === 0) ctx.globalAlpha = .35;
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.aim + Math.PI / 2);
    const sprite = this.sprites.player;
    if (sprite?.complete && sprite.naturalWidth) {
      ctx.imageSmoothingEnabled = false;
      const spriteRatio = sprite.naturalWidth / sprite.naturalHeight;
      const playerHeight = 96;
      const playerWidth = Math.min(96, Math.max(80, playerHeight * spriteRatio));
      if (player.dashTime > 0) {
        ctx.globalAlpha *= .32;
        ctx.drawImage(sprite, -playerWidth * .56, -54, playerWidth * 1.12, 108);
        ctx.globalAlpha /= .32;
      }
      const [weaponMount] = this.loadWeaponFx(this.weapon);
      const mountProfile = {
        blaster: { width: 40, y: -31 }, spread: { width: 44, y: -31 }, pulse: { width: 37, y: -27 }, laser: { width: 30, y: -31 }, tesla: { width: 43, y: -25 },
      }[this.weapon];
      ctx.drawImage(sprite, -playerWidth / 2, -49, playerWidth, playerHeight);
      if (weaponMount?.complete && weaponMount.naturalWidth) {
        const mountHeight = mountProfile.width / (weaponMount.naturalWidth / weaponMount.naturalHeight);
        ctx.drawImage(weaponMount, -mountProfile.width / 2, mountProfile.y - mountHeight / 2, mountProfile.width, mountHeight);
      }
      if (!weaponMount?.complete || !weaponMount.naturalWidth) {
        ctx.fillStyle = CONFIG.weapons[this.weapon].color;
        ctx.fillRect(-3, -50, 6, 24);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      return;
    }
    const glow = player.dashTime > 0 ? 28 : 14;
    ctx.shadowBlur = glow;
    ctx.shadowColor = '#6fffd2';

    // Svängd ödlesvans och bakvingar ger skeppet en tydlig siluett.
    ctx.strokeStyle = player.dashTime > 0 ? '#b9ffeb' : '#238d78';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 15); ctx.bezierCurveTo(8, 26, -11, 31, -3, 41); ctx.stroke();
    ctx.fillStyle = '#276f65';
    ctx.beginPath(); ctx.moveTo(-7, 10); ctx.lineTo(-25, 23); ctx.lineTo(-17, 2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(7, 10); ctx.lineTo(25, 23); ctx.lineTo(17, 2); ctx.closePath(); ctx.fill();

    // Pansrad kropp med ödlehuvud/cockpit.
    ctx.fillStyle = '#dffff5';
    ctx.beginPath();
    ctx.moveTo(0, -28); ctx.bezierCurveTo(15, -20, 17, 3, 10, 20); ctx.lineTo(0, 25); ctx.lineTo(-10, 20); ctx.bezierCurveTo(-17, 3, -15, -20, 0, -28); ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#15443f';
    ctx.beginPath(); ctx.ellipse(0, -7, 10, 13, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#9dffe2';
    ctx.beginPath(); ctx.ellipse(0, -10, 6, 8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#071417';
    ctx.beginPath(); ctx.ellipse(-3, -13, 1.5, 3, -.2, 0, TAU); ctx.ellipse(3, -13, 1.5, 3, .2, 0, TAU); ctx.fill();

    // Kronan sitter på nosen och är alltid läsbar.
    ctx.fillStyle = '#ffd36b';
    ctx.beginPath();
    ctx.moveTo(-9, -23); ctx.lineTo(-7, -34); ctx.lineTo(-2, -27); ctx.lineTo(2, -36); ctx.lineTo(7, -27); ctx.lineTo(10, -34); ctx.lineTo(9, -21); ctx.closePath(); ctx.fill();

    // Vapnet syns på själva skeppet, inte bara i projektilerna.
    if (this.weapon === 'spread') {
      ctx.fillStyle = '#ffd36b';
      for (const x of [-15, 0, 15]) { this.roundRect(ctx, x - 2.5, -18, 5, 16, 3); ctx.fill(); }
    } else if (this.weapon === 'pulse') {
      ctx.strokeStyle = '#ff8ddb'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, -24, 8, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#fff0fb'; ctx.beginPath(); ctx.arc(0, -24, 3, 0, TAU); ctx.fill();
    } else if (this.weapon === 'laser') {
      ctx.fillStyle = '#d9fbff'; ctx.fillRect(-4, -40, 8, 27);
      ctx.fillStyle = '#63e8ff'; ctx.fillRect(-1, -47, 2, 35);
    } else if (this.weapon === 'tesla') {
      ctx.strokeStyle = '#b99cff'; ctx.lineWidth = 3;
      for (const x of [-14, 14]) { ctx.beginPath(); ctx.arc(x, -22, 6, 0, TAU); ctx.stroke(); }
      ctx.fillStyle = '#f3eaff'; ctx.fillRect(-2, -31, 4, 13);
    } else {
      ctx.fillStyle = '#6fffd2';
      for (const x of [-13, 13]) { this.roundRect(ctx, x - 2.5, -18, 5, 18, 3); ctx.fill(); }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  drawEnemies(ctx) {
    for (const enemy of this.enemies) {
      ctx.save(); ctx.translate(enemy.x, enemy.y);
      if (enemy.type === 'skimmer') {
        if (enemy.side < 0) ctx.scale(-1, 1);
        ctx.rotate(Math.sin(this.time * 3 + enemy.phase) * .025);
      } else ctx.rotate(Math.sin(this.time * 2 + enemy.phase) * .15);
      const hit = clamp(enemy.hitTime / (enemy.type === 'boss' ? .18 : enemy.type === 'tank' ? .15 : .13), 0, 1);
      const idle = Math.sin(this.time * (enemy.type === 'shooter' ? 8 : enemy.type === 'chaser' ? 6 : 3) + enemy.phase);
      if (enemy.type === 'chaser') {
        ctx.rotate(hit * idle * .22);
        ctx.scale(1 + hit * .2, 1 - hit * .22 + idle * .025);
      } else if (enemy.type === 'shooter') {
        ctx.scale(1 - hit * .25 + idle * .04, 1 + hit * .15 - idle * .02);
      } else if (enemy.type === 'tank') {
        ctx.translate(hit * Math.sin(this.time * 95) * 3, 0);
        ctx.scale(1 + idle * .012, 1 - idle * .012);
      } else if (enemy.type === 'weaver') {
        ctx.scale(1 + idle * .018 - hit * .08, 1 - idle * .018 + hit * .12);
      } else if (enemy.type === 'skimmer') {
        ctx.translate(0, hit * Math.sin(this.time * 110) * 2);
        ctx.scale(1 + hit * .08, 1 - hit * .1);
      } else {
        ctx.scale(1 + hit * .075 + idle * .012, 1 + hit * .075 - idle * .012);
      }
      if (enemy.elite) {
        const eliteColors = { swift: '#6fffd2', armored: '#ffd36b', splitter: '#d99cff', volatile: '#ff587b' };
        ctx.strokeStyle = eliteColors[enemy.elite]; ctx.lineWidth = 3; ctx.globalAlpha = .75; ctx.shadowBlur = 14; ctx.shadowColor = eliteColors[enemy.elite];
        ctx.beginPath(); ctx.arc(0, 0, enemy.radius + 8 + Math.sin(this.time * 5) * 2, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      }
      const sprite = enemy.type === 'boss' ? this.sprites[`boss-${enemy.bossVariant}`] : this.sprites[enemy.type];
      if (sprite?.complete && sprite.naturalWidth) {
        ctx.imageSmoothingEnabled = false;
        const size = ENEMY_DRAW_SIZES[enemy.type];
        if (hit > 0) ctx.filter = `brightness(${1 + hit * 2.2}) saturate(${1 - hit * .65})`;
        ctx.drawImage(sprite, -size.width / 2, -size.height / 2, size.width, size.height);
        ctx.filter = 'none';
        if (enemy.maxHealth > 3 && (enemy.health < enemy.maxHealth || enemy.type === 'boss')) {
          const barWidth = enemy.type === 'boss' ? 112 : enemy.radius * 2;
          const barY = -size.height / 2 - 8;
          ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(-barWidth / 2, barY, barWidth, 4);
          ctx.fillStyle = enemy.type === 'boss' ? '#ffd36b' : '#ffffff'; ctx.fillRect(-barWidth / 2, barY, barWidth * clamp(enemy.health / enemy.maxHealth, 0, 1), 4);
        }
        ctx.restore();
        continue;
      }
      ctx.shadowBlur = 15; ctx.shadowColor = enemy.color; ctx.fillStyle = enemy.color;
      if (enemy.type === 'boss') {
        // Warden: zonens krönta väktare, byggd som en massiv pixelödla.
        ctx.fillStyle = enemy.color;
        ctx.beginPath(); ctx.moveTo(0, -46); ctx.lineTo(-15, -28); ctx.lineTo(-42, -34); ctx.lineTo(-34, -9); ctx.lineTo(-50, 12); ctx.lineTo(-27, 17); ctx.lineTo(-20, 42); ctx.lineTo(0, 30); ctx.lineTo(20, 42); ctx.lineTo(27, 17); ctx.lineTo(50, 12); ctx.lineTo(34, -9); ctx.lineTo(42, -34); ctx.lineTo(15, -28); ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#160f19'; ctx.beginPath(); ctx.moveTo(-24, -16); ctx.lineTo(0, -31); ctx.lineTo(24, -16); ctx.lineTo(15, 18); ctx.lineTo(0, 28); ctx.lineTo(-15, 18); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff2c7'; ctx.fillRect(-18, -17, 8, 6); ctx.fillRect(10, -17, 8, 6);
        ctx.fillStyle = '#ffd36b'; ctx.beginPath(); ctx.moveTo(-22, -39); ctx.lineTo(-18, -57); ctx.lineTo(-7, -45); ctx.lineTo(0, -62); ctx.lineTo(8, -45); ctx.lineTo(19, -57); ctx.lineTo(23, -38); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ff587b'; ctx.fillRect(-5, 4, 10, 23);
      } else if (enemy.type === 'chaser') {
        // Ripper: ett snabbt, rött käkmonster.
        ctx.beginPath(); ctx.moveTo(0, 18); ctx.lineTo(-17, -9); ctx.lineTo(-8, -6); ctx.lineTo(-13, -19); ctx.lineTo(0, -12); ctx.lineTo(13, -19); ctx.lineTo(8, -6); ctx.lineTo(17, -9); ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0; ctx.fillStyle = '#35101b'; ctx.beginPath(); ctx.moveTo(-9, 2); ctx.quadraticCurveTo(0, 12, 9, 2); ctx.quadraticCurveTo(0, 7, -9, 2); ctx.fill();
        ctx.fillStyle = '#fff2dd';
        for (const x of [-6, -2, 2, 6]) { ctx.beginPath(); ctx.moveTo(x - 2, 3); ctx.lineTo(x, 8); ctx.lineTo(x + 2, 3); ctx.fill(); }
        ctx.fillStyle = '#ffe66d'; ctx.beginPath(); ctx.arc(0, -6, 3.5, 0, TAU); ctx.fill();
      } else if (enemy.type === 'tank') {
        // Iron Scarab: stor segmenterad skalbagge med tung rustning.
        ctx.beginPath(); ctx.ellipse(0, 0, 25, 31, 0, 0, TAU); ctx.fill();
        ctx.shadowBlur = 0; ctx.strokeStyle = '#6e2c20'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -27); ctx.lineTo(0, 26); ctx.stroke();
        ctx.strokeStyle = '#ffd095'; ctx.lineWidth = 2;
        for (const y of [-15, 0, 15]) { ctx.beginPath(); ctx.moveTo(-21, y); ctx.quadraticCurveTo(0, y + 6, 21, y); ctx.stroke(); }
        ctx.fillStyle = '#2d1714';
        for (const side of [-1, 1]) { ctx.fillRect(side * 23 - 4, -17, 8, 13); ctx.fillRect(side * 24 - 4, 7, 8, 13); }
        ctx.fillStyle = '#fff0be'; ctx.beginPath(); ctx.arc(-7, -15, 3, 0, TAU); ctx.arc(7, -15, 3, 0, TAU); ctx.fill();
      } else {
        // Hex Moth: breda lila vingar och ett tydligt skjutande öga.
        ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(-30, -7); ctx.lineTo(-17, 7); ctx.lineTo(-26, 19); ctx.lineTo(-5, 13); ctx.lineTo(0, 22); ctx.lineTo(5, 13); ctx.lineTo(26, 19); ctx.lineTo(17, 7); ctx.lineTo(30, -7); ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0; ctx.fillStyle = '#50295f';
        ctx.beginPath(); ctx.moveTo(-23, -5); ctx.lineTo(-10, 2); ctx.lineTo(-19, 12); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(23, -5); ctx.lineTo(10, 2); ctx.lineTo(19, 12); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#180d21'; ctx.beginPath(); ctx.ellipse(0, 1, 8, 13, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#f7dcff'; ctx.beginPath(); ctx.arc(0, -2, 4, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffbf69'; this.roundRect(ctx, -3, 10, 6, 17, 3); ctx.fill();
      }
      ctx.shadowBlur = 0;
      if (enemy.maxHealth > 3 && (enemy.health < enemy.maxHealth || enemy.type === 'boss')) {
        ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(-enemy.radius, -enemy.radius - 9, enemy.radius * 2, 3);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(-enemy.radius, -enemy.radius - 9, enemy.radius * 2 * clamp(enemy.health / enemy.maxHealth, 0, 1), 3);
      }
      ctx.restore();
    }
  }

  drawDeathAnimations(ctx) {
    for (const death of this.deathAnimations) {
      const sprite = this.loadEnemyDeathSprite(death.type, death.bossVariant);
      const size = ENEMY_DRAW_SIZES[death.type];
      const progress = 1 - death.life / death.maxLife;
      const fade = clamp(death.life / (death.type === 'boss' ? .65 : .28), 0, 1);
      const settle = death.type === 'boss' ? .82 + Math.sin(progress * Math.PI) * .18 : .72 + Math.sin(progress * Math.PI) * .3;
      ctx.save();
      ctx.translate(death.x, death.y);
      ctx.rotate(death.rotation);
      if (death.type === 'skimmer' && death.side < 0) ctx.scale(-1, 1);
      ctx.scale(settle, settle);
      ctx.globalAlpha = fade;
      ctx.imageSmoothingEnabled = false;
      if (sprite?.complete && sprite.naturalWidth) {
        const wreckWidth = size.width * (death.type === 'boss' ? 1.18 : 1.28);
        const wreckHeight = wreckWidth * sprite.naturalHeight / sprite.naturalWidth;
        ctx.drawImage(sprite, -wreckWidth / 2, -wreckHeight / 2, wreckWidth, wreckHeight);
      } else {
        ctx.fillStyle = death.type === 'boss' ? '#ffd36b' : death.type === 'tank' ? '#ff9b64' : death.type === 'weaver' ? '#62f7c6' : death.type === 'skimmer' ? '#ff65df' : death.type === 'shooter' ? '#d99cff' : '#ff587b';
        ctx.fillRect(-size.width * .35, -3, size.width * .7, 6);
        ctx.fillRect(-3, -size.height * .35, 6, size.height * .7);
      }
      if (progress < .22) {
        ctx.globalAlpha = (1 - progress / .22) * .7;
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(0, 0, size.width * (.42 + progress), 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  }

  drawProjectiles(ctx) {
    for (const bullet of this.bullets) {
      const angle = Math.atan2(bullet.vy, bullet.vx);
      ctx.save(); ctx.translate(bullet.x, bullet.y); ctx.rotate(angle); ctx.fillStyle = bullet.color; ctx.shadowBlur = bullet.weapon === 'pulse' ? 22 : 12; ctx.shadowColor = bullet.color;
      if (bullet.weapon === 'pulse') {
        ctx.beginPath(); ctx.arc(0, 0, bullet.radius + 3, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#fff0fb'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, bullet.radius + 7 + Math.sin(this.time * 14) * 2, 0, TAU); ctx.stroke();
      } else if (bullet.weapon === 'laser') {
        const length = bullet.beamLength || 34;
        ctx.fillStyle = 'rgba(217,251,255,.45)'; ctx.fillRect(-length, -4, length + 10, 8);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(-length, -1.5, length + 12, 3);
      } else if (bullet.weapon === 'tesla') {
        ctx.strokeStyle = bullet.color; ctx.lineWidth = 4; ctx.lineJoin = 'miter';
        ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-8, -5); ctx.lineTo(-2, 4); ctx.lineTo(4, -4); ctx.lineTo(11, 2); ctx.lineTo(16, 0); ctx.stroke();
        ctx.fillStyle = '#ffffff'; ctx.fillRect(-2, -2, 4, 4);
      } else if (bullet.weapon === 'spread') {
        ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, -4); ctx.lineTo(-3, 0); ctx.lineTo(-5, 4); ctx.closePath(); ctx.fill();
      } else {
        this.roundRect(ctx, -10, -2.5, 20, 5, 3); ctx.fill();
        ctx.globalAlpha = .35; ctx.fillRect(-22, -1, 12, 2);
      }
      ctx.restore();
    }
    ctx.shadowBlur = 0;
    for (const bullet of this.enemyBullets) {
      ctx.save(); ctx.translate(bullet.x, bullet.y); ctx.rotate(this.time * (bullet.kind ? 6 : 4));
      ctx.fillStyle = bullet.kind === 'wardenOrb' ? '#ff587b' : bullet.kind === 'skimmerBolt' ? '#63e8ff' : '#ffbf69';
      ctx.shadowBlur = bullet.kind ? 18 : 12; ctx.shadowColor = bullet.kind === 'wardenOrb' ? '#ff587b' : bullet.kind === 'skimmerBolt' ? '#ff65df' : '#ffd36b';
      if (bullet.kind === 'wardenShard') {
        ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(6, 5); ctx.lineTo(0, 2); ctx.lineTo(-6, 5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff4c7'; ctx.fillRect(-2, -5, 4, 7);
      } else if (bullet.kind === 'wardenOrb') {
        ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#ffd36b'; ctx.lineWidth = 2; ctx.strokeRect(-8, -8, 16, 16);
      } else if (bullet.kind === 'skimmerBolt') {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(-2, -8, 4, 16);
        ctx.fillStyle = '#63e8ff'; ctx.fillRect(-5, -3, 10, 6);
      } else {
        ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(6, 0); ctx.lineTo(0, 7); ctx.lineTo(-6, 0); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
  }

  drawThreatWarnings(ctx) {
    for (const enemy of this.enemies) {
      if (enemy.type !== 'skimmer' || enemy.skimmerIntro <= 0) continue;
      const progress = 1 - enemy.skimmerIntro / enemy.skimmerIntroMax;
      const x = enemy.side > 0 ? this.arenaLeft + 18 : this.arenaRight - 18;
      const direction = enemy.side > 0 ? 1 : -1;
      ctx.save();
      ctx.translate(x, enemy.y);
      ctx.globalAlpha = .45 + Math.sin(this.time * 18) * .2 + progress * .25;
      ctx.fillStyle = '#ff65df';
      ctx.shadowBlur = 12; ctx.shadowColor = '#63e8ff';
      for (let index = 0; index < 3; index += 1) {
        const offset = index * 9 * direction;
        ctx.beginPath();
        ctx.moveTo(offset + 8 * direction, 0);
        ctx.lineTo(offset - 2 * direction, -7);
        ctx.lineTo(offset - 2 * direction, 7);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
  }

  drawWeaverLinks(ctx) {
    for (const weaver of this.enemies) {
      if (weaver.type !== 'weaver' || weaver.dead) continue;
      for (const id of weaver.linkTargets || []) {
        const target = this.enemies.find(enemy => enemy.id === id && !enemy.dead);
        if (!target) continue;
        const dx = target.x - weaver.x;
        const dy = target.y - weaver.y;
        const distance = Math.hypot(dx, dy) || 1;
        const nx = -dy / distance;
        const ny = dx / distance;
        ctx.save();
        ctx.strokeStyle = '#62f7c6';
        ctx.shadowBlur = 12; ctx.shadowColor = '#62f7c6';
        ctx.lineWidth = 3; ctx.globalAlpha = .75;
        ctx.beginPath();
        ctx.moveTo(weaver.x, weaver.y);
        for (let step = 1; step < 5; step += 1) {
          const t = step / 5;
          const jitter = Math.sin(this.time * 18 + step * 2.4 + weaver.phase) * 4;
          ctx.lineTo(weaver.x + dx * t + nx * jitter, weaver.y + dy * t + ny * jitter);
        }
        ctx.lineTo(target.x, target.y); ctx.stroke();
        ctx.globalAlpha = .42; ctx.lineWidth = 1; ctx.strokeStyle = '#fffbd7'; ctx.stroke();
        ctx.restore();
      }
    }
  }

  drawBossWarnings(ctx) {
    for (const warning of this.bossWarnings) {
      const progress = clamp(warning.age / warning.warning, 0, 1);
      const pulse = .55 + Math.sin(this.time * 24) * .18;
      ctx.save(); ctx.translate(warning.x, warning.y);
      ctx.globalAlpha = (.25 + progress * .65) * pulse;
      ctx.strokeStyle = warning.type === 'fan' ? '#ffd36b' : '#ff587b';
      ctx.lineWidth = 2; ctx.shadowBlur = 12; ctx.shadowColor = ctx.strokeStyle;
      if (warning.type === 'fan') {
        for (let index = 0; index < warning.count; index += 1) {
          const shot = warning.angle + (index - (warning.count - 1) / 2) * warning.spread;
          ctx.beginPath(); ctx.moveTo(Math.cos(shot) * 52, Math.sin(shot) * 52); ctx.lineTo(Math.cos(shot) * (95 + progress * 45), Math.sin(shot) * (95 + progress * 45)); ctx.stroke();
        }
      } else {
        ctx.setLineDash([7, 7]);
        ctx.beginPath(); ctx.arc(0, 0, 62 + progress * 24, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 4; ctx.strokeStyle = '#6fffd2';
        ctx.beginPath(); ctx.arc(0, 0, 76 + progress * 24, warning.safeAngle - warning.gap, warning.safeAngle + warning.gap); ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawBossPresentation(ctx) {
    const boss = this.enemies.find(enemy => enemy.type === 'boss' && !enemy.dead);
    if (!boss) return;
    let title = '';
    let subtitle = '';
    let alpha = 0;
    if (boss.intro > 0) {
      const progress = 1 - boss.intro / boss.introMax;
      title = boss.bossName;
      subtitle = `${this.stageInfo().name} · CROWNED GUARDIAN`;
      alpha = Math.sin(clamp(progress, 0, 1) * Math.PI) * .96;
    } else if (boss.phaseTransition > 0) {
      const progress = 1 - boss.phaseTransition / boss.phaseTransitionMax;
      const profile = WARDEN_VARIANTS[boss.bossVariant] || WARDEN_VARIANTS[3];
      title = `PHASE ${boss.bossPhase}`;
      subtitle = boss.bossPhase === 2 ? profile.phase2 : profile.phase3;
      alpha = Math.sin(clamp(progress, 0, 1) * Math.PI) * .92;
    }
    if (alpha <= 0) return;
    const centerY = Math.min(this.height * .38, 310);
    ctx.save();
    ctx.globalAlpha = alpha;
    const band = ctx.createLinearGradient(this.arenaLeft, 0, this.arenaRight, 0);
    band.addColorStop(0, 'rgba(5,11,17,0)'); band.addColorStop(.2, 'rgba(5,11,17,.86)'); band.addColorStop(.8, 'rgba(5,11,17,.86)'); band.addColorStop(1, 'rgba(5,11,17,0)');
    ctx.fillStyle = band; ctx.fillRect(this.arenaLeft, centerY - 60, this.arenaWidth, 120);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `400 ${this.arenaWidth < 500 ? 20 : 27}px "Press Start 2P", monospace`;
    ctx.fillStyle = '#fff4d2'; ctx.shadowBlur = 20; ctx.shadowColor = '#ff587b'; ctx.fillText(title, (this.arenaLeft + this.arenaRight) / 2, centerY - 10);
    ctx.shadowBlur = 0; ctx.font = '700 9px "Silkscreen", monospace'; ctx.letterSpacing = '2px'; ctx.fillStyle = '#ffd36b'; ctx.fillText(subtitle, (this.arenaLeft + this.arenaRight) / 2, centerY + 25);
    ctx.restore();
  }

  drawWeaponImpacts(ctx) {
    for (const impact of this.impactFlashes) {
      const [, sprite] = this.loadWeaponFx(impact.type);
      const progress = 1 - impact.life / impact.maxLife;
      const scale = .58 + progress * .72;
      const size = impact.size * scale;
      ctx.save();
      ctx.translate(impact.x, impact.y);
      ctx.rotate(impact.rotation + (impact.type === 'pulse' ? progress * .35 : 0));
      ctx.globalAlpha = Math.pow(clamp(impact.life / impact.maxLife, 0, 1), .65);
      ctx.imageSmoothingEnabled = false;
      if (sprite?.complete && sprite.naturalWidth) {
        const height = size / (sprite.naturalWidth / sprite.naturalHeight);
        ctx.drawImage(sprite, -size / 2, -height / 2, size, height);
      } else {
        ctx.fillStyle = CONFIG.weapons[impact.type].color;
        ctx.fillRect(-size / 2, -2, size, 4);
        ctx.fillRect(-2, -size / 2, 4, size);
      }
      ctx.restore();
    }
  }

  drawHazards(ctx) {
    for (const hazard of this.hazards) {
      if (hazard.type === 'poison') {
        const warningDuration = hazard.warning ?? .65;
        const incoming = hazard.age < warningDuration;
        const fade = clamp((hazard.life - hazard.age) / .7, 0, 1);
        const warningSprite = this.sprites.poisonWarning;
        const puddleSprite = this.sprites.poisonPuddle;
        const drawSprite = (sprite, size, alpha, rotation = 0) => {
          if (!sprite?.complete || !sprite.naturalWidth) return false;
          ctx.save(); ctx.translate(hazard.x, hazard.y); ctx.rotate(rotation);
          ctx.globalAlpha = alpha; ctx.imageSmoothingEnabled = false;
          ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
          ctx.restore();
          return true;
        };
        if (incoming) {
          const progress = hazard.age / warningDuration;
          const pulse = 1 + Math.sin(this.time * 22) * .08;
          if (!drawSprite(warningSprite, hazard.radius * 2.75 * pulse, .62 + progress * .3, this.time * .32)) {
            ctx.save(); ctx.translate(hazard.x, hazard.y); ctx.strokeStyle = '#baff75'; ctx.lineWidth = 3; ctx.globalAlpha = .7;
            ctx.strokeRect(-hazard.radius, -hazard.radius, hazard.radius * 2, hazard.radius * 2); ctx.restore();
          }
        } else {
          const settle = clamp((hazard.age - warningDuration) / .18, 0, 1);
          const pulse = 1 + Math.sin(this.time * 3.8 + hazard.x) * .025;
          if (!drawSprite(puddleSprite, hazard.radius * 3.05 * pulse, fade * settle, Math.sin(hazard.x) * .08)) {
            ctx.save(); ctx.globalAlpha = .42 * fade; ctx.fillStyle = '#58ff82';
            ctx.fillRect(hazard.x - hazard.radius, hazard.y - hazard.radius * .72, hazard.radius * 2, hazard.radius * 1.44); ctx.restore();
          }
          if (hazard.age < warningDuration + .22) drawSprite(warningSprite, hazard.radius * 2.65, .45 * (1 - (hazard.age - warningDuration) / .22), this.time * .32);
        }
      } else if (hazard.type === 'meteor') {
        const incoming = hazard.age < hazard.warning;
        const drawMeteorSprite = (sprite, size, alpha, rotation = 0) => {
          if (!sprite?.complete || !sprite.naturalWidth) return false;
          ctx.save(); ctx.translate(hazard.x, hazard.y); ctx.rotate(rotation);
          ctx.globalAlpha = alpha; ctx.imageSmoothingEnabled = false;
          ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
          ctx.restore();
          return true;
        };
        if (incoming) {
          const progress = clamp(hazard.age / hazard.warning, 0, 1);
          const pulse = 1 + Math.sin(this.time * 18) * .055;
          const warningDrawn = drawMeteorSprite(this.sprites.meteorWarning, hazard.radius * 2.85 * pulse, .62 + progress * .3, this.time * .22);
          const coreProgress = clamp((progress - .28) / .72, 0, 1);
          if (coreProgress > 0) drawMeteorSprite(this.sprites.meteorCore, hazard.radius * (.42 + coreProgress * 1.05), coreProgress * .96, -this.time * .35);
          if (!warningDrawn) {
            ctx.save(); ctx.translate(hazard.x, hazard.y); ctx.strokeStyle = '#ffcf75'; ctx.lineWidth = 3; ctx.globalAlpha = .72;
            ctx.strokeRect(-hazard.radius, -hazard.radius, hazard.radius * 2, hazard.radius * 2); ctx.restore();
          }
        } else {
          const impactAge = hazard.age - hazard.warning;
          const settle = clamp(impactAge / .14, 0, 1);
          const fade = clamp((hazard.life - hazard.age) / .62, 0, 1);
          const impactDrawn = drawMeteorSprite(this.sprites.meteorImpact, hazard.radius * (2.45 + settle * .5), fade, Math.sin(hazard.x) * .035);
          if (impactAge < .16) drawMeteorSprite(this.sprites.meteorCore, hazard.radius * (1.75 - impactAge * 3), 1 - impactAge / .16, -this.time * .35);
          if (!impactDrawn) {
            ctx.save(); ctx.globalAlpha = .45 * fade; ctx.fillStyle = '#ff5d37';
            ctx.fillRect(hazard.x - hazard.radius, hazard.y - hazard.radius, hazard.radius * 2, hazard.radius * 2); ctx.restore();
          }
        }
      } else if (hazard.type === 'laserLine' || hazard.type === 'wardenBeam') {
        const active = hazard.age >= hazard.warning;
        const warden = hazard.type === 'wardenBeam';
        ctx.save();
        ctx.strokeStyle = active ? '#ffffff' : warden ? '#ffd36b' : '#d99cff';
        ctx.lineWidth = active ? hazard.width : 2;
        ctx.globalAlpha = active ? .78 : .38 + Math.sin(this.time * 20) * .18;
        ctx.shadowBlur = active ? 24 : warden ? 10 : 0; ctx.shadowColor = warden ? '#ff587b' : '#d99cff';
        ctx.beginPath();
        if (hazard.vertical) { ctx.moveTo(hazard.position, 0); ctx.lineTo(hazard.position, this.height); }
        else { ctx.moveTo(this.arenaLeft, hazard.position); ctx.lineTo(this.arenaRight, hazard.position); }
        ctx.stroke(); ctx.restore();
      }
    }
  }

  drawPoisonStatus(ctx) {
    const player = this.player;
    if (player.poisonSplash > 0) {
      const sprite = this.sprites.poisonHit;
      const progress = 1 - player.poisonSplash / .36;
      const size = 68 + progress * 26;
      if (sprite?.complete && sprite.naturalWidth) {
        ctx.save(); ctx.translate(player.x, player.y); ctx.rotate(progress * .45);
        ctx.globalAlpha = clamp(player.poisonSplash / .22, 0, 1); ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sprite, -size / 2, -size / 2, size, size); ctx.restore();
      }
    }
    if (player.poisonExposure <= .01) return;
    const width = 42;
    const x = Math.round(player.x - width / 2);
    const y = Math.round(player.y - 57);
    ctx.save();
    ctx.fillStyle = 'rgba(3, 13, 10, .88)'; ctx.fillRect(x - 2, y - 2, width + 4, 8);
    ctx.fillStyle = '#173f27'; ctx.fillRect(x, y, width, 4);
    ctx.fillStyle = player.poisonExposure > .72 ? '#efff73' : '#68ff8a';
    ctx.fillRect(x, y, Math.ceil(width * player.poisonExposure), 4);
    ctx.fillStyle = '#caff8f'; ctx.fillRect(x, y, Math.ceil(width * player.poisonExposure), 1);
    ctx.restore();
  }

  drawTeslaArcs(ctx) {
    for (const arc of this.teslaArcs) {
      const fromEnemy = arc.fromId ? this.enemies.find(enemy => enemy.id === arc.fromId && !enemy.dead) : null;
      const toEnemy = this.enemies.find(enemy => enemy.id === arc.toId && !enemy.dead);
      const x1 = arc.fromPlayer ? this.player.x : fromEnemy?.x ?? arc.x1;
      const y1 = arc.fromPlayer ? this.player.y - 24 : fromEnemy?.y ?? arc.y1;
      const x2 = toEnemy?.x ?? arc.x2;
      const y2 = toEnemy?.y ?? arc.y2;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.hypot(dx, dy) || 1;
      const nx = -dy / length;
      const ny = dx / length;
      const alpha = clamp(arc.life / arc.maxLife, 0, 1);
      const trace = width => {
        ctx.lineWidth = width;
        ctx.beginPath(); ctx.moveTo(x1, y1);
        const segments = clamp(Math.ceil(length / 22), 9, 26);
        for (let index = 1; index < segments; index += 1) {
          const t = index / segments;
          const jitter = Math.sin(this.time * 74 + index * 11.3 + (arc.toId || 0)) * (index % 2 ? 11 : 6);
          ctx.lineTo(x1 + dx * t + nx * jitter, y1 + dy * t + ny * jitter);
        }
        ctx.lineTo(x2, y2); ctx.stroke();
      };
      ctx.save();
      ctx.globalAlpha = alpha * .68; ctx.strokeStyle = '#7d55ff'; ctx.shadowBlur = 11; ctx.shadowColor = '#b99cff'; trace(4);
      ctx.globalAlpha = alpha; ctx.strokeStyle = '#f8f2ff'; ctx.shadowBlur = 0; trace(1.5);
      ctx.restore();
    }
  }

  drawPickups(ctx) {
    for (const pickup of this.pickups) {
      const weapon = CONFIG.weapons[pickup.weapon] || CONFIG.weapons.blaster;
      const pulse = 1 + Math.sin(this.time * 5) * .12;
      const closedSprite = this.sprites.crateClosed;
      const openSprite = this.sprites.crateOpen;
      const crateSprite = pickup.collected ? openSprite : closedSprite;
      ctx.save();
      ctx.translate(pickup.x, pickup.y);
      ctx.scale(pulse, pulse);
      ctx.shadowBlur = pickup.collected ? 8 : 15;
      ctx.shadowColor = weapon.color;
      if (crateSprite?.complete && crateSprite.naturalWidth) {
        ctx.imageSmoothingEnabled = false;
        const width = pickup.collected ? 84 : 72;
        const height = pickup.collected ? 84 : 72;
        ctx.drawImage(crateSprite, -width / 2, -height / 2, width, height);
      } else {
        ctx.fillStyle = '#123e3d'; this.roundRect(ctx, -24, -24, 48, 48, 5); ctx.fill();
      }
      ctx.shadowBlur = 0;
      const iconLift = pickup.collected ? pickup.openTime * 48 : 0;
      const iconAlpha = pickup.collected ? clamp(1 - pickup.openTime / .48, 0, 1) : 1;
      ctx.globalAlpha = iconAlpha;
      const [weaponSprite] = this.loadWeaponFx(pickup.weapon);
      if (weaponSprite?.complete && weaponSprite.naturalWidth) {
        const iconWidth = pickup.collected ? 48 : 38;
        const iconHeight = iconWidth * weaponSprite.naturalHeight / weaponSprite.naturalWidth;
        ctx.imageSmoothingEnabled = false;
        ctx.shadowBlur = pickup.collected ? 16 : 8;
        ctx.shadowColor = weapon.color;
        ctx.drawImage(weaponSprite, -iconWidth / 2, -iconHeight / 2 - iconLift, iconWidth, iconHeight);
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = weapon.color;
        ctx.beginPath(); ctx.arc(0, -iconLift, pickup.collected ? 12 : 11, 0, TAU); ctx.fill();
        ctx.fillStyle = '#071014';
        ctx.font = '700 15px "Silkscreen", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(weapon.icon, 0, 1 - iconLift);
      }
      ctx.restore();

      const distance = Math.hypot(pickup.x - this.player.x, pickup.y - this.player.y);
      if (!pickup.collected && (pickup.firstDrop || distance < 180)) {
        const isUpgrade = this.weaponLevels[pickup.weapon] > 0;
        const upgradeName = weapon.upgrades[pickup.targetLevel - 1];
        const labelTop = pickup.y < 215 ? pickup.y + 43 : pickup.y - 80;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(3, 10, 14, .9)';
        ctx.fillRect(pickup.x - 65, labelTop, 130, 36);
        ctx.strokeStyle = weapon.color; ctx.globalAlpha = .45; ctx.strokeRect(pickup.x - 65.5, labelTop - .5, 131, 37); ctx.globalAlpha = 1;
        ctx.fillStyle = weapon.color;
        ctx.font = '700 10px "Silkscreen", monospace';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(`${weapon.name} · MK ${pickup.targetLevel}`, pickup.x, labelTop + 16);
        ctx.fillStyle = '#b7c9c5';
        ctx.font = '400 7px "Silkscreen", monospace';
        ctx.fillText(`${isUpgrade ? 'UPGRADE' : 'NEW'} · ${upgradeName}`, pickup.x, labelTop + 27);
        ctx.restore();
      }
    }
  }

  drawParticles(ctx) {
    for (const particle of this.particles) { ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1); ctx.fillStyle = particle.color; ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.radius, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
  }

  drawTrails(ctx) {
    for (const trail of this.trails) { ctx.globalAlpha = trail.life / .22 * .24; ctx.fillStyle = '#6fffd2'; ctx.beginPath(); ctx.arc(trail.x, trail.y, trail.radius, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
  }

  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, width, height, radius) : ctx.rect(x, y, width, height);
  }
}
