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
assert.match(html, /id="play"[\s\S]*?class="menu-label"><i>♛<\/i> START GAME<\/span>/, 'the selected crown and its menu text remain one compact visual label');
assert.match(html, /id="menuWarden"[\s\S]*?class="menu-label"><i>♛<\/i> GLOBAL WARDEN<\/span><em id="menuWardenState"/, 'the Warden badge follows the same compact label instead of occupying a distant column');
assert.match(css, /\.hero-panel \.menu-choice \.menu-label \{[\s\S]*display: inline-flex;[\s\S]*margin: 0;/, 'main-menu labels are centered as single inline groups');
assert.match(css, /\.hero-panel \.menu-choice i \{[\s\S]*position: static;[\s\S]*margin: 0 8px 0 0;/, 'the selection crown stays directly beside the label and cannot drift to the button edge');
assert.match(css, /\.hero-panel \.menu-choice i \{[^}]*transform: translateY\(-1px\);/, 'the crown glyph receives the optical vertical correction needed by the pixel font');
assert.doesNotMatch(css, /\.hero-panel \.menu-choice i \{[^}]*position: absolute;/, 'the old edge-pinned selection crown cannot return');
assert.doesNotMatch(html, /menu-meta-start/, 'the removed countdown row cannot leave an artificial gap below Global Warden');
assert.match(mobileReadability, /\.leaderboard-list li \{ font-size: 11px; \}/, 'mobile leaderboard rows stay readable');
assert.match(mobileReadability, /\.setting-list button,\s*\.setting-list a \{ min-height: 52px; font-size: 11px; \}/, 'settings buttons and crawlable links remain readable and touch-friendly');
assert.match(mobileReadability, /\.hero-panel \.menu-event \{[\s\S]*gap: 9px;[\s\S]*width: min\(332px,calc\(100vw - 28px\)\);[\s\S]*min-height: 44px;/, 'the Warden mobile choice follows the same single-row dimensions as every main-menu action');
assert.match(mobileReadability, /\.hero-panel \.menu-event > \.menu-label \{[\s\S]*font-size: inherit;[\s\S]*line-height: inherit;/, 'the Global Warden name inherits the shared arcade-menu typography');
assert.doesNotMatch(html, /id="menuWardenCountdown"/, 'the main menu does not render a second Warden countdown line');
assert.doesNotMatch(html, /id="menuDuel"[^>]*>[\s\S]*?<em>BETA<\/em>/, 'Crown Duel keeps its release status inside the lobby rather than inside the main menu');

console.log('Mobile typography hierarchy test passed');
