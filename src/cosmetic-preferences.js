const STORAGE_KEY = 'cl:cosmetic-preferences:v1';

const cleanIds = ids => [...new Set((Array.isArray(ids) ? ids : []).map(String).filter(Boolean))];

export class CosmeticPreferences {
  constructor({ storage = globalThis.localStorage, random = Math.random } = {}) {
    this.storage = storage;
    this.random = random;
    this.lastRandomShip = '';
  }

  getState() {
    try {
      const saved = JSON.parse(this.storage?.getItem(STORAGE_KEY) || 'null');
      return { favorites: cleanIds(saved?.favorites), randomFavorite: Boolean(saved?.randomFavorite) };
    } catch {
      return { favorites: [], randomFavorite: false };
    }
  }

  save(state) {
    const next = { favorites: cleanIds(state.favorites), randomFavorite: Boolean(state.randomFavorite) };
    try { this.storage?.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
    return next;
  }

  toggleFavorite(cosmeticId, ownedIds) {
    const owned = new Set(['ship_default', ...cleanIds(ownedIds)]);
    if (!owned.has(cosmeticId)) throw new Error('COSMETIC_LOCKED');
    const state = this.getState();
    const favorites = new Set(state.favorites.filter(id => owned.has(id)));
    if (favorites.has(cosmeticId)) favorites.delete(cosmeticId);
    else favorites.add(cosmeticId);
    return this.save({ ...state, favorites: [...favorites], randomFavorite: favorites.size ? state.randomFavorite : false });
  }

  toggleRandom(ownedIds) {
    const owned = new Set(['ship_default', ...cleanIds(ownedIds)]);
    const state = this.getState();
    const favorites = state.favorites.filter(id => owned.has(id));
    if (!favorites.length) throw new Error('NO_FAVORITES');
    return this.save({ favorites, randomFavorite: !state.randomFavorite });
  }

  chooseShip(ownedIds, equippedId = 'ship_default') {
    const owned = new Set(['ship_default', ...cleanIds(ownedIds)]);
    const state = this.getState();
    const favorites = state.favorites.filter(id => owned.has(id));
    if (!state.randomFavorite || !favorites.length) return owned.has(equippedId) ? equippedId : 'ship_default';
    const alternatives = favorites.length > 1 ? favorites.filter(id => id !== this.lastRandomShip) : favorites;
    const selected = alternatives[Math.min(alternatives.length - 1, Math.floor(this.random() * alternatives.length))];
    this.lastRandomShip = selected;
    return selected;
  }
}
