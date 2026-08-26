const CACHE_VERSION = 'crown-lizard-shell-v76-balance-pass1-final';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/styles.css?v=20260826-76-balance-pass1-final',
  '/src/main.js?v=20260826-76-balance-pass1-final',
  '/src/config.js?v=20260826-76-balance-pass1-final',
  '/src/engine.js?v=20260820-18',
  '/src/input.js?v=20260820-26',
  '/src/audio.js?v=20260826-76-balance-pass1-final',
  '/src/game.js?v=20260826-76-balance-pass1-final',
  '/src/economy.js?v=20260824-45-security',
  '/src/cosmetics.js?v=20260824-45-security',
  '/src/leaderboard.js?v=20260824-45-cutover',
  '/src/player-account.js?v=20260826-73-cinematic-endings',
  '/src/account-presentation.js?v=20260826-73-cinematic-endings',
  '/src/rewarded-ad.js?v=20260824-45',
  '/src/pwa.js?v=20260826-76-balance-pass1-final',
  '/assets/fonts/PressStart2P-Regular.ttf',
  '/assets/fonts/Silkscreen-Regular.ttf',
  '/assets/fonts/Silkscreen-Bold.ttf',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/apple-touch-icon.png',
  '/assets/runtime/sprites/crown-lizard-player-v1.png'
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
    return (await caches.match('/index.html')) || Response.error();
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
