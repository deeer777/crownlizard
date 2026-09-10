import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

assert.match(html, /EARN SHARDS[\s\S]*SURVIVE 30 SEC[\s\S]*SPEND IN VAULT/, 'the first-run guide explains the complete shard loop');
assert.match(css, /\.tutorial-steps \{ display: grid; grid-template-columns: repeat\(4,1fr\)/, 'desktop tutorial presents four equally weighted first-run concepts');
assert.match(css, /\.tutorial-steps \{ grid-template-columns: repeat\(2,1fr\); gap: 12px 8px; \}/, 'mobile tutorial uses a readable two-by-two layout');
assert.match(html, /id="resultVault"[^>]*data-result-choice="vault"/, 'qualified results expose a direct Crown Vault action');
assert.match(main, /!PLATFORM\.capabilities\.vault \|\| !result\?\.reward\?\.qualified/, 'short or unsupported runs never promote the Vault as a completed reward step');
assert.match(main, /const crateCost = crownCrateCost\(walletState\(\)\.vault\.opens\);[\s\S]*CROWN VAULT · ◆ \$\{balance\.toLocaleString\('en-US'\)\} \/ \$\{crateCost\}/, 'the result action shows live progress toward the current crate price');
assert.match(main, /vaultReturn = !ui\.gameover\.classList\.contains\('hidden'\) \? 'gameover' : 'menu'/, 'opening the Vault records the player journey origin');
assert.match(main, /if \(vaultReturn === 'gameover'\)[\s\S]*selectResultChoice/, 'leaving the Vault returns to the completed-run actions');

console.log('First-session tutorial, reward goal and Vault return path passed');
