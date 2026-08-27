import assert from 'node:assert/strict';
import { CosmeticPreferences } from '../src/cosmetic-preferences.js';

const values = new Map();
const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
const preferences = new CosmeticPreferences({ storage, random: () => 0 });

assert.deepEqual(preferences.getState(), { favorites: [], randomFavorite: false });
assert.throws(() => preferences.toggleRandom([]), /NO_FAVORITES/);
assert.throws(() => preferences.toggleFavorite('ship_locked', []), /COSMETIC_LOCKED/);
assert.deepEqual(preferences.toggleFavorite('ship_default', []).favorites, ['ship_default']);
assert.equal(preferences.toggleRandom([]).randomFavorite, true);
assert.equal(preferences.chooseShip([], 'ship_default'), 'ship_default');

preferences.toggleFavorite('ship_verdant_scout', ['ship_verdant_scout']);
assert.equal(preferences.chooseShip(['ship_verdant_scout'], 'ship_default'), 'ship_verdant_scout', 'random mode avoids the previous favorite when possible');
assert.equal(preferences.chooseShip(['ship_verdant_scout'], 'ship_default'), 'ship_default', 'random mode rotates away from the last selected favorite');

preferences.toggleFavorite('ship_default', ['ship_verdant_scout']);
preferences.toggleRandom(['ship_verdant_scout']);
assert.equal(preferences.chooseShip(['ship_verdant_scout'], 'ship_verdant_scout'), 'ship_verdant_scout', 'the equipped ship remains valid when random mode is disabled with the final favorite');

console.log('cosmetic preferences checks passed');
