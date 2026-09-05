import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const exists = path => {
  try { statSync(resolve(root, path)); return true; } catch { return false; }
};
const measure = directory => readdirSync(directory, { withFileTypes: true }).reduce((total, entry) => {
  const path = resolve(directory, entry.name);
  if (entry.isDirectory()) {
    const nested = measure(path);
    return { files: total.files + nested.files, bytes: total.bytes + nested.bytes };
  }
  return { files: total.files + 1, bytes: total.bytes + statSync(path).size };
}, { files: 0, bytes: 0 });

execFileSync(process.execPath, ['tools/build-site.mjs', '--platform=crownlizard'], { cwd: root, stdio: 'pipe' });
execFileSync(process.execPath, ['tools/build-site.mjs', '--platform=crazygames'], { cwd: root, stdio: 'pipe' });

const crownIndex = read('dist/index.html');
const crazyIndex = read('dist-crazygames/index.html');
const crownPlatform = read('dist/src/platform-config.js');
const crazyPlatform = read('dist-crazygames/src/platform-config.js');
const main = read('src/main.js');
const deployGuard = read('tools/assert-crown-deploy.mjs');

assert.match(crownPlatform, /"id": "crownlizard"/);
assert.match(crazyPlatform, /"id": "crazygames"/);
assert.match(crownIndex, /google-adsense-account/);
assert.match(crownIndex, /manifest\.webmanifest/);
assert.doesNotMatch(crazyIndex, /google-adsense-account|manifest\.webmanifest|apple-touch-icon/);
assert.doesNotMatch(crownIndex, /crazygames-sdk-v3/);
assert.match(crazyIndex, /https:\/\/sdk\.crazygames\.com\/crazygames-sdk-v3\.js/);
assert.equal(exists('dist/ads.txt'), true);
assert.equal(exists('dist/sw.js'), true);
assert.equal(exists('dist-crazygames/ads.txt'), false);
assert.equal(exists('dist-crazygames/sw.js'), false);
assert.equal(exists('dist-crazygames/_headers'), false);
assert.match(main, /PLATFORM\.capabilities\.crownServices && !localPreview/);
assert.match(main, /PLATFORM\.capabilities\.pwa \? new PwaManager/);
assert.match(main, /platformRuntime\.gameplayStart\(\)/);
assert.match(main, /platformRuntime\.gameplayStop\(\)/);
assert.match(main, /PLATFORM\.capabilities\.crownServices \? \(async \(\) =>/);
assert.match(main, /if \(!PLATFORM\.capabilities\.crownServices\) \{\s*if \(difficulty === selectedDifficulty\)/);
assert.match(deployGuard, /codex\\\/crazygames/);

const crazyBundle = measure(resolve(root, 'dist-crazygames'));
assert.ok(crazyBundle.files <= 1_500, `CrazyGames bundle has ${crazyBundle.files} files`);
assert.ok(crazyBundle.bytes <= 250 * 1_048_576, `CrazyGames bundle is ${(crazyBundle.bytes / 1_048_576).toFixed(2)} MiB`);

console.log('Platform build isolation passed:', {
  crownOutput: 'dist',
  crazyGamesOutput: 'dist-crazygames',
  crazyGamesFiles: crazyBundle.files,
  crazyGamesMiB: Number((crazyBundle.bytes / 1_048_576).toFixed(2)),
});
