import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { onRequest } from '../functions/api/[[path]].js';

const migration = readFileSync(new URL('../supabase/leaderboard-personal-best-build114.sql', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

assert.match(migration, /partition by case[\s\S]*when score\.user_id is not null then 'user:'/, 'registered pilots occupy one best-score position');
assert.match(migration, /personal_order = 1/, 'only each identity best verified run reaches the ranked board');
assert.match(migration, /'above'[\s\S]*personal\.rank - 1[\s\S]*'below'[\s\S]*personal\.rank \+ 1/, 'the server returns the positions surrounding the player');
assert.match(migration, /revoke all on function public\.leaderboard_snapshot[\s\S]*grant execute[\s\S]*service_role/, 'the ranking snapshot stays behind the server API');
assert.match(html, /id="leaderboardPlayerResult"[\s\S]*id="leaderboardHead"|id="leaderboardPlayerResult"[\s\S]*class="leaderboard-head"/, 'the personal best appears before the ranked list');
assert.match(html, /id="leaderboardMore"/, 'the leaderboard has an explicit progressive-loading action');
assert.match(main, /let leaderboardLimit = 25/, 'the board starts at twenty-five positions');
assert.doesNotMatch(main, /TOP 10 · ALL-TIME/, 'the active-season board is not mislabeled as all-time');

const env = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SECRET_KEY: 'server-secret',
  SUPABASE_PUBLISHABLE_KEY: 'browser-publishable',
  SCORE_HASH_SALT: 'leaderboard-snapshot-salt',
};
const userId = '123e4567-e89b-42d3-a456-426614174000';
const entryId = '223e4567-e89b-42d3-a456-426614174000';
const originalFetch = globalThis.fetch;
let snapshotRequest = null;
globalThis.fetch = async (url, options = {}) => {
  const href = String(url);
  if (href.endsWith('/auth/v1/user')) return Response.json({ id: userId, is_anonymous: false });
  if (href.endsWith('/rest/v1/rpc/leaderboard_snapshot')) {
    snapshotRequest = JSON.parse(options.body);
    const entry = { id: entryId, rank: 47, playerName: 'PILOT_ONE', initials: 'PILOT_ONE', score: 9000, zone: 4 };
    return Response.json({ scores: [], total: 80, personal: { rank: 47, entry, above: { ...entry, id: crypto.randomUUID(), rank: 46, score: 9100 }, below: { ...entry, id: crypto.randomUUID(), rank: 48, score: 8900 } } });
  }
  throw new Error(`Unexpected snapshot request: ${href}`);
};

try {
  const response = await onRequest({
    request: new Request('https://crownlizard.com/api/scores?difficulty=arcade&limit=25', { headers: { Authorization: 'Bearer player-token' } }),
    env,
    params: { path: ['scores'] },
  });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.authenticated, true, 'an authenticated board identifies its private player snapshot');
  assert.equal(payload.personal.rank, 47, 'a rank outside the loaded top list is preserved');
  assert.equal(snapshotRequest.p_user_id, userId, 'the server derives the personal board identity from the verified token');
  assert.equal(snapshotRequest.p_limit, 25, 'the requested top-list window is bounded and forwarded');
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store', 'personal leaderboard responses cannot leak through shared caches');
} finally {
  globalThis.fetch = originalFetch;
}

console.log('Leaderboard personal-best test passed');
