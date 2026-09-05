import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist');
const publicPaths = [
  'about', 'assets', 'audio', 'contact', 'how-to-play', 'privacy', 'src', 'terms', 'updates',
  '_headers', '_routes.json', 'ads.txt', 'index.html', 'manifest.webmanifest', 'release.json',
  'robots.txt', 'sitemap.xml', 'site.css', 'styles.css', 'sw.js',
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const path of publicPaths) await cp(resolve(root, path), resolve(output, path), { recursive: true });
const release = JSON.parse(await readFile(resolve(root, 'release.json'), 'utf8'));
await writeFile(resolve(output, 'build-meta.json'), JSON.stringify({ build: release.build, release: release.release, generatedAt: new Date().toISOString() }, null, 2));
console.log(`Built allowlisted public site for Build ${release.build} in dist/.`);
