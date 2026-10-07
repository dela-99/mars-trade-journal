// Only the public offline page is cached. Accounts, API responses, journals and
// screenshots always use the network and never enter this worker's cache.
const CACHE = 'mars-public-offline-v1';
const offlineUrl = new URL('offline.html', self.registration.scope).href;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add(offlineUrl)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('mars-public-offline-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const scope = new URL(self.registration.scope);
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname) || /\/api(?:\/|$)/.test(url.pathname)) return;
  event.respondWith(fetch(event.request).catch(async () => (await caches.match(offlineUrl)) || new Response('You are offline. Reconnect to open your journal.', {status:503,headers:{'Content-Type':'text/plain'}})));
});
