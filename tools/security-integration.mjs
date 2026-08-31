import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';

const url = String(process.env.CROWNLIZARD_TEST_SUPABASE_URL || '').replace(/\/$/, '');
const key = String(process.env.CROWNLIZARD_TEST_SUPABASE_SECRET_KEY || '');
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) || !key) {
  throw new Error('Set CROWNLIZARD_TEST_SUPABASE_URL and CROWNLIZARD_TEST_SUPABASE_SECRET_KEY for an isolated test project.');
}
if (url.includes('pqzjmnkfzuduvcozujoj')) throw new Error('Refusing to run destructive concurrency tests against the Crown Lizard production project.');

const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const call = async (resource, body, options = {}) => {
  const response = await fetch(`${url}/rest/v1/${resource}`, { method: options.method || 'POST', headers: { ...headers, ...(options.headers || {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${resource} failed (${response.status}): ${JSON.stringify(payload)}`);
  return payload;
};
const hash = value => createHash('sha256').update(value).digest('hex');

const ipHash = hash(`integration:${randomUUID()}`);
const checkpointToken = randomUUID();
let runId = '';
try {
  const started = await call('rpc/start_verified_run', {
    p_user_id: null, p_difficulty: 'arcade', p_game_version: '0.39.0-99', p_ip_hash: ipHash,
    p_checkpoint_token_hash: hash(checkpointToken),
  });
  runId = started.id;
  const summary = { sequence: 1, elapsedMs: 5000, score: 100, zone: 1, wardens: 0, enemies: 1, crates: 0, bestCombo: 1, masteries: [] };
  const completed = await call('rpc/complete_verified_run', {
    p_user_id: null, p_ip_hash: ipHash, p_run_id: runId, p_token_hash: hash(checkpointToken), p_elapsed_ms: 5000, p_summary: summary,
  });
  assert.equal(completed.error, undefined, 'the isolated run completes');

  const scoreBody = { p_run_id: runId, p_user_id: null, p_initials: 'TST', p_player_name: 'TST' };
  const results = await Promise.all(Array.from({ length: 8 }, () => call('rpc/submit_verified_score', scoreBody)));
  assert.equal(new Set(results.map(result => String(result.id))).size, 1, 'all concurrent score submissions resolve to one row');
  assert.equal(results.filter(result => result.duplicate === false).length, 1, 'exactly one concurrent request creates the score');
  assert.equal(results.filter(result => result.duplicate === true).length, 7, 'the remaining requests are idempotent replays');
  console.log('Isolated Supabase score concurrency test passed.');
} finally {
  if (runId) {
    await call(`leaderboard_scores?run_id=eq.${encodeURIComponent(runId)}`, undefined, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).catch(() => null);
    await call(`leaderboard_runs?id=eq.${encodeURIComponent(runId)}`, undefined, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).catch(() => null);
  }
}
