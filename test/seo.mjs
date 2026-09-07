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
  ['contact/index.html', 'https://crownlizard.com/contact/'],
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
assert.match(root, /<h1\b[^>]*>[\s\S]*FREE BROWSER ARCADE SHOOTER[\s\S]*<\/h1>/, 'the visible title targets the primary discovery phrase without replacing the arcade logo');
assert.match(root, /href="\/about\/">ABOUT THE GAME<\/a>/, 'the title screen links directly to the game overview');
assert.match(root, /href="\/updates\/">LATEST BUILDS<\/a>/, 'the title screen links directly to current releases');
const jsonLd = root.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
const structured = JSON.parse(jsonLd);
assert.deepEqual(structured['@type'], ['VideoGame', 'WebApplication'], 'the game is co-typed for Google software-app eligibility');
assert.equal(structured.offers.price, '0', 'structured data accurately describes the free game');
assert.match(root, /href="\/how-to-play\/"[\s\S]*GAME GUIDE &amp; INFO/, 'the game exposes one focused crawlable information route');
assert.match(root, /href="\/privacy\/"[\s\S]*PRIVACY &amp; COOKIES/, 'the game exposes its privacy policy directly');
assert.match(root, /href="\/contact\/"[\s\S]*CONTACT &amp; SUPPORT/, 'the game exposes its support route directly');
assert.match(read('robots.txt'), /Disallow: \/api\/[\s\S]*Sitemap: https:\/\/crownlizard\.com\/sitemap\.xml/, 'robots keeps APIs out and advertises the sitemap');
const notFound = read('404.html');
assert.match(notFound, /<meta name="robots" content="noindex,follow"/, 'the custom not-found page cannot enter the search index');
assert.match(notFound, /SIGNAL NOT FOUND/, 'the custom not-found page preserves the Crown Lizard arcade voice');
assert.match(read('privacy/index.html'), /does not currently display production advertisements/, 'privacy copy does not claim the planned ad system is already active');
assert.match(read('terms/index.html'), /Market purchases are final[\s\S]*cannot be sold, withdrawn or converted to money/, 'terms document the cosmetic-only shard market without implying cash value');

console.log('SEO metadata, public content and publisher-readiness tests passed');
