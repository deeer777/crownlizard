import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COLLECTION_COSMETICS, COSMETICS } from '../src/cosmetics.js';

const gameSource = readFileSync(new URL('../src/game.js', import.meta.url), 'utf8');
const mainSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

const ships = COLLECTION_COSMETICS.filter(cosmetic => cosmetic.slot === 'ship');
const weaponSkins = COSMETICS.filter(cosmetic => cosmetic.slot.startsWith('weapon_'));
const trails = COLLECTION_COSMETICS.filter(cosmetic => cosmetic.slot === 'trail');
const dashEffects = COLLECTION_COSMETICS.filter(cosmetic => cosmetic.slot === 'dash');

assert.ok(ships.length >= 10, 'the shared collection retains the full ship roster');
for (const ship of ships) {
  assert.ok(ship.flightFx?.style, `${ship.name} has a flight-effect silhouette`);
  assert.match(ship.flightFx.primary, /^#[0-9a-f]{6}$/i, `${ship.name} has a primary flight color`);
  assert.match(ship.flightFx.secondary, /^#[0-9a-f]{6}$/i, `${ship.name} has a secondary flight color`);
}

assert.ok(new Set(ships.map(ship => ship.flightFx.style)).size >= 5, 'ship unlocks expose at least five visibly different wake families');
for (const skin of weaponSkins) assert.notEqual(skin.projectileStyle, 'issue', `${skin.name} changes projectile silhouette as well as color`);
assert.ok(new Set(weaponSkins.map(skin => skin.projectileStyle)).size === weaponSkins.length, 'each premium weapon skin has its own projectile identity');

assert.equal(trails.length, 5, 'the Vault exposes a default plus four collectible trails');
assert.equal(dashEffects.length, 4, 'the Vault exposes a default plus three collectible dash effects');
assert.ok(trails.every(cosmetic => cosmetic.effectSprite && cosmetic.effectFx), 'every trail has a visible sprite and live effect identity');
assert.ok(dashEffects.every(cosmetic => cosmetic.effectSprite && cosmetic.effectFx), 'every dash effect has a visible sprite and live effect identity');
assert.match(gameSource, /this\.dashFx\.primary/, 'the equipped dash slot controls the live dash burst');
assert.match(gameSource, /this\.trailFx\.style/, 'the equipped trail slot controls the continuous flight wake');
assert.match(gameSource, /trail\.style === 'sparks'[\s\S]*trail\.style === 'rift'/, 'the live renderer contains multiple pixel-wake silhouettes');
assert.match(gameSource, /projectileStyle === 'prism'[\s\S]*projectileStyle === 'void-lance'/, 'laser skins render distinct silhouettes');
assert.match(gameSource, /projectileStyle === 'solar'[\s\S]*projectileStyle === 'eclipse'/, 'pulse skins render distinct silhouettes');
assert.match(gameSource, /projectileStyle === 'verdant'[\s\S]*projectileStyle === 'storm'/, 'tesla skins render distinct silhouettes');
assert.match(mainSource, /game\.setPlayerSkin\(cosmetic\.sprite, cosmetic\.flightFx\)/, 'the same shared cosmetic applies its flight identity in every platform build');
assert.match(mainSource, /game\.setCosmeticEffects\(/, 'shared builds equip independent trail and dash slots');
assert.match(styles, /\.cosmetic-detail-preview\.ship-flight-preview\[data-flight-style="crown"\]/, 'Vault previews expose the equipped flight identity before play');

console.log('Shared ship flight and weapon projectile identities passed');
