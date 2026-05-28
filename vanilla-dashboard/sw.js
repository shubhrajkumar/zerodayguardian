const CACHE = 'dash-v1';
const assets = [
  '/',
  '/index.html',
  '/js/app.js',
  '/js/router.js',
  '/js/pages/home.js',
  '/js/pages/about.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(assets))
  );
});
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
