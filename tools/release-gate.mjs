import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFile(resolve(root, path), 'utf8');
const json = async path => JSON.parse(await read(path));
const requiredSecrets = ['SCORE_HASH_SALT', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'SUPABASE_URL'];

const [release, packageJson, wrangler, pagesRequirements, configSource, apiSource, envExample, canonical, buildMeta, builtRelease] = await Promise.all([
  json('release.json'), json('package.json'), json('wrangler.jsonc'), json('cloudflare-pages.required.json'), read('src/config.js'), read('functions/api/[[path]].js'),
  read('.env.example'), read('supabase/canonical-schema.sql'), json('dist/build-meta.json'), json('dist/release.json'),
]);

assert.equal(packageJson.version, release.release, 'package version must match release.json');
assert.match(configSource, new RegExp(`release:\\s*['\"]${release.release.replaceAll('.', '\\.')}['\"]`), 'client release must match release.json');
assert.match(configSource, new RegExp(`build:\\s*${release.build}\\b`), 'client build must match release.json');
assert.deepEqual({ release: buildMeta.release, build: buildMeta.build }, { release: release.release, build: release.build }, 'built metadata must match release.json');
assert.deepEqual(builtRelease, release, 'the public release manifest must match the source manifest');
assert.match(apiSource, new RegExp(`SUPPORTED_GAME_VERSIONS\\.add\\(['\"]${release.release}-${release.build}['\"]\\)`), 'server must accept the current build');

assert.equal(wrangler.pages_build_output_dir, './dist', 'Cloudflare Pages must publish only dist/');
assert.equal(pagesRequirements.project, wrangler.name, 'Pages requirement manifest must target the configured project');
assert.deepEqual([...(pagesRequirements.secrets || [])].sort(), requiredSecrets, 'Pages requirement manifest must declare every required production secret');
for (const name of requiredSecrets) assert.match(envExample, new RegExp(`^${name}=`, 'm'), `${name} must be documented in .env.example`);

assert.match(canonical, /-- SOURCE: supabase\/stability-build99\.sql/, 'canonical schema must include the stabilization migration');
assert.match(canonical, /declare r public\.leaderboard_runs%rowtype; existing_id uuid; score_id uuid;/, 'score IDs must remain UUID throughout the atomic score RPC');
assert.match(canonical, /create or replace function public\.expire_stale_verified_runs/, 'canonical schema must control expired run buildup');
assert.match(canonical, /create or replace function public\.prune_stale_run_checkpoints/, 'canonical schema must bound abandoned checkpoint buildup');

const publicRoot = resolve(root, 'dist');
const walk = async directory => (await Promise.all((await readdir(directory, { withFileTypes: true })).map(async entry => {
  const path = resolve(directory, entry.name);
  return entry.isDirectory() ? walk(path) : [relative(publicRoot, path).replaceAll('\\', '/')];
}))).flat();
const publicFiles = await walk(publicRoot);
const forbidden = publicFiles.filter(path => /(^|\/)(supabase|test|tools|node_modules)(\/|$)|(^|\/)\.env|\.sql$|package(?:-lock)?\.json$/i.test(path));
assert.deepEqual(forbidden, [], `internal files leaked into dist: ${forbidden.join(', ')}`);
assert.ok(publicFiles.includes('index.html') && publicFiles.includes('sw.js') && publicFiles.includes('build-meta.json'), 'dist must contain the complete public shell');

console.log(`Release gate passed for Crown Lizard ${release.release} Build ${release.build} (${publicFiles.length} public files).`);
