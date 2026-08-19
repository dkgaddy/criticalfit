const CACHE = 'criticalfit-v2';

// Only static assets that rarely change are precached. Code (HTML/CSS/JS) is
// fetched network-first below so updates are always picked up — precaching code
// with a cache-first strategy previously caused stale app.js/index.html to be
// served in the installed PWA while other scripts loaded fresh.
const PRECACHE = [
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

// Cache-and-update: serve from cache immediately, refresh the cache in the
// background so the next load is current. Used for images/fonts.
function staleWhileRevalidate(request) {
  return caches.open(CACHE).then(cache =>
    cache.match(request).then(cached => {
      const network = fetch(request)
        .then(res => {
          if (res && res.ok) cache.put(request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
}

// Network-first: always try the network so updated code is picked up; fall back
// to the cached copy when offline. Successful responses are cached for offline.
function networkFirst(request) {
  return caches.open(CACHE).then(cache =>
    fetch(request)
      .then(res => {
        if (res && res.ok) cache.put(request, res.clone());
        return res;
      })
      .catch(() => cache.match(request))
  );
}

self.addEventListener('fetch', e => {
  const req = e.request;

  // Only handle GET; let the browser deal with POST/PUT/etc.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // API calls: always network-first (fall back to cache offline).
  if (url.pathname.includes('/api/')) {
    e.respondWith(networkFirst(req));
    return;
  }

  // Page navigations and code (HTML/CSS/JS): network-first so a new deploy is
  // always used, with cache as an offline fallback.
  if (
    req.mode === 'navigate' ||
    /\.(?:html|css|js)$/.test(url.pathname)
  ) {
    e.respondWith(networkFirst(req));
    return;
  }

  // Everything else (images, fonts, icons): stale-while-revalidate.
  e.respondWith(staleWhileRevalidate(req));
});
