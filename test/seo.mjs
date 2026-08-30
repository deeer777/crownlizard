import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const pages = [
  ['index.html', 'https://crownlizard.com/'],
  ['about/index.html', 'https://crownlizard.com/about/'],
  ['how-to-play/index.html', 'https://crownlizard.com/how-to-play/'],
  ['updates/index.html', 'https://crownlizard.com/updates/'],
  ['privacy/index.html', 'https://crownlizard.com/privacy/'],
  ['terms/index.html', 'https://crownlizard.com/terms/'],
];
const sitemap = read('sitemap.xml');
const titles = new Set();
const descriptions = new Set();

for (const [path, canonical] of pages) {
  const html = read(path);
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
  const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1];
  assert.ok(title?.length >= 20 && title.length <= 65, `${path} has a useful search title`);
  assert.ok(description?.length >= 80 && description.length <= 170, `${path} has a useful search description`);
  assert.match(html, new RegExp(`<link rel="canonical" href="${canonical.replaceAll('/', '\\/')}"`), `${path} has the expected canonical URL`);
  assert.match(html, /<meta property="og:title"/, `${path} has an Open Graph title`);
  assert.match(html, /<meta property="og:image" content="https:\/\/crownlizard\.com\/assets\/icons\/icon-512\.png"/, `${path} has a stable absolute share image`);
  assert.match(sitemap, new RegExp(`<loc>${canonical.replaceAll('/', '\\/')}<\\/loc>`), `${path} is discoverable in the sitemap`);
  assert.ok(!titles.has(title), `${path} title is unique`);
  assert.ok(!descriptions.has(description), `${path} description is unique`);
  titles.add(title);
  descriptions.add(description);
}

const root = read('index.html');
const jsonLd = root.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
const structured = JSON.parse(jsonLd);
assert.deepEqual(structured['@type'], ['VideoGame', 'WebApplication'], 'the game is co-typed for Google software-app eligibility');
assert.equal(structured.offers.price, '0', 'structured data accurately describes the free game');
assert.match(root, /href="\/how-to-play\/"[\s\S]*GAME GUIDE &amp; INFO/, 'the game exposes one focused crawlable information route');
assert.match(read('robots.txt'), /Disallow: \/api\/[\s\S]*Sitemap: https:\/\/crownlizard\.com\/sitemap\.xml/, 'robots keeps APIs out and advertises the sitemap');
assert.match(read('privacy/index.html'), /does not currently serve production advertising/, 'privacy copy does not claim the planned ad system is already active');
assert.match(read('terms/index.html'), /Market purchases are final[\s\S]*cannot be sold, withdrawn or converted to money/, 'terms document the cosmetic-only shard market without implying cash value');

console.log('SEO metadata, public content and publisher-readiness tests passed');
