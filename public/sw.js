const CACHE_NAME = 'bibish-runtime-v33';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg'];

async function cacheApplicationShell() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(APP_SHELL);
  const response = await fetch('/', { cache: 'reload' });
  if (!response.ok) return;
  await cache.put('/index.html', response.clone());
  const html = await response.text();
  const assetUrls = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => new URL(match[1], self.location.origin))
    .filter((url) => url.origin === self.location.origin)
    .map((url) => url.pathname);
  await Promise.allSettled([...new Set(assetUrls)].map(async (url) => {
    const assetResponse = await fetch(url, { cache: 'reload' });
    if (assetResponse.ok) await cache.put(url, assetResponse);
  }));
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheApplicationShell());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((cached) => {
        const refresh = fetch(event.request).then((response) => {
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', response.clone()));
          return response;
        }).catch(() => cached);
        return cached || refresh;
      }),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    }),
  );
});
