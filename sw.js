/* Груми зовёт — сервис-воркер.
   Стратегия: «сначала сеть, потом сохранённая копия».
   Онлайн всегда берётся свежая версия с сервера, офлайн — копия из памяти телефона.
   Версии менять не нужно: достаточно заменить index.html на GitHub. */
const CACHE = 'grumi-cache-v1';
const ASSETS = ['./', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-64.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.searchParams.has('_')) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const net = fetch(req, { cache: 'no-cache' }).then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    });
    net.catch(() => {});
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000));
    try {
      return await Promise.race([net, timeout]);
    } catch (err) {
      const hit = (await cache.match(req, { ignoreSearch: true })) ||
                  (req.mode === 'navigate' ? await cache.match('./index.html') : null);
      if (hit) return hit;
      return net.catch(() => new Response('Нет сети', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }));
    }
  })());
});
