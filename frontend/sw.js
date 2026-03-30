const CACHE_NAME = 'notas-v3';

const APP_SHELL = [
  '/',
  '/assets/css/app.css',
  '/assets/js/app.js',
  '/assets/js/notes.js',
  '/assets/js/editor.js',
  '/assets/js/hashtags.js',
  '/assets/js/tagStore.js',
  '/assets/js/theme.js',
  '/assets/js/attachments.js',
  '/assets/js/attachments-view.js',
  '/manifest.json',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Non-GET requests (writes): network-only; return 503 when offline
  if (request.method !== 'GET') {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: 'Offline — operação indisponível' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    return;
  }

  // GET /api/notes* — stale-while-revalidate
  if (url.pathname.startsWith('/api/notes')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Everything else: cache-first
  event.respondWith(cacheFirst(request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  return cached || fetchPromise;
}
