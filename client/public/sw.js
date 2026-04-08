// Service Worker – kiosplay
// Strategies:
//   /uploads/*  → network-pass-through online; SW cache fallback offline
//                 (full 200 responses are saved in SW cache for offline use,
//                  range requests are satisfied by slicing the cached blob)
//   /api/public/* → network-first; SW cache fallback offline
//   everything else → no interception

const MEDIA_CACHE = 'kiosplay-media-v1';
const API_CACHE   = 'kiosplay-api-v1';

// ── Lifecycle ────────────────────────────────────────────────────────────────

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== MEDIA_CACHE && k !== API_CACHE)
          .map(k => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
});

// ── Fetch ────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests; skip admin pages.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/admin')) return;

  if (url.pathname.startsWith('/uploads/')) {
    event.respondWith(handleMedia(event.request));
    return;
  }

  if (url.pathname.startsWith('/api/public/')) {
    event.respondWith(networkFirst(event.request, API_CACHE));
    return;
  }
});

// ── Media handler ────────────────────────────────────────────────────────────
// Online: pass request through unchanged (server Cache-Control + browser HTTP
//         cache handle it). Cache every complete (200) response in the SW
//         cache so it is available offline.
// Offline: serve from SW cache, slicing the stored blob to satisfy any Range
//          header the browser sends (required for <video> streaming).

async function handleMedia(request) {
  const cache    = await caches.open(MEDIA_CACHE);
  const cacheKey = new Request(request.url); // key without Range header

  try {
    const response = await fetch(request);

    // Store full responses for offline use (don't await – run in background).
    if (response.ok && response.status === 200) {
      cache.put(cacheKey, response.clone());
    }

    return response;
  } catch {
    // Network failed – try to serve from SW cache.
    const cached = await cache.match(cacheKey);
    if (!cached) {
      return new Response(null, { status: 503, statusText: 'Offline – media not cached' });
    }

    const rangeHeader = request.headers.get('Range');
    return rangeHeader ? sliceResponse(cached, rangeHeader) : cached;
  }
}

// ── Range-slice helper ───────────────────────────────────────────────────────
// Reads the full cached blob and returns a proper 206 Partial Content response
// for the requested byte range.  Needed because the Cache API stores complete
// responses; the browser always uses Range requests when streaming <video>.

async function sliceResponse(response, rangeHeader) {
  const blob  = await response.clone().blob();
  const total = blob.size;

  const match = /bytes=(\d+)-(\d*)/.exec(rangeHeader);
  if (!match) return response.clone();

  const start  = parseInt(match[1], 10);
  const rawEnd = match[2] ? parseInt(match[2], 10) : total - 1;

  // Validate range bounds.
  if (start >= total || start > rawEnd) {
    return new Response(null, {
      status: 416,
      statusText: 'Range Not Satisfiable',
      headers: { 'Content-Range': `bytes */${total}` },
    });
  }

  // Clamp end so it never exceeds the last byte index.
  const end   = Math.min(rawEnd, total - 1);
  const slice = blob.slice(start, end + 1);

  return new Response(slice, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type':  response.headers.get('Content-Type') || 'application/octet-stream',
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}

// ── Network-first helper ─────────────────────────────────────────────────────

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(
      JSON.stringify({ error: 'Offline' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
