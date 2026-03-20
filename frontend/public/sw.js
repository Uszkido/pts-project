// PTS Service Worker v2.0 — Offline-First IMEI Scanner
const CACHE_NAME = 'pts-shell-v2';
const BLACKLIST_SYNC_TAG = 'pts-blacklist-sync';
const REPORT_SYNC_TAG = 'pts-report-sync';

// App shell — pages that must work offline
const SHELL_URLS = [
    '/',
    '/vendor/scanner',
    '/vendor/login',
    '/offline',
];

// ============================================================
// INSTALL — Cache the app shell
// ============================================================
self.addEventListener('install', (event) => {
    console.log('[SW] Installing PTS Service Worker...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching app shell');
            return cache.addAll(SHELL_URLS).catch((err) => {
                console.warn('[SW] Some shell URLs failed to cache:', err);
            });
        }).then(() => self.skipWaiting())
    );
});

// ============================================================
// ACTIVATE — Clean old caches
// ============================================================
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating PTS Service Worker...');
    event.waitUntil(
        caches.keys().then((cacheNames) =>
            Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            )
        ).then(() => self.clients.claim())
    );
});

// ============================================================
// FETCH — Network-first for API, Cache-first for shell
// ============================================================
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Never intercept non-GET or chrome-extension requests
    if (event.request.method !== 'GET') return;
    if (url.protocol === 'chrome-extension:') return;

    // API calls — network first, fail gracefully
    if (url.hostname.includes('vercel.app') || url.pathname.startsWith('/api')) {
        event.respondWith(
            fetch(event.request)
                .catch(() => new Response(
                    JSON.stringify({ error: 'OFFLINE', message: 'No internet connection. Using local blacklist data.' }),
                    { status: 503, headers: { 'Content-Type': 'application/json' } }
                ))
        );
        return;
    }

    // App shell — cache first, network fallback
    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request).then((response) => {
                // Cache successful responses for next time
                if (response && response.status === 200) {
                    const cloned = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
                }
                return response;
            }).catch(() => {
                // Return offline page for navigation requests
                if (event.request.mode === 'navigate') {
                    return caches.match('/offline') || new Response('<h1>Offline</h1>', { headers: { 'Content-Type': 'text/html' } });
                }
            });
        })
    );
});

// ============================================================
// BACKGROUND SYNC — Flush queued offline reports when back online
// ============================================================
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync triggered:', event.tag);

    if (event.tag === REPORT_SYNC_TAG) {
        event.waitUntil(flushQueuedReports());
    }
    if (event.tag === BLACKLIST_SYNC_TAG) {
        event.waitUntil(syncBlacklist());
    }
});

async function flushQueuedReports() {
    const db = await openDB();
    const tx = db.transaction('queue', 'readwrite');
    const store = tx.objectStore('queue');
    const all = await promisifyRequest(store.getAll());

    console.log(`[SW] Flushing ${all.length} queued reports...`);

    for (const item of all) {
        try {
            const res = await fetch(item.url, {
                method: 'POST',
                headers: item.headers,
                body: JSON.stringify(item.body),
            });
            if (res.ok) {
                const deleteTx = db.transaction('queue', 'readwrite');
                deleteTx.objectStore('queue').delete(item.id);
                console.log('[SW] Queued report synced and removed:', item.id);
            }
        } catch (err) {
            console.warn('[SW] Still offline, keeping report in queue:', item.id);
        }
    }
}

async function syncBlacklist() {
    try {
        const res = await fetch('https://pts-backend-api.vercel.app/api/v1/public/blacklist');
        if (!res.ok) return;
        const data = await res.json();
        const db = await openDB();
        const tx = db.transaction('blacklist', 'readwrite');
        const store = tx.objectStore('blacklist');
        // Clear and repopulate
        await promisifyRequest(store.clear());
        for (const imei of (data.blacklist || [])) {
            store.put({ imei, syncedAt: Date.now() });
        }
        console.log(`[SW] Blacklist synced: ${data.blacklist?.length || 0} flagged IMEIs`);
        // Notify all clients
        const clients = await self.clients.matchAll();
        clients.forEach((client) => client.postMessage({ type: 'BLACKLIST_SYNCED', count: data.blacklist?.length || 0 }));
    } catch (err) {
        console.warn('[SW] Blacklist sync failed (offline):', err);
    }
}

// ============================================================
// MESSAGE HANDLER — from the app
// ============================================================
self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
    if (event.data?.type === 'SYNC_BLACKLIST') syncBlacklist();
});

// ============================================================
// IndexedDB helper — minimal promise wrapper
// ============================================================
function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('pts-offline-db', 2);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('blacklist')) {
                db.createObjectStore('blacklist', { keyPath: 'imei' });
            }
            if (!db.objectStoreNames.contains('queue')) {
                const qs = db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
                qs.createIndex('tag', 'tag');
            }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = () => reject(req.error);
    });
}

function promisifyRequest(req) {
    return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}
