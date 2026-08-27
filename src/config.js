export const CONFIG = Object.freeze({
  version: Object.freeze({ release: '0.26.0', build: 83 }),
  simulationHz: 60,
  player: {
    radius: 17,
    acceleration: 1900,
    maxSpeed: 365,
    drag: 7.5,
    maxHealth: 3,
    hitInvulnerability: 1.15,
  },
  dash: {
    duration: 0.16,
    cooldown: 1.45,
    speed: 980,
    impactDamage: 8,
  },
  weapons: {
    blaster: {
      name: 'BLASTER', icon: '▰', interval: .22, minimumInterval: .09, speed: 740, damage: 1, count: 1, spread: 0, color: '#9dfbe0',
      upgrades: ['STANDARD', 'TWIN SHOT', 'BREAKTHROUGH', 'RICOCHET', 'ROYAL SALVO'],
    },
    spread: {
      name: 'SPREAD', icon: '≋', interval: .34, minimumInterval: .14, speed: 680, damage: .8, count: 3, spread: .18, color: '#ffd36b',
      upgrades: ['TRIPLE CONE', 'FIVE SHOT', 'WIDE CONE', 'REAR GUARD', 'BULLET STORM'],
    },
    pulse: {
      name: 'PULSE', icon: '●', interval: .52, minimumInterval: .22, speed: 590, damage: 2.6, count: 1, spread: 0, color: '#ff8ddb', radius: 6,
      upgrades: ['HEAVY PULSE', 'LARGE CORE', 'NOVA', 'CHAIN PULSE', 'SUPERNOVA'],
    },
    laser: {
      name: 'LASER', icon: '║', interval: .21, minimumInterval: .09, speed: 1120, damage: .78, count: 1, spread: 0, color: '#63e8ff', radius: 3,
      upgrades: ['LIGHT BEAM', 'OVERCHARGED', 'PIERCING', 'TWIN BEAM', 'PRISM LANCE'],
    },
    tesla: {
      name: 'TESLA', icon: 'ϟ', interval: .29, minimumInterval: .12, speed: 0, damage: .52, count: 1, spread: 0, color: '#b99cff', radius: 5,
      upgrades: ['ARC LATCH', 'DOUBLE BRANCH', 'HIGH VOLTAGE', 'TWIN COIL', 'STORM CROWN'],
    },
  },
  weaponMasteries: {
    blaster: [
      { key: 'royalBarrage', name: 'ROYAL BARRAGE', role: 'CROWD CONTROL', description: 'Four rapid rounds sweep lanes and ricochet through the swarm.', color: '#9dfbe0' },
      { key: 'crownrail', name: 'CROWNRAIL', role: 'ELITE BREAKER', description: 'One colossal round punches through armor and entire enemy lines.', color: '#f4fff9' },
    ],
    spread: [
      { key: 'haloGuard', name: 'HALO GUARD', role: 'FULL DEFENCE', description: 'Twin seven-shot fans guard both the bow and stern.', color: '#ffd36b' },
      { key: 'guillotineFan', name: 'GUILLOTINE FAN', role: 'FORWARD BURST', description: 'A tight five-shot fan cuts deeply through targets ahead.', color: '#fff1a9' },
    ],
    pulse: [
      { key: 'singularity', name: 'SINGULARITY', role: 'AREA DAMAGE', description: 'A slow royal core detonates into a screen-clearing gravity blast.', color: '#ff8ddb' },
      { key: 'cometCores', name: 'COMET CORES', role: 'BOSS PRESSURE', description: 'Three compact cores strike often and rebound between targets.', color: '#ffc2eb' },
    ],
    laser: [
      { key: 'sovereignLance', name: 'SOVEREIGN LANCE', role: 'FOCUS DAMAGE', description: 'One precise beam gains damage while locked to the same target.', color: '#63e8ff' },
      { key: 'prismArray', name: 'PRISM ARRAY', role: 'MULTI TARGET', description: 'Three lighter beams refract once toward nearby enemies.', color: '#baf6ff' },
    ],
    tesla: [
      { key: 'stormWeb', name: 'STORM WEB', role: 'CHAIN CONTROL', description: 'Twin arcs branch across a vast web of nearby enemies.', color: '#b99cff' },
      { key: 'thunderAnchor', name: 'THUNDER ANCHOR', role: 'WARDEN HUNTER', description: 'One brutal arc deals 75% more damage to elites and Wardens.', color: '#e1d4ff' },
    ],
  },
  weaponProgression: {
    initialDelay: 8,
    discoveryInterval: Object.freeze([14, 18]),
    upgradeInterval: Object.freeze([27, 35]),
    favorCurrentChance: .58,
  },
  enemyScaling: {
    healthPerStage: .075,
    healthPerCycle: .12,
    wardenHealthPerStage: .16,
    wardenHealthPerCycle: .14,
    firstCycleEnemyCap: 26,
    enemiesPerCycle: 3,
    maximumEnemyCap: 35,
    eliteChancePerCycle: .035,
    maximumEliteBonus: .14,
  },
  comboWindow: 2.3,
  stageDuration: 120,
  difficulties: {
    chill: { name: 'CHILL', pressure: .78, score: .75, health: 4 },
    arcade: { name: 'ARCADE', pressure: 1, score: 1, health: 3 },
    crowned: { name: 'CROWNED', pressure: 1.28, score: 1.6, health: 2 },
  },
  stages: [
    {
      name: 'VERDANT ORBIT',
      subtitle: 'The Rippers awaken',
      palette: { center: '#0b2925', mid: '#071a1d', edge: '#03090d', grid: '#6fffd2', stars: '#b8ffe9', accent: '#6fffd2' },
      weights: { chaser: .72, shooter: .2, tank: .08 },
    },
    {
      name: 'EMBER RIFT',
      subtitle: 'Armor hardens · the Weaver wakes',
      palette: { center: '#351c18', mid: '#1d1116', edge: '#09070d', grid: '#ff9b64', stars: '#ffd095', accent: '#ff9b64' },
      weights: { chaser: .42, shooter: .24, tank: .34 },
    },
    {
      name: 'CRYSTAL VOID',
      subtitle: 'Skimmers breach the flanks',
      palette: { center: '#241737', mid: '#111126', edge: '#050611', grid: '#d99cff', stars: '#f7dcff', accent: '#d99cff' },
      weights: { chaser: .28, shooter: .58, tank: .14 },
    },
    {
      name: 'CROWN CORE',
      subtitle: 'Everything at stake',
      palette: { center: '#302513', mid: '#171514', edge: '#06080b', grid: '#ffd36b', stars: '#fff1bb', accent: '#ffd36b' },
      weights: { chaser: .42, shooter: .34, tank: .24 },
    },
  ],
  perks: [
    { key: 'quickstep', icon: '➤', sprite: 'quickstep-v1.png', name: 'QUICKSTEP', description: 'Dash recharges 18% faster.', maxStacks: 4, color: '#6fffd2' },
    { key: 'royalHeart', icon: '♥', sprite: 'royal-heart-v1.png', name: 'ROYAL HEART', description: '+1 maximum life and restore one life.', maxStacks: 3, color: '#ff587b' },
    { key: 'magnet', icon: '⊙', sprite: 'magnet-core-v1.png', name: 'MAGNET CORE', description: 'Weapon crates are pulled toward you from farther away.', maxStacks: 3, color: '#7ee7ff' },
    { key: 'overclock', icon: '»', sprite: 'overclock-v1.png', name: 'OVERCLOCK', description: 'All weapons fire 12% faster.', maxStacks: 3, color: '#ffd36b' },
    { key: 'heavyCrown', icon: '♛', sprite: 'heavy-crown-v1.png', name: 'HEAVY CROWN', description: '+18% damage but 7% lower movement speed.', maxStacks: 3, color: '#ff9b64' },
    { key: 'velocity', icon: '▲', sprite: 'velocity-v1.png', name: 'VELOCITY', description: '+12% movement speed and acceleration.', maxStacks: 4, color: '#a8ff9d' },
    { key: 'comboKeeper', icon: '×', sprite: 'combo-keeper-v1.png', name: 'COMBO KEEPER', description: 'Your combo lasts 40% longer.', maxStacks: 3, color: '#d99cff' },
    { key: 'royalFavor', icon: '◆', sprite: 'royal-favor-v1.png', name: 'ROYAL FAVOR', description: '+15% score for the rest of the run.', maxStacks: 3, color: '#fff0a8' },
    { key: 'glassCrown', icon: '♢', sprite: 'glass-crown-v1.png', name: 'GLASS CROWN', description: 'Double score, but permanently lose one maximum life.', maxStacks: 1, color: '#ff5c8a', cursed: true },
    { key: 'cursedOverdrive', icon: '⚠', sprite: 'cursed-overdrive-v1.png', name: 'CURSED OVERDRIVE', description: 'Fire 47% faster, but enemy pressure rises by 40%.', maxStacks: 1, color: '#ff9b64', cursed: true },
    { key: 'royalDebt', icon: '†', sprite: 'royal-debt-v1.png', name: 'ROYAL DEBT', description: 'Combos grow twice as fast, but Wardens gain 65% more health.', maxStacks: 1, color: '#d99cff', cursed: true },
  ],
  audio: {
    volume: .32,
    menuVolume: .24,
    menuTrack: './audio/menu-theme.mp3',
    gameTracks: ['./audio/moonshine.mp3', './audio/pixeldreams.mp3', './audio/yoga.mp3'],
  },
});
