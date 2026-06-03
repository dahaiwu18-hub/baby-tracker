const CACHE_NAME = 'baby-tracker-v3';

// 策略：网络优先，离线降级为缓存
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('supabase') || e.request.url.includes('api.openai')) {
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then(networkResponse => {
        const cloned = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, cloned));
        return networkResponse;
      })
      .catch(() => {
        return caches.match(e.request);
      })
  );
});
