import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkpointTelemetry, onRequest } from '../functions/api/[[path]].js';
import { PlayerAccount } from '../src/player-account.js';

const api = readFileSync(new URL('../functions/api/[[path]].js', import.meta.url), 'utf8');
const client = readFileSync(new URL('../src/player-account.js', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/security-hardening-build99.sql', import.meta.url), 'utf8');
const wrangler = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');

assert.doesNotMatch(api, /request\.formData\(/, 'all account forms use the bounded parser');
assert.doesNotMatch(api, /player\/wallet\/import|player\/account\/login\/complete/, 'legacy wallet and login form routes are removed');
assert.doesNotMatch(client, /decodeJwtPayload|importLegacy\(/, 'the browser cannot adopt unsigned fragment sessions or invoke legacy import');
assert.match(api, /isSameOriginRequest\(request\)/, 'sensitive account forms enforce same-origin submission');
assert.match(client, /const \{ refreshToken: _removed/, 'refresh tokens are stripped before browser persistence');
assert.match(migration, /leaderboard_runs_one_active_user_idx/, 'one active authenticated run is enforced in PostgreSQL');
assert.match(migration, /for update;[\s\S]*CHECKPOINT_TOKEN_INVALID/, 'checkpoint transitions serialize under a row lock');
assert.match(migration, /create or replace function public\.submit_verified_score[\s\S]*for update;[\s\S]*insert into public\.leaderboard_scores/, 'score insertion and run consumption are one transaction');
assert.match(migration, /status='quarantined'/, 'implausible final telemetry is quarantined instead of ranked');
assert.match(migration, /record_boss_assault_checkpoint[\s\S]*PHASE_DAMAGE_MISMATCH/, 'Global Warden damage is bound to phase checkpoints');
assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\('market-list:'/, 'concurrent market listings share an account lock');
assert.match(wrangler, /"compatibility_date": "2026-08-31"/, 'Cloudflare compatibility is versioned');
assert.match(wrangler, /"observability"[\s\S]*"enabled": true/, 'Worker observability is versioned');
assert.match(wrangler, /"pages_build_output_dir": "\.\/dist"/, 'Pages publishes the allowlisted build rather than the repository root');

assert.deepEqual(checkpointTelemetry({ sequence: 1, elapsedMs: 20_000, score: 100, zone: 1, wardens: 0, enemies: 2, crates: 0, bestCombo: 1 }), {
  sequence: 1, elapsedMs: 20_000, score: 100, zone: 1, wardens: 0, enemies: 2, crates: 0, bestCombo: 1,
});
assert.equal(checkpointTelemetry({ sequence: 1, elapsedMs: 20_000, score: -1, zone: 1, wardens: 0, enemies: 2, crates: 0, bestCombo: 1 }), null, 'invalid telemetry fails closed');

const storage = { value: JSON.stringify({ accessToken: 'access', refreshToken: 'secret-refresh', expiresAt: Math.floor(Date.now()/1000)+3600, player: { id: 'pilot', anonymous: false } }), getItem(){return this.value;}, setItem(_key,value){this.value=value;}, removeItem(){this.value=null;} };
const account = new PlayerAccount(storage);
assert.equal(account.session.refreshToken, undefined);
assert.equal(JSON.parse(storage.value).refreshToken, undefined, 'an existing local refresh token is scrubbed immediately');

const oversized = new Request('https://crownlizard.com/api/player/account/callback', {
  method: 'POST', headers: { Origin: 'https://crownlizard.com', 'Content-Type': 'application/x-www-form-urlencoded' },
  body: `token_hash=${'x'.repeat(5000)}&type=recovery`,
});
const response = await onRequest({ request: oversized, env: { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SECRET_KEY: 'secret', SUPABASE_PUBLISHABLE_KEY: 'public', SCORE_HASH_SALT: 'salt' }, params: { path: ['player','account','callback'] } });
assert.equal(response.status, 400, 'oversized account forms are rejected before auth exchange');

console.log('Build 99 security hardening tests passed');
