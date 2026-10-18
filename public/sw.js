// Cache dos tiles de satélite e relevo: a segunda visita abre sem baixar os
// ~600 tiles de novo. Os arquivos do próprio site vêm da rede primeiro, para
// um deploy novo aparecer na hora, e do cache quando não há rede.
const TILES = 'cheia-tiles-v1';
const SITE = 'cheia-site-v1';
const TILE_HOSTS = ['server.arcgisonline.com', 's3.amazonaws.com'];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (TILE_HOSTS.includes(url.host)) {
    e.respondWith(caches.open(TILES).then(async (c) => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) e.waitUntil(c.put(e.request, res.clone()));
      return res;
    }));
  } else if (url.origin === self.location.origin) {
    e.respondWith(fetch(e.request).then((res) => {
      // a cópia sai antes de a página consumir o corpo da resposta
      if (res.ok) {
        const copy = res.clone();
        e.waitUntil(caches.open(SITE).then((c) => c.put(e.request, copy)));
      }
      return res;
    }).catch(() => caches.match(e.request)));
  }
});
