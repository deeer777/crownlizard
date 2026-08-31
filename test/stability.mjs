import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { onRequest } from '../functions/api/[[path]].js';

const wrangler = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
const pagesRequirements = JSON.parse(readFileSync(new URL('../cloudflare-pages.required.json', import.meta.url), 'utf8'));
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const migration = readFileSync(new URL('../supabase/stability-build99.sql', import.meta.url), 'utf8');
const canonicalBuilder = readFileSync(new URL('../tools/build-canonical-schema.mjs', import.meta.url), 'utf8');

assert.equal(wrangler.secrets, undefined, 'Pages config must not use the Worker-only secrets declaration');
assert.equal(pagesRequirements.project, wrangler.name);
assert.deepEqual([...(pagesRequirements.secrets || [])].sort(), ['SCORE_HASH_SALT', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'SUPABASE_URL']);
assert.match(packageJson.scripts['deploy:production'], /release:verify[\s\S]*cloudflare:secrets[\s\S]*pages deploy[\s\S]*smoke:production/, 'production deploy is guarded before and after upload');
assert.match(migration, /limit greatest\(1, least\(coalesce\(p_limit, 100\), 500\)\)/, 'expired run maintenance is bounded');
assert.match(migration, /r\.status in \('expired', 'abandoned'\)[\s\S]*interval '30 days'/, 'only old non-active checkpoint telemetry is pruned');
assert.match(canonicalBuilder, /supabase\/stability-build99\.sql/, 'the stabilization migration is part of canonical bootstrap');

const originalError = console.error;
console.error = () => {};
try {
  const missingConfig = await onRequest({ request: new Request('https://crownlizard.com/api/scores'), env: {}, params: { path: ['scores'] } });
  const missingBody = await missingConfig.json();
  assert.equal(missingConfig.status, 503);
  assert.equal(missingBody.code, 'NETWORK_NOT_CONFIGURED');
  assert.match(missingBody.requestId, /^[0-9a-f-]{36}$/i);
  assert.equal(missingConfig.headers.get('X-Crown-Request-ID'), missingBody.requestId);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('{}', { status: 500, headers: { 'Content-Type': 'application/json' } });
  try {
    const upstream = await onRequest({
      request: new Request('https://crownlizard.com/api/scores', { headers: { 'CF-Ray': 'test-ray-123' } }),
      env: { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SECRET_KEY: 'secret', SUPABASE_PUBLISHABLE_KEY: 'public', SCORE_HASH_SALT: 'salt' },
      params: { path: ['scores'] },
    });
    const upstreamBody = await upstream.json();
    assert.equal(upstream.status, 503);
    assert.equal(upstreamBody.code, 'DATABASE_UPSTREAM_ERROR');
    assert.equal(upstreamBody.requestId, 'test-ray-123');
  } finally {
    globalThis.fetch = originalFetch;
  }
} finally {
  console.error = originalError;
}

console.log('Stabilization release and API contracts passed');
