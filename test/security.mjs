import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { secureRandom } from '../src/cosmetics.js';

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const headers = readFileSync(new URL('../_headers', import.meta.url), 'utf8');

assert.match(main, /const debugMode = localPreview && debugParams\.has\('debug'\)/, 'debug controls require both localhost and the explicit debug flag');
assert.doesNotMatch(main, /debugParams\.has\('debug'\) \|\| localPreview/, 'a public query parameter can never enable debug controls');
assert.match(index, /main\.js\?v=20260824-45-cutover/, 'the server-wallet cutover ships behind a fresh browser cache key');
assert.match(main, /const serverEconomy = !localPreview/, 'production selects the server wallet while localhost retains its test wallet');
assert.match(main, /localPreview \? shardWallet\.openCrate\(\) : await playerAccount\.openCrate\(\)/, 'production crate openings cannot call the local wallet');
assert.match(main, /if \(localPreview\) \{[\s\S]*shardWallet\.awardRun/, 'local shard settlement is isolated to localhost');
assert.match(headers, /script-src 'self'/, 'production only permits first-party scripts');
assert.match(headers, /frame-ancestors 'none'/, 'the game cannot be framed for clickjacking');
assert.match(headers, /object-src 'none'/, 'legacy plugin content is disabled');

for (let index = 0; index < 32; index += 1) {
  const value = secureRandom();
  assert.ok(value >= 0 && value < 1, 'Web Crypto random values remain within the crate roller range');
}

console.log('Security regression test passed');
