import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

globalThis.innerWidth = 390;
globalThis.innerHeight = 844;
globalThis.devicePixelRatio = 3;
globalThis.addEventListener = () => {};

const { Game } = await import('../src/game.js');
const canvas = { width: 0, height: 0, style: {}, getContext: () => ({}) };
const input = { movement: () => ({ x: 0, y: 0 }), consumeDash: () => false };
const game = new Game(canvas, input, { hud: () => {} });

game.particles = [
  { x: 0, y: 0, vx: 0, vy: 0, life: -.1, maxLife: 1 },
  ...Array.from({ length: 605 }, (_, index) => ({ x: index, y: 0, vx: 0, vy: 0, life: 1, maxLife: 1 })),
];
game.trails = [{ life: -.1 }, { life: 1 }];
game.teslaArcs = Array.from({ length: 45 }, (_, index) => ({ life: index === 0 ? -.1 : 1 }));
game.impactFlashes = [{ life: -.1 }, { life: 1 }];
game.deathAnimations = [{ life: -.1, vx: 0, vy: 0, rotation: 0, spin: 0 }, { life: 1, vx: 0, vy: 0, rotation: 0, spin: 0 }];
const identities = [game.particles, game.trails, game.teslaArcs, game.impactFlashes, game.deathAnimations];
game.updateEffects(0);

[game.particles, game.trails, game.teslaArcs, game.impactFlashes, game.deathAnimations]
  .forEach((collection, index) => assert.strictEqual(collection, identities[index], 'effect cleanup retains array identities instead of allocating every simulation tick'));
assert.equal(game.particles.length, 600, 'particle pressure remains capped at the newest 600 live effects');
assert.equal(game.particles[0].x, 5, 'in-place capping preserves the newest live particles');
assert.equal(game.teslaArcs.length, 40, 'Tesla arc pressure remains capped in place');

game.enemies = [{ dead: false, type: 'chaser' }, { dead: true, type: 'chaser' }, { dead: false, type: 'weaver' }];
assert.equal(game.countActiveEnemies(), 2, 'active enemy counting excludes dead entities without a temporary array');
assert.equal(game.countActiveEnemies(enemy => enemy.type === 'weaver'), 1, 'typed active enemy counts remain accurate');

const source = await readFile(new URL('../src/game.js', import.meta.url), 'utf8');
assert.match(source, /backgroundGradientKey[\s\S]*createRadialGradient/, 'the stage background gradient is cached by viewport and zone');
assert.doesNotMatch(source, /this\.particles = this\.particles\.filter/, 'the hottest effect collection no longer allocates every tick');

console.log('P2A render-loop allocation tests passed');
