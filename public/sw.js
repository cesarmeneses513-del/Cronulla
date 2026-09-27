// Service worker for the installed app (PWA).
// - Pages: network first, so each deploy shows up right away; the cached copy is used offline.
// - Built files, logos, stage drawings and photo previews: cached after first use (they never
//   change under the same URL), which makes the app open and scroll faster.
// - Everything else (the database, full-size photos) goes straight to the network.
const CACHE = 'cronulla-v1';
const SHELL = ['/', '/manifest.webmanifest', '/cpr-logo-circle.png', '/cpr-logo-full.png', '/icon-192.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const cacheFirst = async request => {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
};

const networkFirst = async request => {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put('/', response.clone());
    return response;
  } catch {
    return (await cache.match('/')) || Response.error();
  }
};

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
  } else if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/stages/') ||
    url.pathname.startsWith('/api/thumb') ||
    /\.(png|jpg|webmanifest)$/.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request));
  }
});
