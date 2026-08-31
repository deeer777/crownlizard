import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const baseUrl = new URL(process.argv[2] || process.env.CROWNLIZARD_SMOKE_URL || 'https://crownlizard.com');
const accessToken = String(process.env.CROWNLIZARD_SMOKE_ACCESS_TOKEN || '');
const expectedRelease = JSON.parse(await readFile(new URL('../release.json', import.meta.url), 'utf8'));
const request = async (path, validate, token = '') => {
  const url = new URL(path, baseUrl);
  const response = await fetch(url, {
    headers: { Accept: path === '/' ? 'text/html' : 'application/json', 'Cache-Control': 'no-cache', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    signal: AbortSignal.timeout(12_000),
  });
  const body = path === '/' ? await response.text() : await response.json().catch(() => null);
  assert.equal(response.ok, true, `${url.pathname} returned ${response.status}: ${JSON.stringify(body)}`);
  assert.ok(!body?.code || body.code !== 'NETWORK_NOT_CONFIGURED', `${url.pathname} reports missing production configuration`);
  validate(body, response);
  console.log(`PASS ${response.status} ${url.pathname}${url.search}`);
  return body;
};

await request('/', html => assert.match(html, /Crown Lizard/i));
const release = await request('/release.json', value => {
  assert.ok(Number.isInteger(value?.build) && value.build > 0);
  assert.match(String(value?.release || ''), /^\d+\.\d+\.\d+$/);
});
assert.deepEqual({ release: release.release, build: release.build }, { release: expectedRelease.release, build: expectedRelease.build }, 'production is not serving the local release yet');
await request('/build-meta.json', value => assert.deepEqual({ release: value?.release, build: value?.build }, { release: release.release, build: release.build }));
for (const difficulty of ['chill', 'arcade', 'crowned']) {
  await request(`/api/scores?difficulty=${difficulty}&limit=3`, value => {
    assert.equal(value?.difficulty, difficulty);
    assert.ok(Array.isArray(value?.scores));
  });
}
const boss = await request('/api/boss/event', value => {
  assert.ok(Object.hasOwn(value || {}, 'event'));
  assert.ok(Object.hasOwn(value || {}, 'nextEvent'));
  assert.ok(value?.ranking && Array.isArray(value.ranking.leaders));
});
const eventId = boss?.event?.id || boss?.nextEvent?.id;
if (eventId) await request(`/api/boss/leaderboard?eventId=${encodeURIComponent(eventId)}&limit=3`, value => assert.ok(Array.isArray(value?.ranking?.leaders)));
await request('/api/market', value => assert.ok(value?.market && Array.isArray(value.market.listings)));

if (accessToken) {
  await request('/api/player/wallet', value => {
    assert.ok(value?.player?.id);
    assert.ok(Number.isFinite(value?.wallet?.balance));
  }, accessToken);
  await request('/api/player/profile', value => assert.ok(Object.hasOwn(value || {}, 'profile')), accessToken);
} else {
  console.log('SKIP authenticated wallet/profile smoke (set CROWNLIZARD_SMOKE_ACCESS_TOKEN to enable).');
}
console.log(`Production smoke passed for ${baseUrl.origin} Build ${release.build}.`);
