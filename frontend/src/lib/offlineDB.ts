/**
 * PTS Offline IMEI Database (IndexedDB)
 * 
 * Syncs the stolen device blacklist locally so the vendor scanner
 * can check IMEI status even with ZERO internet connectivity.
 */

const DB_NAME = 'pts-offline-db';
const DB_VERSION = 2;

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e: any) => {
            const db = e.target.result as IDBDatabase;
            if (!db.objectStoreNames.contains('blacklist')) {
                db.createObjectStore('blacklist', { keyPath: 'imei' });
            }
            if (!db.objectStoreNames.contains('queue')) {
                const qs = db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
                qs.createIndex('tag', 'tag');
            }
            if (!db.objectStoreNames.contains('meta')) {
                db.createObjectStore('meta', { keyPath: 'key' });
            }
        };
        req.onsuccess = (e: any) => resolve(e.target.result);
        req.onerror = () => reject(req.error);
    });
}

function promisifyRequest<T>(req: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// ========================================================
// BLACKLIST OPERATIONS
// ========================================================

/** Check if an IMEI is in the local offline blacklist */
export async function checkIMEIOffline(imei: string): Promise<{
    found: boolean;
    status?: string;
    syncedAt?: number;
}> {
    try {
        const db = await openDB();
        const tx = db.transaction('blacklist', 'readonly');
        const store = tx.objectStore('blacklist');
        const result = await promisifyRequest(store.get(imei));
        if (result) {
            return { found: true, status: (result as any).status, syncedAt: (result as any).syncedAt };
        }
        return { found: false };
    } catch {
        return { found: false };
    }
}

/** Get count of cached blacklisted devices */
export async function getBlacklistCount(): Promise<number> {
    try {
        const db = await openDB();
        const tx = db.transaction('blacklist', 'readonly');
        return await promisifyRequest(tx.objectStore('blacklist').count());
    } catch {
        return 0;
    }
}

/** Get the last time the blacklist was synced */
export async function getLastSyncTime(): Promise<Date | null> {
    try {
        const db = await openDB();
        const tx = db.transaction('meta', 'readonly');
        const result = await promisifyRequest(tx.objectStore('meta').get('lastSync'));
        if (result) return new Date((result as any).value);
        return null;
    } catch {
        return null;
    }
}

/** Sync the blacklist from the API into IndexedDB */
export async function syncBlacklist(apiUrl: string, token?: string): Promise<{
    success: boolean;
    count: number;
    error?: string;
}> {
    try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${apiUrl}/public/blacklist`, { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const blacklist: Array<{ imei: string; status: string }> = data.blacklist || [];

        const db = await openDB();
        const tx = db.transaction(['blacklist', 'meta'], 'readwrite');
        const bStore = tx.objectStore('blacklist');
        const mStore = tx.objectStore('meta');

        // Clear old data
        await promisifyRequest(bStore.clear());

        // Insert all flagged IMEIs
        for (const item of blacklist) {
            bStore.put({ imei: item.imei, status: item.status, syncedAt: Date.now() });
        }

        // Record sync time
        mStore.put({ key: 'lastSync', value: Date.now() });

        return { success: true, count: blacklist.length };
    } catch (err: any) {
        return { success: false, count: 0, error: err.message };
    }
}

// ========================================================
// REPORT QUEUE — queues suspicious reports when offline
// ========================================================

export interface QueuedReport {
    id?: number;
    url: string;
    headers: Record<string, string>;
    body: Record<string, any>;
    tag: string;
    queuedAt: number;
}

/** Add a suspicious report to the offline queue */
export async function queueReport(report: Omit<QueuedReport, 'queuedAt'>): Promise<boolean> {
    try {
        const db = await openDB();
        const tx = db.transaction('queue', 'readwrite');
        tx.objectStore('queue').add({ ...report, queuedAt: Date.now() });
        // Register background sync if available
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
            const reg = await navigator.serviceWorker.ready;
            await (reg as any).sync.register('pts-report-sync');
        }
        return true;
    } catch {
        return false;
    }
}

/** Get count of queued offline reports */
export async function getQueuedCount(): Promise<number> {
    try {
        const db = await openDB();
        const tx = db.transaction('queue', 'readonly');
        return await promisifyRequest(tx.objectStore('queue').count());
    } catch {
        return 0;
    }
}

// ========================================================
// SERVICE WORKER REGISTRATION
// ========================================================

export function registerServiceWorker(): void {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', async () => {
        try {
            const reg = await navigator.serviceWorker.register('/sw.js');
            console.log('[PTS] Service Worker registered:', reg.scope);

            // Listen for messages from SW
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data?.type === 'BLACKLIST_SYNCED') {
                    console.log(`[PTS] Blacklist auto-synced: ${event.data.count} flagged IMEIs`);
                    window.dispatchEvent(new CustomEvent('pts:blacklist-synced', { detail: event.data }));
                }
            });
        } catch (err) {
            console.warn('[PTS] Service Worker registration failed:', err);
        }
    });
}
