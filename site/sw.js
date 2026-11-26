const cacheName = 'cet6-study-v11';
const additions = ['2024-06', '2024-12', '2025-06', '2025-12'];
const assets = [
  './', './index.html', './style.css', './app.mjs', './study.mjs', './reading.mjs', './bank.json',
  './exams.mjs', './exam-view.mjs', './exam-pdf.mjs', './vendor/pdfjs/pdf.min.mjs', './vendor/pdfjs/pdf.worker.min.mjs',
  './exam-practice.mjs', './exam-topics.mjs', './exam-explanation.mjs', './exam-additions.mjs',
  ...additions.flatMap(date => [1, 2, 3].map(set => `./exam-data/${date}-${set}.json`)),
  './exam-data/2023-06-1.json', './exam-data/2023-06-2.json', './exam-data/2022-12-1.json',
  './exam-data/2022-12-2.json', './exam-data/2022-09-1.json', './exam-data/2022-06-1.json',
  './manifest.webmanifest', './app-192.png', './app-512.png', './book-cover.png',
  './font/lucide.css', './font/lucide.woff2?t=1733401308309',
];
const shell = new URL('./index.html', self.registration.scope).href;
const assetUrls = new Set(assets.map(asset => new URL(asset, self.registration.scope).href));

async function fetchReading(request) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request, { cache: 'no-cache' });
    if (response.ok) await cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch {
    return (await cache.match(request)) ?? Response.error();
  }
}

async function fetchExplanation(request) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone()).catch(() => {});
  return response;
}

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
  } else if (/^readings\/(?:index|\d{4}-\d{2}-\d{2})\.json$/.test(request.url.slice(self.registration.scope.length))) {
    event.respondWith(fetchReading(request));
  } else if (/^exam-explanations\/\d{4}-\d{2}\/\d+\.webp$/.test(request.url.slice(self.registration.scope.length))) {
    event.respondWith(fetchExplanation(request));
  }
});
