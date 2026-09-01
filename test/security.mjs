import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { secureRandom } from '../src/cosmetics.js';

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const headers = readFileSync(new URL('../_headers', import.meta.url), 'utf8');
const serverApi = readFileSync(new URL('../functions/api/[[path]].js', import.meta.url), 'utf8');

assert.match(main, /const debugMode = localPreview && debugParams\.has\('debug'\)/, 'debug controls require both localhost and the explicit debug flag');
assert.doesNotMatch(main, /debugParams\.has\('debug'\) \|\| localPreview/, 'a public query parameter can never enable debug controls');
assert.match(main, /const callsignPreviewMode = localPreview && debugParams\.has\('debug'\) && debugParams\.has\('callsign'\)/, 'the callsign UX simulator is strictly localhost-only');
assert.match(index, /main\.js\?v=20260902-105-responsive-flight/, 'the current frontend ships behind a fresh browser cache key');
assert.match(main, /player-account\.js\?v=20260901-102-duel-verified-final/, 'the account client cannot be served from an older browser cache');
assert.match(main, /account-presentation\.js\?v=20260826-73-cinematic-endings/, 'the single account presentation model ships behind the same cache boundary');
assert.match(index, /id="menuPlayer">GUEST/, 'the title screen reserves a clear arcade player identity slot');
assert.match(index, /id="menuMode"[\s\S]*GAME MODE/, 'difficulty selection remains a full-sized main menu action');
assert.doesNotMatch(index, /SELECT DIFFICULTY|class="controls"|scene-enemy|scene-orbit/, 'redundant title-screen clutter stays removed');
assert.match(main, /music\.playMenu\(\)/, 'menu screens use the dedicated menu soundtrack');
assert.match(main, /music\.playGame\(\)/, 'active runs switch to the game soundtrack');
assert.doesNotMatch(index, /action="\/api\/player\/account\/login\/complete"/, 'manual sign-in cannot accidentally leave the in-game account screen');
assert.match(main, /accountForm\.addEventListener\('submit',[\s\S]*event\.preventDefault\(\);[\s\S]*playerAccount\.login/, 'manual sign-in remains in the account UI and installs the verified session atomically');
assert.match(main, /currentAccountState\(\) === 'signed-in'/, 'signed-in presentation is derived from the stored permanent session, not redirect copy');
assert.match(main, /VERIFYING EMAIL\.\.\./, 'email verification presents immediate progress before the wallet finishes loading');
assert.match(index, /id="accountRecovery"[\s\S]*FORGOT PASSWORD\?/, 'sign in exposes an accessible password recovery action');
assert.match(index, /id="accountLogout"[\s\S]*LOG OUT[\s\S]*id="accountLogoutConfirm"/, 'signed-in players receive a full arcade logout flow');
assert.match(main, /playerAccount\.logout\(\)[\s\S]*playerProfile = null[\s\S]*serverWallet = null/, 'logout clears account presentation before creating a guest session');
assert.match(styles, /\.system-link \{[^}]*min-width: 245px[^}]*font: 400 11px\/1\.7 var\(--font-pixel-display\)/, 'secondary navigation uses the same full-size arcade typography as primary menu actions');
assert.match(styles, /\.account-tabs button \{ min-height: 48px; font-size: 9px; \}/, 'mobile account tabs keep readable copy and full touch targets');
assert.match(styles, /\.vault-categories \{ grid-template-columns: repeat\(2,1fr\); gap: 4px; \}/, 'mobile Vault categories remain scalable and readable');
assert.match(serverApi, /'0\.15\.1-56'/, 'the released frontend version can register server-owned runs');
assert.match(serverApi, /'0\.17\.4-74'/, 'Build 74 can register server-owned runs');
assert.match(serverApi, /'0\.18\.0-75'/, 'Build 75 can register server-owned runs');
assert.match(serverApi, /'0\.19\.0-76'/, 'Build 76 can register server-owned runs');
assert.match(serverApi, /'0\.20\.0-77'/, 'Build 77 can register server-owned runs');
assert.match(serverApi, /'0\.21\.0-78'/, 'Build 78 can register server-owned runs');
assert.match(serverApi, /'0\.33\.0-92'/, 'Build 92 can register server-owned runs');
assert.match(main, /render: \(\) => \{ if \(game\.active\) game\.render\(\); \}/, 'the full game canvas is not rendered behind the mobile title screen');
assert.doesNotMatch(main, /if \(!serverEconomyReady\) throw serverEconomyError/, 'an unavailable Vault cannot block game start');
assert.match(main, /cl:wallet-session-reset:v51/, 'one stale anonymous wallet session is discarded for the clean cutover');
assert.doesNotMatch(main, /Promise\.race\(\[playerReadyPromise, wait\(1200\)\]\)/, 'run registration no longer outruns the mobile wallet connection');
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
