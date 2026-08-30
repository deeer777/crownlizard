const CACHE_VERSION = 'crown-lizard-shell-v94-market-filters';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/release.json',
  '/styles.css?v=20260829-94-market-filters',
  '/site.css?v=20260828-90-seo',
  '/about/',
  '/how-to-play/',
  '/updates/',
  '/privacy/',
  '/terms/',
  '/robots.txt',
  '/sitemap.xml',
  '/src/main.js?v=20260829-94-market-filters',
  '/src/config.js?v=20260829-94-market-mvp',
  '/src/engine.js?v=20260820-18',
  '/src/input.js?v=20260827-82-input-release',
  '/src/audio.js?v=20260828-91-weapon-skins4',
  '/src/game.js?v=20260828-91-weapon-skins4',
  '/src/boss-assault.js?v=20260828-91-weapon-skins4',
  '/src/boss-network.js?v=20260828-91-weapon-skins4',
  '/src/economy.js?v=20260829-94-market-mvp',
  '/src/cosmetics.js?v=20260828-91-weapon-skins4',
  '/src/leaderboard.js?v=20260824-45-cutover',
  '/src/player-account.js?v=20260829-94-market-mvp',
  '/src/armory.js?v=20260828-91-weapon-skins4',
  '/src/cosmetic-preferences.js?v=20260828-91-weapon-skins4',
  '/src/account-presentation.js?v=20260826-73-cinematic-endings',
  '/src/rewarded-ad.js?v=20260824-45',
  '/src/pwa.js?v=20260827-79-crown-store-final6',
  '/assets/fonts/PressStart2P-Regular.ttf',
  '/assets/fonts/Silkscreen-Regular.ttf',
  '/assets/fonts/Silkscreen-Bold.ttf',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/apple-touch-icon.png',
  '/assets/runtime/sprites/crown-lizard-player-v1.png',
  '/assets/weapons/blaster-mount-v1.png',
  '/assets/weapons/spread-mount-v1.png',
  '/assets/weapons/pulse-mount-v1.png',
  '/assets/weapons/laser-mount-v1.png',
  '/assets/weapons/tesla-mount-v1.png',
  '/assets/weapons/laser-royal-prism-v2.png',
  '/assets/weapons/laser-void-lance-v2.png',
  '/assets/weapons/tesla-storm-crown-v2.png',
  '/assets/weapons/tesla-verdant-chain-v2.png',
  '/assets/weapons/pulse-solar-core-v2.png',
  '/assets/weapons/pulse-sovereign-eclipse-v2.png',
  '/assets/weapons/projectile-laser-v1.png',
  '/assets/weapons/projectile-tesla-v1.png',
  '/assets/weapons/projectile-pulse-v1.png',
  '/assets/sprites/ship-gilded-viper-v1.png',
  '/assets/sprites/ship-neon-basilisk-v1.png',
  '/assets/sprites/global-warden-v1.png?v=82-opt',
  '/assets/sprites/crown-relay-v1.png?v=82-opt',
  '/assets/sprites/shield-pylon-v1.png?v=82-opt'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key)))),
    self.clients.claim(),
  ]));
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

const cacheStatic = async request => {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') cache.put(request, response.clone());
  return response;
};

const networkNavigation = async request => {
  try {
    return await fetch(request);
  } catch {
    return (await caches.match(request, { ignoreSearch: true })) || (await caches.match('/index.html')) || Response.error();
  }
};

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (request.headers.has('range') || /\.(?:mp3|mp4|webm|ogg)$/i.test(url.pathname)) return;
  if (request.mode === 'navigate') {
    event.respondWith(networkNavigation(request));
    return;
  }
  if (/\.(?:js|css|png|ttf|webmanifest)$/i.test(url.pathname)) event.respondWith(cacheStatic(request));
});
