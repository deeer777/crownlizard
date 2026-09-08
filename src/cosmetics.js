export const CROWN_CRATE_COST = 150;
export const SOVEREIGN_GUARANTEE = 200;

export const STANDARD_TIER = Object.freeze({ key: 'standard', name: 'STANDARD', odds: 0, color: '#9dfbe0', salvage: 0 });

export const COSMETIC_TIERS = Object.freeze([
  Object.freeze({ key: 'uncommon', name: 'UNCOMMON', odds: 58, color: '#78cfae', salvage: 15 }),
  Object.freeze({ key: 'rare', name: 'RARE', odds: 28, color: '#63c8ff', salvage: 35 }),
  Object.freeze({ key: 'royal', name: 'ROYAL', odds: 10, color: '#d99cff', salvage: 75 }),
  Object.freeze({ key: 'mythic', name: 'MYTHIC', odds: 3.5, color: '#ff8b55', salvage: 150 }),
  Object.freeze({ key: 'sovereign', name: 'SOVEREIGN', odds: .5, color: '#ffd36b', salvage: 300 }),
]);

const flightFx = (style, primary, secondary) => Object.freeze({ style, primary, secondary });
const effectSprite = (column, row) => Object.freeze({ sheet: 'cosmetic-effects-sheet-v1.png', column, row });

export const DEFAULT_COSMETIC = Object.freeze({ id: 'ship_default', name: 'CROWN LIZARD', slot: 'ship', rarity: 'standard', source: ['default'], shardPrice: null, sprite: 'crown-lizard-player-v1.png', flightFx: flightFx('crown', '#6fffd2', '#ffd36b') });

export const DEFAULT_EFFECT_COSMETICS = Object.freeze([
  Object.freeze({ id: 'trail_default', name: 'ION WAKE', slot: 'trail', rarity: 'standard', source: ['default'], shardPrice: null, effectSprite: effectSprite(0, 0), effectFx: flightFx('ion', '#6fffd2', '#dffff5') }),
  Object.freeze({ id: 'dash_default', name: 'CROWN BURST', slot: 'dash', rarity: 'standard', source: ['default'], shardPrice: null, effectSprite: effectSprite(0, 1), effectFx: flightFx('ring', '#63c8ff', '#dffff5') }),
]);

export const DEFAULT_WEAPON_COSMETICS = Object.freeze([
  Object.freeze({ id: 'weapon_laser_default', name: 'ISSUE LASER', slot: 'weapon_laser', weaponKey: 'laser', rarity: 'standard', source: ['default'], shardPrice: null, sprite: 'laser-mount-v1.png', projectileStyle: 'issue', palette: Object.freeze({ primary: '#63e8ff', core: '#ffffff', glow: '#b9f7ff' }) }),
  Object.freeze({ id: 'weapon_tesla_default', name: 'ISSUE TESLA', slot: 'weapon_tesla', weaponKey: 'tesla', rarity: 'standard', source: ['default'], shardPrice: null, sprite: 'tesla-mount-v1.png', projectileStyle: 'issue', palette: Object.freeze({ primary: '#7d55ff', core: '#f8f2ff', glow: '#b99cff' }) }),
  Object.freeze({ id: 'weapon_pulse_default', name: 'ISSUE PULSE', slot: 'weapon_pulse', weaponKey: 'pulse', rarity: 'standard', source: ['default'], shardPrice: null, sprite: 'pulse-mount-v1.png', projectileStyle: 'issue', palette: Object.freeze({ primary: '#ff58b7', core: '#fff0fb', glow: '#ff9fda' }) }),
]);

export const CRATE_COSMETICS = Object.freeze([
  Object.freeze({ id: 'ship_verdant_scout', name: 'VERDANT SCOUT', slot: 'ship', rarity: 'uncommon', source: ['crate'], shardPrice: null, sprite: 'ship-verdant-scout-v1.png', flightFx: flightFx('spores', '#49ed9a', '#b8ffd8') }),
  Object.freeze({ id: 'ship_ember_runner', name: 'EMBER RUNNER', slot: 'ship', rarity: 'uncommon', source: ['crate'], shardPrice: null, sprite: 'ship-ember-runner-v1.png', flightFx: flightFx('sparks', '#ff6b35', '#ffd36b') }),
  Object.freeze({ id: 'ship_crystal_dart', name: 'CRYSTAL DART', slot: 'ship', rarity: 'uncommon', source: ['crate'], shardPrice: null, sprite: 'ship-crystal-dart-v1.png', flightFx: flightFx('prism', '#77d8ff', '#e0a7ff') }),
  Object.freeze({ id: 'ship_void_hunter', name: 'VOID HUNTER', slot: 'ship', rarity: 'rare', source: ['crate'], shardPrice: null, sprite: 'ship-void-hunter-v1.png', flightFx: flightFx('rift', '#a855ff', '#ff5fd7') }),
  Object.freeze({ id: 'ship_solar_guard', name: 'SOLAR GUARD', slot: 'ship', rarity: 'rare', source: ['crate'], shardPrice: null, sprite: 'ship-solar-guard-v1.png', flightFx: flightFx('sparks', '#ff9f32', '#fff0a8') }),
  Object.freeze({ id: 'ship_royal_vanguard', name: 'ROYAL VANGUARD', slot: 'ship', rarity: 'royal', source: ['crate'], shardPrice: null, sprite: 'ship-royal-vanguard-v1.png', flightFx: flightFx('prism', '#d99cff', '#ffd36b') }),
  Object.freeze({ id: 'ship_rift_phantom', name: 'RIFT PHANTOM', slot: 'ship', rarity: 'mythic', source: ['crate'], shardPrice: null, sprite: 'ship-rift-phantom-v1.png', flightFx: flightFx('rift', '#ff4fc4', '#7d55ff') }),
  Object.freeze({ id: 'ship_crown_sovereign', name: 'CROWN SOVEREIGN', slot: 'ship', rarity: 'sovereign', source: ['crate'], shardPrice: null, sprite: 'ship-crown-sovereign-v1.png', flightFx: flightFx('crown', '#ffd36b', '#fff4c2') }),
  Object.freeze({ id: 'weapon_tesla_verdant_chain', name: 'VERDANT CHAIN', slot: 'weapon_tesla', weaponKey: 'tesla', rarity: 'uncommon', source: ['crate'], shardPrice: null, sprite: 'tesla-verdant-chain-v2.png', projectileStyle: 'verdant', palette: Object.freeze({ primary: '#36e889', core: '#f0fff8', glow: '#72ffb5' }) }),
  Object.freeze({ id: 'weapon_tesla_storm_crown', name: 'STORM CROWN', slot: 'weapon_tesla', weaponKey: 'tesla', rarity: 'rare', source: ['crate'], shardPrice: null, sprite: 'tesla-storm-crown-v2.png', projectileStyle: 'storm', palette: Object.freeze({ primary: '#218cff', core: '#ffffff', glow: '#73c7ff' }) }),
  Object.freeze({ id: 'weapon_laser_void_lance', name: 'VOID LANCE', slot: 'weapon_laser', weaponKey: 'laser', rarity: 'mythic', source: ['crate'], shardPrice: null, sprite: 'laser-void-lance-v2.png', projectileStyle: 'void-lance', palette: Object.freeze({ primary: '#c52cff', core: '#fff1ff', glow: '#ed70ff' }) }),
  Object.freeze({ id: 'weapon_pulse_sovereign_eclipse', name: 'SOVEREIGN ECLIPSE', slot: 'weapon_pulse', weaponKey: 'pulse', rarity: 'sovereign', source: ['crate'], shardPrice: null, sprite: 'pulse-sovereign-eclipse-v2.png', projectileStyle: 'eclipse', palette: Object.freeze({ primary: '#25e1cd', core: '#fff2a8', glow: '#ffd65a' }) }),
  Object.freeze({ id: 'trail_ember_comet', name: 'EMBER COMET', slot: 'trail', rarity: 'uncommon', source: ['crate'], shardPrice: null, effectSprite: effectSprite(1, 0), effectFx: flightFx('sparks', '#ff6b35', '#ffd36b') }),
  Object.freeze({ id: 'trail_rift_wake', name: 'RIFT WAKE', slot: 'trail', rarity: 'rare', source: ['crate'], shardPrice: null, effectSprite: effectSprite(2, 0), effectFx: flightFx('rift', '#a855ff', '#ff5fd7') }),
  Object.freeze({ id: 'trail_royal_wake', name: 'ROYAL WAKE', slot: 'trail', rarity: 'royal', source: ['crate'], shardPrice: null, effectSprite: effectSprite(3, 0), effectFx: flightFx('crown', '#ffd36b', '#fff4c2') }),
  Object.freeze({ id: 'trail_verdant_echo', name: 'VERDANT ECHO', slot: 'trail', rarity: 'mythic', source: ['crate'], shardPrice: null, effectSprite: effectSprite(0, 0), effectFx: flightFx('spores', '#36e889', '#b8ffd8') }),
  Object.freeze({ id: 'dash_spectral_wings', name: 'SPECTRAL WINGS', slot: 'dash', rarity: 'uncommon', source: ['crate'], shardPrice: null, effectSprite: effectSprite(1, 1), effectFx: flightFx('wings', '#36e889', '#f0fff8') }),
  Object.freeze({ id: 'dash_phase_slice', name: 'PHASE SLICE', slot: 'dash', rarity: 'rare', source: ['crate'], shardPrice: null, effectSprite: effectSprite(2, 1), effectFx: flightFx('slice', '#ff4fc4', '#fff1ff') }),
  Object.freeze({ id: 'dash_solar_crown', name: 'SOLAR CROWN', slot: 'dash', rarity: 'sovereign', source: ['crate'], shardPrice: null, effectSprite: effectSprite(3, 1), effectFx: flightFx('solar', '#ffd36b', '#fff4c2') }),
]);

export const STORE_COSMETICS = Object.freeze([
  Object.freeze({ id: 'ship_gilded_viper', name: 'GILDED VIPER', slot: 'ship', rarity: 'royal', source: ['store'], shardPrice: 1250, sprite: 'ship-gilded-viper-v1.png', flightFx: flightFx('crown', '#ffd36b', '#55e5c5') }),
  Object.freeze({ id: 'ship_neon_basilisk', name: 'NEON BASILISK', slot: 'ship', rarity: 'mythic', source: ['store'], shardPrice: 2500, sprite: 'ship-neon-basilisk-v1.png', flightFx: flightFx('rift', '#20f7de', '#ff48d4') }),
  Object.freeze({ id: 'weapon_laser_royal_prism', name: 'ROYAL PRISM', slot: 'weapon_laser', weaponKey: 'laser', rarity: 'royal', source: ['store'], shardPrice: 950, sprite: 'laser-royal-prism-v2.png', projectileStyle: 'prism', palette: Object.freeze({ primary: '#20dff7', core: '#ffffff', glow: '#ffd36b' }) }),
  Object.freeze({ id: 'weapon_pulse_solar_core', name: 'SOLAR CORE', slot: 'weapon_pulse', weaponKey: 'pulse', rarity: 'royal', source: ['store'], shardPrice: 1100, sprite: 'pulse-solar-core-v2.png', projectileStyle: 'solar', palette: Object.freeze({ primary: '#ff6b22', core: '#fff7ba', glow: '#ffd04c' }) }),
]);

export const STORE_PRODUCTS = Object.freeze([
  ...STORE_COSMETICS.map((cosmetic, index) => Object.freeze({
    sku: `store_${cosmetic.id}`,
    type: 'cosmetic',
    cosmeticId: cosmetic.id,
    name: cosmetic.name,
    description: cosmetic.slot === 'ship' ? 'STORE-EXCLUSIVE SHIP CHASSIS' : `STORE-EXCLUSIVE ${cosmetic.weaponKey.toUpperCase()} SKIN`,
    price: cosmetic.shardPrice,
    rarity: cosmetic.rarity,
    sortOrder: (index + 1) * 10,
  })),
  Object.freeze({
    sku: 'service_callsign_rename',
    type: 'service',
    cosmeticId: null,
    name: 'CALLSIGN CHANGE',
    description: 'NEW ARCADE ID · 7 DAY COOLDOWN',
    price: 500,
    rarity: 'standard',
    sortOrder: 30,
  }),
]);

export const COSMETICS = Object.freeze([...CRATE_COSMETICS, ...STORE_COSMETICS]);

export const COLLECTION_COSMETICS = Object.freeze([DEFAULT_COSMETIC, ...DEFAULT_EFFECT_COSMETICS, ...DEFAULT_WEAPON_COSMETICS, ...COSMETICS]);

export const TIER_BY_KEY = Object.freeze(Object.fromEntries(COSMETIC_TIERS.map(tier => [tier.key, tier])));
export const RARITY_BY_KEY = Object.freeze({ standard: STANDARD_TIER, ...TIER_BY_KEY });
export const COSMETIC_BY_ID = Object.freeze(Object.fromEntries(COLLECTION_COSMETICS.map(cosmetic => [cosmetic.id, cosmetic])));

export const secureRandom = () => {
  const values = new Uint32Array(1);
  if (!globalThis.crypto?.getRandomValues) throw new Error('Secure randomness is unavailable.');
  globalThis.crypto.getRandomValues(values);
  return values[0] / 0x1_0000_0000;
};

export const rollTier = (random = secureRandom) => {
  const roll = Math.floor(Math.max(0, Math.min(.999999, Number(random()) || 0)) * 10_000);
  let threshold = 0;
  return COSMETIC_TIERS.find(tier => {
    threshold += Math.round(tier.odds * 100);
    return roll < threshold;
  }) || COSMETIC_TIERS[0];
};

export const chooseCosmetic = (tierKey, random = secureRandom) => {
  const choices = CRATE_COSMETICS.filter(cosmetic => cosmetic.rarity === tierKey);
  const index = Math.min(choices.length - 1, Math.floor(Math.max(0, Math.min(.999999, Number(random()) || 0)) * choices.length));
  return choices[index];
};
