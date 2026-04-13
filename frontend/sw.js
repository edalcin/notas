const CACHE_NAME = 'notas-v10';

const APP_SHELL = [
  '/',
  '/assets/css/app.css',
  '/assets/js/app.js',
  '/assets/js/notes.js',
  '/assets/js/editor.js',
  '/assets/js/modal.js',
  '/assets/js/shared.js',
  '/assets/js/hashtags.js',
  '/assets/js/tagStore.js',
  '/assets/js/theme.js',
  '/assets/js/attachments.js',
  '/assets/js/attachments-view.js',
  '/assets/js/trash.js',
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
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
      await self.clients.claim();
      // Tell all open pages to reload so they use the fresh cached assets.
      // Without this, skipWaiting() hands control to the new SW but the
      // already-running JS in each tab is still the old version.
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) {
        client.postMessage({ type: 'SW_UPDATED' });
      }
    })()
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Web Share Target: Android shares arrive as POST /share-target
  if (url.pathname === '/share-target' && request.method === 'POST') {
    event.respondWith(handleShareTarget(request));
    return;
  }

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

async function handleShareTarget(request) {
  try {
    const formData = await request.formData();
    const title = (formData.get('title') || '').trim();
    const text  = (formData.get('text')  || '').trim();
    const url   = (formData.get('url')   || '').trim();
    const files = formData.getAll('media');

    // Build content string; avoid duplicating URL when already present in text
    const parts = [];
    if (title) parts.push(title);
    if (text)  parts.push(text);
    if (url && !text.includes(url)) parts.push(url);
    const content = parts.join('\n');

    const params = new URLSearchParams();
    if (content) params.set('share_content', content);

    if (files.length > 0) {
      // Store files in Cache so app.js can read them after redirect.
      // Cache Storage API is available in both SW and page contexts (same origin).
      const cache = await caches.open('notas-share-pending');
      const oldKeys = await cache.keys();
      await Promise.all(oldKeys.map(k => cache.delete(k)));
      for (const file of files) {
        const buf = await file.arrayBuffer();
        await cache.put(
          `/__share_file__/${encodeURIComponent(file.name)}`,
          new Response(buf, {
            headers: {
              'Content-Type': file.type || 'application/octet-stream',
              'X-File-Name': file.name,
            },
          })
        );
      }
      params.set('share_files', '1');
    }

    return Response.redirect(params.toString() ? `/?${params}` : '/', 303);
  } catch (err) {
    console.error('[SW] Share target error:', err);
    return Response.redirect('/', 303);
  }
}
