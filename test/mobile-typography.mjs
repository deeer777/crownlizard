import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const auditStart = css.indexOf('/* Pixel fonts lose their shape');
const auditEnd = css.indexOf('@media (prefers-reduced-motion', auditStart);

assert.ok(auditStart >= 0 && auditEnd > auditStart, 'the mobile readability layer must remain present');

const mobileReadability = css.slice(auditStart, auditEnd);
assert.doesNotMatch(
  mobileReadability,
  /font-size:\s*[5-7]px/,
  'the final mobile readability layer must not introduce 5–7 px text',
);
assert.match(mobileReadability, /\.arcade-status small \{ font-size: 10px; \}/, 'menu status labels stay readable');
assert.match(mobileReadability, /\.arcade-status b \{ font-size: 12px; \}/, 'menu player and score values stay prominent');
assert.match(html, /class="status-shards"><small>◆ SHARDS<\/small><b id="menuShards">0<\/b>/, 'shards use the same label-over-value structure as player and high score');
assert.match(main, /ui\.menuShards\.textContent = walletState\(\)\.balance\.toLocaleString\('en-US'\);/, 'the shard value does not repeat its label inline');
assert.doesNotMatch(main, /menuShards\.textContent = `◆ \$\{walletState/, 'the old inline shard presentation cannot return');
assert.match(css, /\.arcade-status \{[\s\S]*?transform: translateY\(-22px\);/, 'the player status row uses the free space above the logo');
assert.match(mobileReadability, /\.leaderboard-list li \{ font-size: 11px; \}/, 'mobile leaderboard rows stay readable');
assert.match(mobileReadability, /\.setting-list button,\s*\.setting-list a \{ min-height: 52px; font-size: 11px; \}/, 'settings buttons and crawlable links remain readable and touch-friendly');
assert.match(mobileReadability, /\.hero-panel \.menu-event \{[\s\S]*grid-template-areas: "event-name event-state" "event-time event-time"[\s\S]*width: min\(300px,calc\(100vw - 24px\)\)/, 'the Warden mobile choice uses an intentional two-level layout instead of three squeezed columns');
assert.match(mobileReadability, /\.hero-panel \.menu-event > span \{[\s\S]*white-space: nowrap/, 'the Global Warden name cannot wrap on narrow phones');
assert.match(mobileReadability, /\.hero-panel \.menu-event small \{[\s\S]*grid-area: event-time[\s\S]*text-align: center/, 'the event countdown owns a centered second line');

console.log('Mobile typography hierarchy test passed');
