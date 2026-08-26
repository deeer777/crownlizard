export const CONFIG = Object.freeze({
  version: Object.freeze({ release: '0.17.2', build: 72 }),
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
      name: 'BLASTER', icon: '▰', interval: .22, speed: 740, damage: 1, count: 1, spread: 0, color: '#9dfbe0',
      upgrades: ['STANDARD', 'TWIN SHOT', 'BREAKTHROUGH', 'RICOCHET', 'ROYAL SALVO'],
    },
    spread: {
      name: 'SPREAD', icon: '≋', interval: .34, speed: 680, damage: .8, count: 3, spread: .18, color: '#ffd36b',
      upgrades: ['TRIPLE CONE', 'FIVE SHOT', 'WIDE CONE', 'REAR GUARD', 'BULLET STORM'],
    },
    pulse: {
      name: 'PULSE', icon: '●', interval: .52, speed: 590, damage: 2.6, count: 1, spread: 0, color: '#ff8ddb', radius: 6,
      upgrades: ['HEAVY PULSE', 'LARGE CORE', 'NOVA', 'CHAIN PULSE', 'SUPERNOVA'],
    },
    laser: {
      name: 'LASER', icon: '║', interval: .2, speed: 1120, damage: .82, count: 1, spread: 0, color: '#63e8ff', radius: 3,
      upgrades: ['LIGHT BEAM', 'OVERCHARGED', 'PIERCING', 'TWIN BEAM', 'PRISM LANCE'],
    },
    tesla: {
      name: 'TESLA', icon: 'ϟ', interval: .29, speed: 0, damage: .52, count: 1, spread: 0, color: '#b99cff', radius: 5,
      upgrades: ['ARC LATCH', 'DOUBLE BRANCH', 'HIGH VOLTAGE', 'TWIN COIL', 'STORM CROWN'],
    },
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
    { key: 'overclock', icon: '»', sprite: 'overclock-v1.png', name: 'OVERCLOCK', description: 'All weapons fire 15% faster.', maxStacks: 4, color: '#ffd36b' },
    { key: 'heavyCrown', icon: '♛', sprite: 'heavy-crown-v1.png', name: 'HEAVY CROWN', description: '+22% damage but 7% lower movement speed.', maxStacks: 3, color: '#ff9b64' },
    { key: 'velocity', icon: '▲', sprite: 'velocity-v1.png', name: 'VELOCITY', description: '+12% movement speed and acceleration.', maxStacks: 4, color: '#a8ff9d' },
    { key: 'comboKeeper', icon: '×', sprite: 'combo-keeper-v1.png', name: 'COMBO KEEPER', description: 'Your combo lasts 40% longer.', maxStacks: 3, color: '#d99cff' },
    { key: 'royalFavor', icon: '◆', sprite: 'royal-favor-v1.png', name: 'ROYAL FAVOR', description: '+15% score for the rest of the run.', maxStacks: 3, color: '#fff0a8' },
    { key: 'glassCrown', icon: '♢', sprite: 'glass-crown-v1.png', name: 'GLASS CROWN', description: 'Double score, but permanently lose one maximum life.', maxStacks: 1, color: '#ff5c8a', cursed: true },
    { key: 'cursedOverdrive', icon: '⚠', sprite: 'cursed-overdrive-v1.png', name: 'CURSED OVERDRIVE', description: 'Nearly double fire rate, but enemy pressure rises by 28%.', maxStacks: 1, color: '#ff9b64', cursed: true },
    { key: 'royalDebt', icon: '†', sprite: 'royal-debt-v1.png', name: 'ROYAL DEBT', description: 'Combos grow twice as fast, but Wardens gain 65% more health.', maxStacks: 1, color: '#d99cff', cursed: true },
  ],
  audio: {
    volume: .32,
    tracks: ['./audio/moonshine.mp3', './audio/pixeldreams.mp3', './audio/yoga.mp3'],
  },
});
