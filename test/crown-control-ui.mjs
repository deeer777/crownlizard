import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, main, account, styles, release, serviceWorker] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/main.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/player-account.js', import.meta.url), 'utf8'),
  readFile(new URL('../styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../release.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../sw.js', import.meta.url), 'utf8'),
]);

assert.match(html, /id="openRedeem" class="hidden"/);
assert.match(html, /id="openAdmin" class="hidden owner-setting"/);
assert.match(html, /id="redeemOverlay"[\s\S]*id="redeemForm"[\s\S]*id="redeemReward"/);
assert.match(html, /id="adminOverlay"[\s\S]*id="adminCodeForm"[\s\S]*id="adminCampaignList"/);
assert.match(html, /CODE SHOWN ONCE · COPY IT NOW/);
assert.match(html, /EACH CODE CAN BE USED ONCE PER ACCOUNT/);

assert.match(account, /getAdminSession\(\)[\s\S]*\/api\/admin\/session/);
assert.match(account, /createRewardCode\(campaign\)[\s\S]*\/api\/admin\/codes/);
assert.match(account, /setRewardCodeStatus\(codeId, status\)/);
assert.match(account, /redeemRewardCode\(code\)[\s\S]*\/api\/player\/redeem/);

assert.match(main, /adminAccess = Boolean\(payload\?\.admin\)/);
assert.match(main, /ui\.openAdmin\.classList\.toggle\('hidden', !permanentAccount \|\| !adminAccess\)/);
assert.match(main, /lastCreatedRewardCode = ''[\s\S]*ui\.adminCodeReveal\.classList\.add\('hidden'\)/);
assert.match(main, /CONFIRM REVOKE/);
assert.doesNotMatch(main, /localStorage\.(?:setItem|getItem)\([^\n]*(?:admin|owner)/i);

assert.match(main, /freeCrateCredits: Math\.max/);
assert.match(main, /OPEN FREE CRATE/);
assert.match(main, /outcome\.freeCredit \? 'REWARD CRATE'/);
assert.match(styles, /\.redeem-form input[\s\S]*min-height: 58px/);
assert.match(styles, /\.admin-campaign-actions button[\s\S]*min-height: 44px/);
assert.match(styles, /@media \(max-width: 600px\)[\s\S]*\.admin-campaign-actions button \{ min-height: 48px/);

assert.equal(release.release, '0.44.1');
assert.equal(release.build, 108);
assert.match(serviceWorker, /crown-lizard-shell-v108-bootstrap-hotfix/);

console.log('Crown Control admin and reward-code UX security tests passed');
