import assert from 'node:assert/strict';
import { normalizeInitials } from '../src/leaderboard.js';
import { onRequest, validateScorePayload } from '../functions/api/[[path]].js';

assert.equal(normalizeInitials(' a!b-9z '), 'AB9', 'initials are normalized to three arcade characters');
assert.equal(normalizeInitials('åäö'), '', 'unsupported characters are removed');

const now = Date.now();
const run = {
  difficulty: 'arcade',
  game_version: '0.10.0-38',
  created_at: new Date(now - 125_000).toISOString(),
  used_at: null,
};
const valid = {
  initials: 'CLZ',
  score: 184500,
  difficulty: 'arcade',
  durationMs: 120000,
  zone: 2,
  wardens: 1,
  enemies: 94,
  crates: 7,
  bestCombo: 12,
  gameVersion: '0.10.0-38',
};

assert.ok(validateScorePayload(valid, run, now).value, 'a plausible finished run is accepted');
assert.match(validateScorePayload({ ...valid, initials: 'TOOLONG' }, run, now).error, /3 initials/, 'invalid initials are rejected');
assert.match(validateScorePayload({ ...valid, score: 999_999_999 }, run, now).error, /verified range/, 'implausible score is rejected');
assert.match(validateScorePayload({ ...valid, zone: 20 }, run, now).error, /statistics/, 'impossible zone progression is rejected');
assert.match(validateScorePayload(valid, { ...run, used_at: new Date().toISOString() }, now).error, /already submitted/, 'a run can only be submitted once');

const unconfigured = await onRequest({
  request: new Request('https://crownlizard.com/api/scores?difficulty=arcade'),
  env: {},
  params: { path: ['scores'] },
});
assert.equal(unconfigured.status, 503, 'API fails closed while secrets are missing');

console.log('Leaderboard validation test passed');
