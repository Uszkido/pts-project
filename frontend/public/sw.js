const CACHE_NAME = 'pts-cache-v2';

self.addEventListener('install', event => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request).then(response => {
            return caches.open(CACHE_NAME).then(cache => {
                // Cache successful responses for subsequent offline use
                if (response.ok) {
                    cache.put(event.request, response.clone());
                }
                return response;
            });
        }).catch(() => {
            // If network fails, serve from cache
            return caches.match(event.request);
        })
    );
});
