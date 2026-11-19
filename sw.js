/* Nivora service worker. __BUILD__ is replaced with a content hash by scripts/build.mjs,
   so every deploy gets a fresh cache and old ones are deleted. */
const CACHE = 'nivora-__BUILD__';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'css/tailwind.css', 'css/styles.css',
  'js/01-core.js', 'js/02-onboarding.js', 'js/03-views.js', 'js/04-insights-actions.js',
  'js/05-medicines-map-render.js', 'js/06-extensions.js', 'js/07-smart-add-scan.js', 'js/08-native-alarms.js', 'js/09-backup.js', 'js/10-account.js', 'js/99-boot.js',
  'assets/icon-32.png', 'assets/icon-64.png', 'assets/icon-180.png',
  'assets/icon-192.png', 'assets/icon-512.png',
  'assets/logo-emblem.webp', 'assets/logo-full.webp',
];
// Third-party hosts worth caching for offline use (fonts, Leaflet, Tesseract). Map tiles are NOT cached.
const CDN = ['fonts.googleapis.com', 'fonts.gstatic.com', 'unpkg.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('nivora-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // cache-first for the app shell, refresh in the background
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => {
      const net = fetch(req).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
        return res;
      }).catch(() => hit || caches.match('index.html'));
      return hit || net;
    }));
  } else if (CDN.includes(url.hostname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      caches.open(CACHE).then(c => c.put(req, res.clone()));
      return res;
    })));
  }
});
