import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const build = readFileSync(new URL('../tools/build-site.mjs', import.meta.url), 'utf8');
const optimizer = readFileSync(new URL('../tools/optimize-build-assets.mjs', import.meta.url), 'utf8');

assert.match(build, /optimizeBuildAssets\(output, profile\.label\)/, 'both platform builds pass through one shared asset optimizer');
assert.match(build, /\n}\n\nconst \{ optimizeBuildAssets \}/, 'asset optimization runs after the platform-specific branch');
assert.match(optimizer, /relativePath\.startsWith\('runtime\/'\)/, 'hand-tuned runtime sprites remain byte-identical');
assert.match(optimizer, /environment: 768/, 'large scenery retains enough source pixels for the 2x DPR canvas');
assert.match(optimizer, /perks: 256/, 'small perk emblems no longer ship at source-master resolution');
assert.match(optimizer, /cosmetic-effects-sheet-v1\.png': 768/, 'the multi-cell cosmetic sheet retains per-tile DPR detail');
assert.doesNotMatch(optimizer, /rm\([^)]*assetsRoot[^)]*recursive/, 'the optimizer never deletes the source asset tree');

console.log('Shared non-destructive asset optimization contract passed');
