import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [css, html, release] = await Promise.all([
  readFile(new URL('../styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../release.json', import.meta.url), 'utf8').then(JSON.parse),
]);

const desktop = css.slice(css.indexOf('@media (min-width: 900px)'));
assert.ok(desktop.length > 0, 'desktop breakpoint must exist');
assert.match(desktop, /\.hero-panel\s*\{[^}]*width:\s*min\(820px,100%\)/s, 'desktop menu uses a wider command deck');
assert.match(desktop, /\.arcade-status small\s*\{\s*font-size:\s*9px;/, 'desktop status labels stay readable');
assert.match(desktop, /\.hero-panel \.menu-choice,[\s\S]*?font-size:\s*15px;/, 'desktop menu actions use arcade-scale type');
assert.match(desktop, /\.leaderboard-panel\s*\{[^}]*width:\s*min\(920px,100%\)/s, 'desktop leaderboard uses available width');
assert.match(desktop, /\.vault-panel\s*\{[^}]*width:\s*min\(1180px,100%\)/s, 'desktop vault has a full command deck');
assert.match(desktop, /\.vault-overlay\s*\{\s*align-items:\s*start;/, 'Vault tabs and categories keep one stable desktop anchor');
assert.match(desktop, /\.vault-collection\s*\{\s*grid-template-columns:\s*repeat\(4,minmax\(0,1fr\)\)/, 'desktop collection favors four legible cosmetic cards over five miniature cards');
assert.match(desktop, /\.vault-cosmetic img\s*\{\s*width:\s*94px;\s*height:\s*94px;/, 'desktop collection keeps ship and effect sprites inspectable');
assert.match(desktop, /\.system-panel\.system-panel :where\(p,small,label\)\s*\{\s*font-size:\s*11px;/, 'supporting desktop copy has an explicit readability floor');
assert.match(desktop, /\.pwa-panel > \.eyebrow\s*\{\s*font-size:\s*13px;/, 'the update build identifier is readable');
assert.match(desktop, /\.warden-panel\s*\{[^}]*width:\s*min\(1180px,100%\)/s, 'desktop Warden layout uses available width');
assert.match(desktop, /\.duel-panel\s*\{[^}]*width:\s*min\(1180px,100%\)/s, 'desktop Duel layout uses available width');
assert.match(desktop, /\.weapon-hud b\s*\{\s*font-size:\s*15px;/, 'desktop active weapon is legible');
assert.match(desktop, /\.score-block strong\s*\{\s*font-size:\s*36px;/, 'desktop score remains the HUD focal point');
assert.doesNotMatch(desktop, /#game\s*\{[^}]*width/s, 'desktop UI must not alter competitive canvas geometry');
assert.equal(release.release, '0.46.0');
assert.equal(release.build, 114);
assert.match(html, /styles\.css\?v=20260909-114-pilot-ranking/);
assert.ok(html.indexOf('id="armoryGrid"') < html.indexOf('id="armorySelected"'), 'the selected Warden blueprint appears directly after its archive instead of far above it');

console.log('Desktop command deck hierarchy and shared responsive layout passed');
