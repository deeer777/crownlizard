import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ACTIVE_LEADERBOARD_SEASON, SUPPORTED_GAME_VERSIONS, onRequest } from '../functions/api/[[path]].js';

const migration = readFileSync(new URL('../supabase/leaderboard-seasons-p1b.sql', import.meta.url), 'utf8');
const canonicalBuilder = readFileSync(new URL('../tools/build-canonical-schema.mjs', import.meta.url), 'utf8');
const env = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SECRET_KEY: 'server-secret',
  SUPABASE_PUBLISHABLE_KEY: 'browser-publishable',
  SCORE_HASH_SALT: 'leaderboard-season-salt',
};
const runId = '123e4567-e89b-42d3-a456-426614174000';

assert.equal(ACTIVE_LEADERBOARD_SEASON, 'season-1', 'the active competitive board has one explicit server-owned season');
assert.deepEqual([...SUPPORTED_GAME_VERSIONS], ['0.45.1-113', '0.46.0-114'], 'only the current and immediately previous build may start verified runs');
assert.match(migration, /add column if not exists season_id text not null default 'preseason'/, 'historical runs and scores are preserved in preseason');
assert.match(migration, /p_season_id text default 'preseason'/, 'an older Worker falls back to the archived preseason during rolling deployment');
assert.match(migration, /drop function if exists public\.start_verified_run\(uuid,text,text,text,text,text\)/, 'the season migration can safely replace its own six-argument run starter');
assert.match(migration, /insert into public\.leaderboard_scores[\s\S]*game_version,season_id\)[\s\S]*r\.game_version,r\.season_id/, 'score settlement copies the trusted run season');
assert.match(migration, /leaderboard_scores_season_rank_idx[\s\S]*season_id, difficulty, score desc/, 'active-season ranking has a matching database index');
assert.match(canonicalBuilder, /supabase\/leaderboard-seasons-p1b\.sql/, 'fresh database bootstraps include the season migration');

const rejected = await onRequest({
  request: new Request('https://crownlizard.com/api/runs', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ difficulty: 'arcade', gameVersion: '0.44.3-110' }),
  }),
  env,
  params: { path: ['runs'] },
});
assert.equal(rejected.status, 400, 'a build outside the two-build compatibility window cannot start a verified run');

const originalFetch = globalThis.fetch;
const calls = [];
let archivedScoreRequest = false;
globalThis.fetch = async (url, options = {}) => {
  const href = String(url);
  calls.push({ href, options });
  if (href.includes('/rest/v1/leaderboard_runs?')) {
    if (archivedScoreRequest) return Response.json([{
      id: runId, user_id: null, difficulty: 'arcade', game_version: '0.45.0-112', season_id: 'preseason',
      created_at: new Date(Date.now() - 60_000).toISOString(), used_at: null, status: 'active', approved_summary: null,
    }]);
    return Response.json([]);
  }
  if (href.endsWith('/rest/v1/rpc/start_verified_run')) return Response.json({
    id: runId, season: ACTIVE_LEADERBOARD_SEASON, startedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  if (href.endsWith('/rest/v1/rpc/leaderboard_snapshot')) return Response.json({ scores: [], total: 0, personal: null });
  throw new Error(`Unexpected season test request: ${href}`);
};

try {
  const started = await onRequest({
    request: new Request('https://crownlizard.com/api/runs', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.8' }, body: JSON.stringify({ difficulty: 'arcade', gameVersion: '0.46.0-114' }),
    }),
    env,
    params: { path: ['runs'] },
  });
  assert.equal(started.status, 201, 'the current build can start a verified Season 1 run');
  assert.equal((await started.json()).season, ACTIVE_LEADERBOARD_SEASON, 'run registration returns its competitive season');
  const startRpc = calls.find(call => call.href.endsWith('/rest/v1/rpc/start_verified_run'));
  assert.equal(JSON.parse(startRpc.options.body).p_season_id, ACTIVE_LEADERBOARD_SEASON, 'the edge API, not the browser, supplies the active season to PostgreSQL');

  const board = await onRequest({
    request: new Request('https://crownlizard.com/api/scores?difficulty=arcade'), env, params: { path: ['scores'] },
  });
  assert.equal((await board.json()).season, ACTIVE_LEADERBOARD_SEASON, 'leaderboard responses identify the active season');
  const boardCall = calls.find(call => call.href.endsWith('/rest/v1/rpc/leaderboard_snapshot'));
  assert.equal(JSON.parse(boardCall.options.body).p_season_id, ACTIVE_LEADERBOARD_SEASON, 'leaderboard reads cannot mix archived and active scores');

  archivedScoreRequest = true;
  const archived = await onRequest({
    request: new Request('https://crownlizard.com/api/scores', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runId }),
    }),
    env,
    params: { path: ['scores'] },
  });
  assert.equal(archived.status, 409, 'an archived run cannot be submitted onto the active leaderboard');
  assert.equal((await archived.json()).code, 'SEASON_CLOSED', 'archived season rejection has a stable client error code');
} finally {
  globalThis.fetch = originalFetch;
}

console.log('Leaderboard season and build-window tests passed');
