/* Service Worker for grinder-converter PWA.
 *
 * Strategy:
 *   - HTML navigations (the app document): network-first, falling back to the
 *     cached ./index.html when offline. This lets content-only index.html
 *     edits propagate to existing installs without a manual version bump.
 *   - Static assets (manifest/icons in APP_SHELL): cache-first, precached on
 *     install. Falls back to network if missing.
 *   - Google Fonts CSS + WOFF2: stale-while-revalidate. First visit needs
 *     network; afterwards served from cache and refreshed in the background.
 *   - Anything else same-origin: cache-first with network fallback.
 *   - Anything else: passes through to network.
 *
 * Because HTML is network-first, CACHE_VERSION only needs bumping when the
 * precache list or critical static assets (icons/manifest) change. The
 * 'activate' handler removes stale caches.
 */

const CACHE_VERSION = 'v2-2026-06-06';
const APP_CACHE = `grinder-app-${CACHE_VERSION}`;
const FONT_CACHE = `grinder-fonts-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((k) => k !== APP_CACHE && k !== FONT_CACHE)
        .map((k) => caches.delete(k)),
    )).then(() => self.clients.claim()),
  );
});

function isFontRequest(url) {
  return url.hostname === 'fonts.googleapis.com'
      || url.hostname === 'fonts.gstatic.com';
}

function isHtmlNavigation(request, url) {
  if (request.mode === 'navigation') return true;
  if (url.origin !== self.location.origin) return false;
  const path = url.pathname;
  return path === '/' || path.endsWith('/') || path.endsWith('index.html');
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    return cached || cache.match('./index.html');
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request).then((response) => {
    if (response && (response.ok || response.type === 'opaque')) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);
  return cached || networkPromise;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (isFontRequest(url)) {
    event.respondWith(staleWhileRevalidate(request, FONT_CACHE));
    return;
  }

  if (isHtmlNavigation(request, url)) {
    event.respondWith(networkFirst(request, APP_CACHE));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      cacheFirst(request, APP_CACHE).catch(() => caches.match('./index.html')),
    );
  }
});
