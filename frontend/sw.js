const CACHE_NAME = 'notas-v10';

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
  '/assets/favicon.ico',
  '/assets/apple-touch-icon.png',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
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

  // ALL /api/* routes: always fetch fresh from origin, never cache.
  // Uses request.url (string) + { cache: 'no-store' } to reliably bypass
  // both the browser HTTP cache and the SW cache across all browsers.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request.url, { cache: 'no-store', credentials: 'same-origin' })
        .catch(() => new Response(JSON.stringify({ error: 'Offline — operação indisponível' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }))
    );
    return;
  }

  // Uploaded files: network-first so deleted files are not served from cache
  if (url.pathname.startsWith('/files/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets & app shell: cache-first
  event.respondWith(cacheFirst(request));
});

async function networkFirst(request) {
  try {
    // { cache: 'no-store' } bypasses the browser HTTP cache so the SW always
    // fetches from the origin server, not a potentially stale browser cache entry.
    const response = await fetch(request, { cache: 'no-store' });
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

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
