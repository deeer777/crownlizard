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

export const DEFAULT_COSMETIC = Object.freeze({ id: 'ship_default', name: 'CROWN LIZARD', slot: 'ship', rarity: 'standard', source: ['default'], shardPrice: null, sprite: 'crown-lizard-player-v1.png' });

export const COSMETICS = Object.freeze([
  Object.freeze({ id: 'ship_verdant_scout', name: 'VERDANT SCOUT', slot: 'ship', rarity: 'uncommon', source: ['crate'], shardPrice: null, sprite: 'ship-verdant-scout-v1.png' }),
  Object.freeze({ id: 'ship_ember_runner', name: 'EMBER RUNNER', slot: 'ship', rarity: 'uncommon', source: ['crate'], shardPrice: null, sprite: 'ship-ember-runner-v1.png' }),
  Object.freeze({ id: 'ship_crystal_dart', name: 'CRYSTAL DART', slot: 'ship', rarity: 'uncommon', source: ['crate'], shardPrice: null, sprite: 'ship-crystal-dart-v1.png' }),
  Object.freeze({ id: 'ship_void_hunter', name: 'VOID HUNTER', slot: 'ship', rarity: 'rare', source: ['crate'], shardPrice: null, sprite: 'ship-void-hunter-v1.png' }),
  Object.freeze({ id: 'ship_solar_guard', name: 'SOLAR GUARD', slot: 'ship', rarity: 'rare', source: ['crate'], shardPrice: null, sprite: 'ship-solar-guard-v1.png' }),
  Object.freeze({ id: 'ship_royal_vanguard', name: 'ROYAL VANGUARD', slot: 'ship', rarity: 'royal', source: ['crate'], shardPrice: null, sprite: 'ship-royal-vanguard-v1.png' }),
  Object.freeze({ id: 'ship_rift_phantom', name: 'RIFT PHANTOM', slot: 'ship', rarity: 'mythic', source: ['crate'], shardPrice: null, sprite: 'ship-rift-phantom-v1.png' }),
  Object.freeze({ id: 'ship_crown_sovereign', name: 'CROWN SOVEREIGN', slot: 'ship', rarity: 'sovereign', source: ['crate'], shardPrice: null, sprite: 'ship-crown-sovereign-v1.png' }),
]);

export const COLLECTION_COSMETICS = Object.freeze([DEFAULT_COSMETIC, ...COSMETICS]);

export const TIER_BY_KEY = Object.freeze(Object.fromEntries(COSMETIC_TIERS.map(tier => [tier.key, tier])));
export const RARITY_BY_KEY = Object.freeze({ standard: STANDARD_TIER, ...TIER_BY_KEY });
export const COSMETIC_BY_ID = Object.freeze(Object.fromEntries(COLLECTION_COSMETICS.map(cosmetic => [cosmetic.id, cosmetic])));

export const rollTier = (random = Math.random) => {
  const roll = Math.floor(Math.max(0, Math.min(.999999, Number(random()) || 0)) * 10_000);
  let threshold = 0;
  return COSMETIC_TIERS.find(tier => {
    threshold += Math.round(tier.odds * 100);
    return roll < threshold;
  }) || COSMETIC_TIERS[0];
};

export const chooseCosmetic = (tierKey, random = Math.random) => {
  const choices = COSMETICS.filter(cosmetic => cosmetic.rarity === tierKey);
  const index = Math.min(choices.length - 1, Math.floor(Math.max(0, Math.min(.999999, Number(random()) || 0)) * choices.length));
  return choices[index];
};
