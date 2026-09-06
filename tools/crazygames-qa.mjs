import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bundleRoot = resolve(root, 'dist-crazygames');
const limits = Object.freeze({ totalBytes: 250 * 1024 * 1024, initialBytes: 50 * 1024 * 1024, mobileInitialBytes: 20 * 1024 * 1024, files: 1500 });
const failures = [];
const warnings = [];
const checks = [];
const pass = (name, detail) => checks.push({ name, status: 'pass', detail });
const fail = (name, detail) => { checks.push({ name, status: 'fail', detail }); failures.push(`${name}: ${detail}`); };

const walk = async directory => {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walk(path));
    else result.push(path);
  }
  return result.sort((a, b) => a.localeCompare(b));
};

let files;
try { files = await walk(bundleRoot); }
catch { throw new Error('dist-crazygames is missing. Run npm run build:crazygames first.'); }

const relativeFiles = files.map(path => relative(bundleRoot, path).split(sep).join('/'));
const sizes = await Promise.all(files.map(path => stat(path).then(info => info.size)));
const totalBytes = sizes.reduce((sum, size) => sum + size, 0);
const index = await readFile(resolve(bundleRoot, 'index.html'), 'utf8');
const textFiles = files.filter(path => ['.html', '.css', '.js', '.json', '.webmanifest', '.txt'].includes(extname(path).toLowerCase()));
const searchable = (await Promise.all(textFiles.map(async path => `\n/* ${relative(bundleRoot, path)} */\n${await readFile(path, 'utf8')}`))).join('');

relativeFiles.includes('index.html') ? pass('Root entry point', 'index.html is at the package root') : fail('Root entry point', 'index.html is missing from the package root');
relativeFiles.length <= limits.files ? pass('File count', `${relativeFiles.length} / ${limits.files}`) : fail('File count', `${relativeFiles.length} exceeds ${limits.files}`);
totalBytes <= limits.totalBytes ? pass('Total size', `${(totalBytes / 1048576).toFixed(2)} MiB / 250 MiB`) : fail('Total size', `${(totalBytes / 1048576).toFixed(2)} MiB exceeds 250 MiB`);

const forbiddenFiles = ['ads.txt', 'manifest.webmanifest', 'sw.js', '_headers', '_routes.json', 'sitemap.xml', 'robots.txt'];
const leakedFiles = forbiddenFiles.filter(path => relativeFiles.includes(path));
leakedFiles.length === 0 ? pass('Portal-only package', 'No Crown hosting, PWA or AdSense files') : fail('Portal-only package', `Unexpected files: ${leakedFiles.join(', ')}`);

index.includes('https://sdk.crazygames.com/crazygames-sdk-v3.js') ? pass('CrazyGames SDK', 'Official HTML5 v3 SDK is present') : fail('CrazyGames SDK', 'Official HTML5 v3 SDK script is missing');
index.includes('src="./src/bootstrap.js') ? pass('Relative entry assets', 'Game entry module uses a relative path') : fail('Relative entry assets', 'Game entry module is not relative');

const forbiddenTokens = [
  ['AdSense account', /google-adsense-account|adsbygoogle/i],
  ['Crown production origin', /https?:\/\/(?:www\.)?crownlizard\.com/i],
  ['Service worker registration', /navigator\.serviceWorker\.register\(/i],
];
for (const [name, pattern] of forbiddenTokens) {
  const found = pattern.test(searchable);
  if (name === 'Service worker registration') {
    const workerIncluded = relativeFiles.includes('sw.js');
    !workerIncluded ? pass(name, 'No service worker payload is included and the PWA capability is disabled') : fail(name, 'A service worker payload leaked into the portal package');
  } else found ? fail(name, 'Crown-only integration leaked into the portal package') : pass(name, 'Not present');
}

const platformConfig = await readFile(resolve(bundleRoot, 'src/platform-config.js'), 'utf8');
if (/"id": "crazygames"/.test(platformConfig) && /"crownServices": false/.test(platformConfig) && /"rewardedAds": false/.test(platformConfig)) {
  pass('Capability isolation', 'Crown services and rewarded ads are disabled');
} else fail('Capability isolation', 'Generated platform capabilities are unsafe for Basic Launch');

const remoteUrls = [...new Set(searchable.match(/https?:\/\/[^\s"'<>)}]+/g) || [])];
const allowedRemote = remoteUrls.filter(url => url.startsWith('https://sdk.crazygames.com/'));
const unexpectedRemote = remoteUrls.filter(url => !url.startsWith('https://sdk.crazygames.com/') && !url.startsWith('http://scripts.sil.org/'));
unexpectedRemote.length === 0 ? pass('Remote dependencies', `Only ${allowedRemote.length ? 'the official CrazyGames SDK' : 'approved static references'} found`) : fail('Remote dependencies', `Unexpected URLs: ${unexpectedRemote.join(', ')}`);

const startupCandidates = [
  'index.html', 'styles.css', 'build-meta.json',
  ...relativeFiles.filter(path => path.startsWith('src/')),
  ...relativeFiles.filter(path => path.startsWith('assets/fonts/')),
  'audio/menu-theme.mp3',
  'assets/runtime/sprites/crown-lizard-player-v1.png',
  'assets/runtime/sprites/ripper-v1.png',
  'assets/runtime/sprites/hex-moth-v1.png',
  'assets/runtime/sprites/iron-scarab-v1.png',
  'assets/runtime/sprites/weapon-crate-closed-v1.png',
  'assets/runtime/sprites/weapon-crate-open-v1.png',
].filter((value, index, all) => all.indexOf(value) === index);
const initialBytes = startupCandidates.reduce((sum, path) => {
  const index = relativeFiles.indexOf(path);
  return sum + (index >= 0 ? sizes[index] : 0);
}, 0);
initialBytes <= limits.mobileInitialBytes
  ? pass('Conservative initial-load estimate', `${(initialBytes / 1048576).toFixed(2)} MiB / 20 MiB mobile target`)
  : initialBytes <= limits.initialBytes
    ? (pass('Desktop initial-load estimate', `${(initialBytes / 1048576).toFixed(2)} MiB / 50 MiB`), warnings.push(`Estimated initial load is ${(initialBytes / 1048576).toFixed(2)} MiB, above the 20 MiB mobile-homepage target.`))
    : fail('Initial-load estimate', `${(initialBytes / 1048576).toFixed(2)} MiB exceeds 50 MiB`);

const report = {
  schemaVersion: 1,
  platform: 'crazygames',
  build: JSON.parse(await readFile(resolve(root, 'release.json'), 'utf8')).build,
  limits,
  bundle: { files: relativeFiles.length, totalBytes, estimatedInitialBytes: initialBytes },
  checks,
  warnings,
};
const artifacts = resolve(root, 'artifacts');
await mkdir(artifacts, { recursive: true });
await writeFile(resolve(artifacts, `crazygames-qa-build-${report.build}.json`), `${JSON.stringify(report, null, 2)}\n`);

for (const check of checks) console.log(`${check.status === 'pass' ? 'PASS' : 'FAIL'}  ${check.name}: ${check.detail}`);
for (const warning of warnings) console.warn(`WARN  ${warning}`);
if (failures.length) {
  console.error(`\nCrazyGames QA failed with ${failures.length} blocking issue(s).`);
  process.exitCode = 1;
} else console.log(`\nCrazyGames QA passed (${relativeFiles.length} files, ${(totalBytes / 1048576).toFixed(2)} MiB).`);
