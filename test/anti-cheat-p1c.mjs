import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { endlessTelemetryLimits } from '../functions/api/[[path]].js';

assert.deepEqual(endlessTelemetryLimits(120_000), {
  zone: 2, wardens: 1, enemies: 992, crates: 19, bestCombo: 9, score: 46_000,
}, 'endless limits are deterministic at a stage boundary');

const migration = await readFile(new URL('../supabase/anti-cheat-p1c.sql', import.meta.url), 'utf8');
const canonicalBuilder = await readFile(new URL('../tools/build-canonical-schema.mjs', import.meta.url), 'utf8');
assert.match(migration, /combo_count integer := coalesce\(\(p_telemetry->>'bestCombo'\)::integer, 1\)[\s\S]*combo_count between 1 and 9/, 'database verification owns the engine combo cap');
assert.match(migration, /p_elapsed_ms < p_sequence\*15000/, 'checkpoint sequences cannot be manufactured ahead of gameplay time');
assert.match(migration, /now\(\)-r\.last_checkpoint_at < interval '8 seconds'/, 'checkpoint chains cannot be replayed in an instant');
assert.match(migration, /CHECKPOINT_REGRESSION[\s\S]*complete_verified_run|complete_verified_run[\s\S]*CHECKPOINT_REGRESSION/, 'completion cannot rewind accepted telemetry');
assert.match(canonicalBuilder, /leaderboard-seasons-p1b\.sql'[\s\S]*anti-cheat-p1c\.sql'/, 'P1C is applied after its leaderboard compatibility migration');

console.log('P1C anti-cheat contracts passed');
