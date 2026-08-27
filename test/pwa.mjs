import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installContext, normalizeReleaseInfo } from '../src/pwa.js';

const manifest = JSON.parse(readFileSync(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
const serviceWorker = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const headers = readFileSync(new URL('../_headers', import.meta.url), 'utf8');
const release = JSON.parse(readFileSync(new URL('../release.json', import.meta.url), 'utf8'));

assert.equal(manifest.id, '/', 'the installed identity remains stable across start URL changes');
assert.equal(manifest.display, 'standalone', 'the game launches without browser chrome');
assert.equal(manifest.start_url, '/?source=pwa', 'installed launches have a same-origin entry point');
assert.ok(manifest.icons.some(icon => icon.sizes === '192x192'), 'Chromium receives a 192px app icon');
assert.ok(manifest.icons.some(icon => icon.sizes === '512x512' && icon.purpose === 'maskable'), 'adaptive launchers receive a safe maskable icon');

const pngSize = path => {
  const data = readFileSync(new URL(path, import.meta.url));
  return [data.readUInt32BE(16), data.readUInt32BE(20)];
};
assert.deepEqual(pngSize('../assets/icons/icon-192.png'), [192, 192], 'the small manifest icon has exact dimensions');
assert.deepEqual(pngSize('../assets/icons/icon-512.png'), [512, 512], 'the large manifest icon has exact dimensions');
assert.deepEqual(pngSize('../assets/icons/apple-touch-icon.png'), [180, 180], 'the Apple touch icon has exact dimensions');

assert.match(index, /rel="manifest" href="\.\/manifest\.webmanifest"/, 'the document exposes its install manifest');
assert.match(index, /id="installApp" class="hidden"/, 'installation is discoverable in Settings without cluttering the title menu');
assert.match(main, /pwaPreviewMode && debugParams\.has\('update'\)/, 'update-dialog simulation remains an explicit localhost-only tool');
assert.match(main, /serverEconomy && navigator\.onLine === false/, 'production cannot start a ranked run while offline');
assert.match(serviceWorker, /request\.method !== 'GET'\) return/, 'mutating requests are never intercepted');
assert.match(serviceWorker, /url\.pathname\.startsWith\('\/api\/'\)\) return/, 'authenticated APIs are always network-only');
assert.match(serviceWorker, /request\.headers\.has\('range'\)/, 'media range requests bypass the cache worker');
assert.match(serviceWorker, /request\.mode === 'navigate'/, 'navigation uses its dedicated network-first strategy');
assert.match(serviceWorker, /SKIP_WAITING/, 'updates only activate after explicit player confirmation');
assert.match(headers, /\/sw\.js\s+Cache-Control: no-cache, no-store, must-revalidate/, 'Cloudflare never pins an obsolete service worker');
assert.match(headers, /\/release\.json\s+Cache-Control: no-cache, no-store, must-revalidate/, 'release notes always describe the waiting build');
assert.match(headers, /\/\s+Cache-Control: no-cache, must-revalidate\s*$/, 'the installed root entry point always revalidates before loading a build');
assert.match(serviceWorker, /'\/release\.json'/, 'the current release notes remain available offline');
assert.equal(release.notes.length, 3, 'the mobile update screen stays focused on three release notes');
assert.deepEqual(normalizeReleaseInfo({ release: '1.2.3', build: 80, title: ' UPDATE ', notes: [' ONE ', '', 'TWO'] }), { release: '1.2.3', build: 80, title: 'UPDATE', notes: ['ONE', 'TWO'] }, 'release metadata is normalized before rendering');
assert.equal(normalizeReleaseInfo(null).notes.length, 1, 'invalid release metadata receives a safe fallback');

assert.deepEqual(installContext({ userAgent: 'iPhone', standalone: false }), { installed: false, nativePrompt: false, instructions: true }, 'iPhone receives manual Add to Home Screen help');
assert.deepEqual(installContext({ standalone: true, hasPrompt: true }), { installed: true, nativePrompt: false, instructions: false }, 'installed apps never advertise installation again');
assert.equal(installContext({ hasPrompt: true }).nativePrompt, true, 'supporting browsers expose their native install prompt');

console.log('PWA manifest, install and cache boundary tests passed');
