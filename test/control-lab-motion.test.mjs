import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { FLIGHT_PROFILES, stepFlightMotion } from '../src/flight-control.js';

const simulate = (profile, movement, seconds, initial = { vx: 0, vy: 0 }) => {
  let velocity = initial;
  const dt = 1 / 120;
  for (let elapsed = 0; elapsed < seconds; elapsed += dt) velocity = stepFlightMotion(velocity, movement, profile, dt);
  return velocity;
};

const current = simulate(FLIGHT_PROFILES.current, { x: 1, y: 0 }, 3);
assert.ok(current.vx > 235 && current.vx < 255, `current baseline should settle near 245 px/s, got ${current.vx}`);

const arcade = simulate(FLIGHT_PROFILES.arcade, { x: 1, y: 0 }, .12);
assert.ok(arcade.vx >= 328, `arcade should reach 90% speed in about 120 ms, got ${arcade.vx}`);

const direct = simulate(FLIGHT_PROFILES.direct, { x: 1, y: 0 }, .06);
assert.ok(direct.vx >= 328, `direct should reach 90% speed in about 55 ms, got ${direct.vx}`);

const stopped = simulate(FLIGHT_PROFILES.arcade, { x: 0, y: 0 }, .09, { vx: 365, vy: 0 });
assert.ok(stopped.vx <= 36.5, `arcade should brake to 10% speed in about 85 ms, got ${stopped.vx}`);

const diagonal = simulate(FLIGHT_PROFILES.arcade, { x: Math.SQRT1_2, y: Math.SQRT1_2 }, 1);
assert.ok(Math.hypot(diagonal.vx, diagonal.vy) <= 365.001, 'diagonal movement must not exceed max speed');

const gameSource = await readFile(new URL('../src/game.js', import.meta.url), 'utf8');
assert.match(gameSource, /stepFlightMotion\(player, movement, FLIGHT_PROFILES\.arcade/, 'the selected Arcade profile must drive production gameplay');
assert.doesNotMatch(gameSource, /player\.vx \+= movement\.x \* CONFIG\.player\.acceleration/, 'the old acceleration and drag path must not remain active');

console.log('Control Lab motion profiles verified.');
