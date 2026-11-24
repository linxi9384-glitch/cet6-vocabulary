const cacheName = 'cet6-study-v5';
const assets = [
  './', './index.html', './style.css', './app.mjs', './study.mjs', './bank.json',
  './manifest.webmanifest', './app-192.png', './app-512.png', './book-cover.png',
  './font/lucide.css', './font/lucide.woff2?t=1733401308309',
];
const shell = new URL('./index.html', self.registration.scope).href;
const assetUrls = new Set(assets.map(asset => new URL(asset, self.registration.scope).href));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(assets)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith('cet6-study-') && key !== cacheName).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith(self.registration.scope)) return;
  if (request.mode === 'navigate') {
    event.respondWith(caches.open(cacheName).then(cache => cache.match(shell)).then(response => response ?? fetch(request)));
  } else if (assetUrls.has(request.url)) {
    event.respondWith(caches.open(cacheName).then(cache => cache.match(request)).then(response => response ?? fetch(request)));
  }
});
