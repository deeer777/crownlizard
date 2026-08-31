import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeInitials } from '../src/leaderboard.js';
import { onRequest, validateScorePayload } from '../functions/api/[[path]].js';

assert.equal(normalizeInitials(' a!b-9z '), 'AB9', 'initials are normalized to three arcade characters');
assert.equal(normalizeInitials('åäö'), '', 'unsupported characters are removed');

const now = Date.now();
const run = {
  difficulty: 'arcade',
  game_version: '0.13.0-44',
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
  gameVersion: '0.13.0-44',
};

assert.ok(validateScorePayload(valid, run, now).value, 'a plausible finished run is accepted');
assert.match(validateScorePayload({ ...valid, initials: 'TOOLONG' }, run, now).error, /3 initials/, 'invalid initials are rejected');
assert.match(validateScorePayload({ ...valid, score: 999_999_999 }, run, now).error, /verified range/, 'implausible score is rejected');
assert.match(validateScorePayload({ ...valid, zone: 20 }, run, now).error, /statistics/, 'impossible zone progression is rejected');
assert.match(validateScorePayload(valid, { ...run, used_at: new Date().toISOString() }, now).error, /already submitted/, 'a run can only be submitted once');

const accountUserId = '123e4567-e89b-42d3-a456-426614174000';
const accountRun = { ...run, user_id: accountUserId };
const accountScore = validateScorePayload({ ...valid, initials: 'HAX' }, accountRun, now, { displayName: 'PILOT_ONE' });
assert.equal(accountScore.value.playerName, 'PILOT_ONE', 'an account score always uses the verified profile callsign');
assert.equal(accountScore.value.initials, null, 'legacy initials are never stored for account scores');
assert.equal(accountScore.value.userId, accountUserId, 'the score retains its authenticated owner');
assert.match(validateScorePayload(valid, accountRun, now, null).error, /callsign/, 'an account run cannot fall back to guest initials');

const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const mainSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(schema, /leaderboard_scores[\s\S]*user_id uuid references auth\.users/, 'leaderboard scores retain account ownership');
assert.match(schema, /player_name text not null check/, 'leaderboard scores retain a validated callsign snapshot');
assert.match(schema, /alter column initials drop not null/, 'account scores do not need legacy three-letter initials');
assert.match(schema, /before insert on public\.leaderboard_scores[\s\S]*fill_legacy_leaderboard_player_name/, 'the migration remains compatible with the previous live worker during rollout');
assert.match(indexSource, /id="scoreIdentity"[\s\S]*id="guestInitials"/, 'the result screen has separate account and guest identity presentations');
assert.match(mainSource, /scoreRun\?\.walletBound \? String\(playerProfile\?\.displayName/, 'an authenticated run renders the loaded callsign');
assert.match(mainSource, /\.{3}\(accountCallsign \? \{\} : \{ initials \}\)/, 'the browser omits legacy initials for account submissions');
const prepareScoreSource = mainSource.match(/const prepareScoreEntry = [\s\S]*?\n};/)?.[0] || '';
assert.doesNotMatch(prepareScoreSource, /button\.dataset\.setting/, 'score preparation never references settings controls');
assert.match(prepareScoreSource, /scoreTicket\.callsign = accountCallsign[\s\S]*ui\.submitScore\.classList\.remove\('hidden'\)/, 'score submission becomes available after both Chill and Crowned runs');

const unconfigured = await onRequest({
  request: new Request('https://crownlizard.com/api/scores?difficulty=arcade'),
  env: {},
  params: { path: ['scores'] },
});
assert.equal(unconfigured.status, 503, 'API fails closed while secrets are missing');

const originalFetch = globalThis.fetch;
const runId = '223e4567-e89b-42d3-a456-426614174000';
const insertedId = '323e4567-e89b-42d3-a456-426614174000';
let insertedScore = null;
globalThis.fetch = async (url, options = {}) => {
  const href = String(url);
  if (href.endsWith('/auth/v1/user')) return Response.json({ id: accountUserId, is_anonymous: false, email: 'pilot@example.com' });
  if (href.includes('/rest/v1/leaderboard_runs?') && options.method !== 'PATCH') return Response.json([{ id: runId, ...accountRun }]);
  if (href.includes('/rest/v1/player_profiles?')) return Response.json([{ user_id: accountUserId, display_name: 'PILOT_ONE', rename_count: 0 }]);
  if (href.endsWith('/rest/v1/rpc/complete_verified_run')) return Response.json({ summary: valid });
  if (href.endsWith('/rest/v1/rpc/submit_verified_score')) {
    insertedScore = JSON.parse(options.body);
    return Response.json({ id: insertedId });
  }
  if (href.includes('/rest/v1/leaderboard_runs?') && options.method === 'PATCH') return Response.json([]);
  if (href.includes('/rest/v1/leaderboard_scores?')) return Response.json([{ id: insertedId, run_id: runId, user_id: accountUserId, player_name: 'PILOT_ONE', initials: null, ...valid, duration_ms: valid.durationMs, best_combo: valid.bestCombo, game_version: valid.gameVersion, created_at: new Date().toISOString() }]);
  throw new Error(`Unexpected leaderboard fetch: ${href}`);
};

const accountSubmitResponse = await onRequest({
  request: new Request('https://crownlizard.com/api/scores', {
    method: 'POST',
    headers: { Authorization: 'Bearer account-access-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...valid, runId, initials: 'HAX', checkpointToken: '423e4567-e89b-42d3-a456-426614174000', sequence: 6 }),
  }),
  env: { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SECRET_KEY: 'server-secret', SUPABASE_PUBLISHABLE_KEY: 'browser-publishable', SCORE_HASH_SALT: 'leaderboard-salt' },
  params: { path: ['scores'] },
});
assert.equal(accountSubmitResponse.status, 201, `an authenticated callsign score is accepted: ${await accountSubmitResponse.clone().text()}`);
assert.equal(insertedScore.p_player_name, 'PILOT_ONE', 'the atomic database RPC receives the server-resolved callsign');
assert.equal(insertedScore.p_user_id, accountUserId, 'the atomic database RPC receives the verified owner');
assert.equal(insertedScore.p_initials, null, 'spoofed browser initials are discarded for an account run');
assert.equal((await accountSubmitResponse.json()).entry.playerName, 'PILOT_ONE', 'the response renders the account callsign immediately');
globalThis.fetch = originalFetch;

console.log('Leaderboard validation test passed');
