// Service Worker - kiosplay
// Keeps the kiosk app shell, public playlist API, and media available after
// Chromium restarts without internet.

const APP_SHELL_CACHE = 'kiosplay-shell-v2';
const MEDIA_CACHE = 'kiosplay-media-v2';
const API_CACHE = 'kiosplay-api-v2';
const APP_SHELL_URLS = ['/', '/index.html'];
const EXPECTED_CACHES = [APP_SHELL_CACHE, MEDIA_CACHE, API_CACHE];

self.addEventListener('install', event => {
  event.waitUntil(
    cacheAppShell()
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => !EXPECTED_CACHES.includes(key))
          .map(key => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type !== 'PRECACHE_MEDIA' || !Array.isArray(data.urls)) return;

  event.waitUntil(precacheMedia(data.urls));
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(navigationFallback(event.request));
    return;
  }

  if (url.pathname.startsWith('/uploads/')) {
    event.respondWith(handleMedia(event.request));
    return;
  }

  if (url.pathname.startsWith('/api/public/')) {
    event.respondWith(networkFirst(event.request, API_CACHE));
    return;
  }

  if (url.pathname.startsWith('/assets/') || url.pathname === '/index.html' || url.pathname === '/') {
    event.respondWith(cacheFirst(event.request, APP_SHELL_CACHE));
  }
});

async function cacheAppShell() {
  const cache = await caches.open(APP_SHELL_CACHE);
  await cache.addAll(APP_SHELL_URLS);

  const indexResponse = await cache.match('/index.html') || await cache.match('/');
  if (!indexResponse) return;

  const html = await indexResponse.clone().text();
  const assetUrls = [];
  const assetPattern = /(?:src|href)="([^"]*\/assets\/[^"]+)"/g;
  let match;

  while ((match = assetPattern.exec(html))) {
    assetUrls.push(new URL(match[1], self.location.origin).pathname);
  }

  if (assetUrls.length > 0) {
    await cache.addAll(assetUrls);
  }
}

async function navigationFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(APP_SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cache = await caches.open(APP_SHELL_CACHE);
    return await cache.match('/index.html')
      || await cache.match('/')
      || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

async function handleMedia(request) {
  const cache = await caches.open(MEDIA_CACHE);
  const cacheKey = new Request(request.url);

  try {
    const response = await fetch(request);
    if (response.ok && response.status === 200) {
      cache.put(cacheKey, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(cacheKey);
    if (!cached) {
      return new Response(null, { status: 503, statusText: 'Offline media not cached' });
    }

    const rangeHeader = request.headers.get('Range');
    return rangeHeader ? sliceResponse(cached, rangeHeader) : cached;
  }
}

async function precacheMedia(urls) {
  const cache = await caches.open(MEDIA_CACHE);
  const uniqueUrls = Array.from(new Set(urls))
    .map(url => new URL(url, self.location.origin))
    .filter(url => url.origin === self.location.origin && url.pathname.startsWith('/uploads/'));

  await Promise.all(uniqueUrls.map(async url => {
    const cacheKey = new Request(url.href);
    const cached = await cache.match(cacheKey);
    if (cached) return;

    const response = await fetch(cacheKey);
    if (response.ok && response.status === 200) {
      await cache.put(cacheKey, response.clone());
    }
  }));
}

async function sliceResponse(response, rangeHeader) {
  const blob = await response.clone().blob();
  const total = blob.size;

  const match = /bytes=(\d+)-(\d*)/.exec(rangeHeader);
  if (!match) return response.clone();

  const start = parseInt(match[1], 10);
  const rawEnd = match[2] ? parseInt(match[2], 10) : total - 1;

  if (start >= total || start > rawEnd) {
    return new Response(null, {
      status: 416,
      statusText: 'Range Not Satisfiable',
      headers: { 'Content-Range': `bytes */${total}` },
    });
  }

  const end = Math.min(rawEnd, total - 1);
  const slice = blob.slice(start, end + 1);

  return new Response(slice, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    return cached || new Response(
      JSON.stringify({ error: 'Offline' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
