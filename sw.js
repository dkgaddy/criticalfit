const CACHE = 'criticalfit-v1';

const PRECACHE = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './manifest.json',
  './images/criticalfitLogo.png',
  './images/Dragon_Lvl0.png',
  './images/Dragon_Lvl1.png',
  './images/Dragon_Lvl2.png',
  './images/Dragon_Lvl3.png',
  './images/Dragon_Lvl4.png',
  './images/Dragon_Lvl5.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Network-first for API calls, cache-first for everything else
  if (e.request.url.includes('/api/')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
  } else {
    e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request)));
  }
});
