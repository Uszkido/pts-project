'use client';
import { useState, useEffect, useRef } from 'react';
import MapComponent from '@/components/MapComponent';
import {
    checkIMEIOffline,
    syncBlacklist,
    queueReport,
    getBlacklistCount,
    getLastSyncTime,
    getQueuedCount,
    registerServiceWorker,
} from '@/lib/offlineDB';

export default function VendorScanner() {
    const [imei, setImei] = useState('');
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [isOnline, setIsOnline] = useState(true);
    const [offlineResult, setOfflineResult] = useState<any>(null);

    const [sellerEmail, setSellerEmail] = useState('');
    const [description, setDescription] = useState('');
    const [reportStatus, setReportStatus] = useState<string | null>(null);
    const [nearbyRisks, setNearbyRisks] = useState<any[]>([]);

    // Offline status bar state
    const [blacklistCount, setBlacklistCount] = useState(0);
    const [lastSync, setLastSync] = useState<Date | null>(null);
    const [queuedCount, setQueuedCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState<string | null>(null);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://pts-backend-api.vercel.app/api/v1';
    const token = typeof window !== 'undefined' ? localStorage.getItem('pts_token') || '' : '';

    // ──────────────────────────────────────────────
    // INIT
    // ──────────────────────────────────────────────
    useEffect(() => {
        if (!localStorage.getItem('pts_token')) {
            window.location.href = '/vendor/login';
            return;
        }

        // Register service worker
        registerServiceWorker();

        // Online/offline detection
        const onOnline = () => {
            setIsOnline(true);
            loadOfflineStats();
        };
        const onOffline = () => setIsOnline(false);
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);
        setIsOnline(navigator.onLine);

        // Listen for background sync completing
        window.addEventListener('pts:blacklist-synced', ((e: CustomEvent) => {
            setSyncMessage(`✅ Auto-synced ${e.detail.count} flagged IMEIs`);
            loadOfflineStats();
            setTimeout(() => setSyncMessage(null), 4000);
        }) as EventListener);

        loadOfflineStats();
        fetchNearbyRisks();
    }, []);

    async function loadOfflineStats() {
        setBlacklistCount(await getBlacklistCount());
        setLastSync(await getLastSyncTime());
        setQueuedCount(await getQueuedCount());
    }

    async function fetchNearbyRisks() {
        if (!navigator.onLine) return;
        try {
            const res = await fetch(`${apiUrl}/vendors/nearby-risks`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) setNearbyRisks(data.risks || []);
        } catch { }
    }

    // ──────────────────────────────────────────────
    // MANUAL BLACKLIST SYNC
    // ──────────────────────────────────────────────
    const handleSync = async () => {
        setIsSyncing(true);
        setSyncMessage(null);
        const outcome = await syncBlacklist(apiUrl, token);
        if (outcome.success) {
            setSyncMessage(`✅ Synced ${outcome.count} flagged IMEIs to your device`);
        } else {
            setSyncMessage(`❌ Sync failed: ${outcome.error || 'No internet'}`);
        }
        await loadOfflineStats();
        setIsSyncing(false);
        setTimeout(() => setSyncMessage(null), 5000);
    };

    // ──────────────────────────────────────────────
    // SCAN — online first, offline fallback
    // ──────────────────────────────────────────────
    const handleScan = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setResult(null);
        setOfflineResult(null);
        setReportStatus(null);

        if (navigator.onLine) {
            // ✅ ONLINE — hit the live API
            try {
                const { api } = await import('@/lib/api');
                const data = await api.get(`/devices/verify/${imei}`);
                setResult(data.device);
            } catch (err: any) {
                // If 404, set the error state in result
                if (err.message.includes('not found')) {
                    setResult({ error: err.message });
                } else {
                    // Other API failed — fall through to offline check
                    await runOfflineCheck();
                }
            }
        } else {
            // 📵 OFFLINE — check local IndexedDB blacklist
            await runOfflineCheck();
        }

        setLoading(false);
    };

    const runOfflineCheck = async () => {
        const check = await checkIMEIOffline(imei);
        if (check.found) {
            setOfflineResult({
                status: 'FLAGGED',
                message: 'This IMEI is in your local stolen device blacklist.',
                syncedAt: check.syncedAt,
                mode: 'offline-blacklist',
            });
        } else if (blacklistCount > 0) {
            setOfflineResult({
                status: 'NOT_IN_BLACKLIST',
                message: `This IMEI is not in your local blacklist (${blacklistCount.toLocaleString()} devices cached). Connect to internet for a full registry check.`,
                syncedAt: null,
                mode: 'offline-clean',
            });
        } else {
            setOfflineResult({
                status: 'NO_CACHE',
                message: 'No offline data available. Tap "Sync Blacklist" when connected to cache stolen device data.',
                mode: 'offline-empty',
            });
        }
    };

    // ──────────────────────────────────────────────
    // REPORT — queue offline if needed
    // ──────────────────────────────────────────────
    const handleReport = async (e: React.FormEvent) => {
        e.preventDefault();
        const reportPayload = {
            url: `${apiUrl}/vendors/suspicious-alert`,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: { imei, sellerEmail, description },
            tag: 'pts-report-sync',
        };

        if (navigator.onLine) {
            try {
                const res = await fetch(reportPayload.url, {
                    method: 'POST',
                    headers: reportPayload.headers,
                    body: JSON.stringify(reportPayload.body)
                });
                const data = await res.json();
                if (res.ok) {
                    setReportStatus('✅ Alert transmitted to Police Intelligence. Do not proceed with this transaction.');
                    setSellerEmail(''); setDescription('');
                } else throw new Error(data.error);
            } catch {
                await queueReport(reportPayload);
                setReportStatus('📵 You\'re offline — report saved locally. It will auto-transmit to police when you reconnect.');
                await loadOfflineStats();
            }
        } else {
            await queueReport(reportPayload);
            setReportStatus('📵 Report queued offline. Will auto-transmit to police when reconnected.');
            await loadOfflineStats();
        }
    };

    const formatSyncTime = (date: Date | null) => {
        if (!date) return 'Never';
        const diff = Date.now() - date.getTime();
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return date.toLocaleDateString();
    };

    return (
        <div className="min-h-screen bg-slate-950 font-sans text-slate-200">

            {/* NAV */}
            <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 py-4 flex justify-between items-center sticky top-0 z-50">
                <div className="text-white font-bold flex items-center gap-3">
                    <span className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 text-sm">PTS</span>
                    <div className="flex flex-col">
                        <span className="leading-tight text-sm">Vendor Terminal</span>
                        <span className={`text-[10px] uppercase tracking-widest font-semibold flex items-center gap-1 ${isOnline ? 'text-emerald-400' : 'text-amber-400'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></div>
                            {isOnline ? 'Online' : 'Offline Mode'}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <a href="/vendor/dashboard" className="text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors hidden sm:block">Register Inventory</a>
                    <button onClick={() => { localStorage.removeItem('pts_token'); window.location.href = '/vendor/login'; }} className="text-sm font-medium text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 px-4 py-2 rounded-lg transition-colors">Sign Out</button>
                </div>
            </nav>

            {/* OFFLINE STATUS BAR */}
            <div className={`border-b px-6 py-3 flex flex-wrap gap-3 items-center justify-between text-xs transition-colors ${isOnline ? 'border-slate-800 bg-slate-900/40' : 'border-amber-500/20 bg-amber-500/5'}`}>
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-semibold uppercase tracking-wider">Offline Cache:</span>
                        <span className={`font-bold ${blacklistCount > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {blacklistCount > 0 ? `${blacklistCount.toLocaleString()} flagged IMEIs` : 'Empty — sync required'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-semibold uppercase tracking-wider">Last Sync:</span>
                        <span className="text-slate-300 font-semibold">{formatSyncTime(lastSync)}</span>
                    </div>
                    {queuedCount > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold">
                                {queuedCount} report{queuedCount > 1 ? 's' : ''} queued
                            </span>
                        </div>
                    )}
                </div>
                <button
                    onClick={handleSync}
                    disabled={isSyncing || !isOnline}
                    className={`flex items-center gap-2 font-bold px-4 py-1.5 rounded-lg transition-all text-xs uppercase tracking-wider ${isOnline ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                >
                    {isSyncing ? (
                        <><span className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></span>Syncing...</>
                    ) : (
                        <>⟳ Sync Blacklist</>
                    )}
                </button>
            </div>

            {/* SYNC MESSAGE */}
            {syncMessage && (
                <div className={`mx-6 mt-4 px-4 py-3 rounded-xl text-sm font-semibold border ${syncMessage.startsWith('✅') ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                    {syncMessage}
                </div>
            )}

            <main className="max-w-4xl mx-auto p-4 sm:p-6 mt-6 sm:mt-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Pre-Purchase IMEI Scanner</h1>
                    <p className="text-slate-400 text-sm">
                        {isOnline
                            ? 'Live registry scan. Results reflect the national database in real-time.'
                            : '📵 Offline Mode — checking your locally cached stolen device blacklist.'}
                    </p>
                </div>

                {/* SCAN FORM */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl mb-6">
                    <form onSubmit={handleScan} className="flex gap-4">
                        <input
                            type="text"
                            value={imei}
                            onChange={e => setImei(e.target.value.replace(/\D/g, '').slice(0, 15))}
                            placeholder="Enter 15-digit IMEI number"
                            required
                            className="flex-1 bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white text-lg font-mono tracking-widest focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        />
                        <button
                            type="submit"
                            disabled={imei.length < 15 || loading}
                            className={`font-bold px-8 rounded-xl disabled:opacity-50 transition-colors ${isOnline ? 'bg-blue-600 hover:bg-blue-500' : 'bg-amber-600 hover:bg-amber-500'} text-white`}
                        >
                            {loading ? 'Scanning...' : isOnline ? 'Scan Live' : '📵 Scan Offline'}
                        </button>
                    </form>
                    {blacklistCount === 0 && !isOnline && (
                        <div className="mt-4 text-xs text-amber-400 bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 font-medium">
                            ⚠ No offline data cached. Connect to internet and tap &quot;Sync Blacklist&quot; to enable offline scanning.
                        </div>
                    )}
                </div>

                {/* NEARBY RISKS MAP */}
                {nearbyRisks.length > 0 && (
                    <div className="mb-6 bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-red-950/20">
                            <h3 className="text-xs font-black uppercase tracking-widest text-red-400 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping"></div>
                                High-Risk Radar: Local Reported Pings
                            </h3>
                        </div>
                        <div className="h-48 w-full">
                            <MapComponent
                                zoom={10}
                                interactive={false}
                                markers={nearbyRisks.map(r => ({
                                    lat: r.latitude,
                                    lng: r.longitude,
                                    label: `Ping: ${r.device.brand} ${r.device.model}`,
                                    color: "#ef4444"
                                }))}
                            />
                        </div>
                    </div>
                )}

                {/* OFFLINE RESULT */}
                {offlineResult && (
                    <div className={`rounded-3xl p-6 mb-6 border ${offlineResult.status === 'FLAGGED'
                        ? 'bg-red-950/30 border-red-900/50'
                        : offlineResult.status === 'NOT_IN_BLACKLIST'
                            ? 'bg-emerald-950/20 border-emerald-900/30'
                            : 'bg-amber-950/20 border-amber-900/30'
                        }`}>
                        <div className="flex items-start gap-4">
                            <span className="text-3xl">
                                {offlineResult.status === 'FLAGGED' ? '🚨' :
                                    offlineResult.status === 'NOT_IN_BLACKLIST' ? '✅' : '📵'}
                            </span>
                            <div>
                                <div className={`font-black text-lg mb-1 ${offlineResult.status === 'FLAGGED' ? 'text-red-400' :
                                    offlineResult.status === 'NOT_IN_BLACKLIST' ? 'text-emerald-400' : 'text-amber-400'
                                    }`}>
                                    {offlineResult.status === 'FLAGGED' ? '⚠ DEVICE IS FLAGGED — DO NOT BUY' :
                                        offlineResult.status === 'NOT_IN_BLACKLIST' ? 'Not in offline blacklist' :
                                            'No offline data available'}
                                </div>
                                <p className="text-sm text-slate-300 leading-relaxed">{offlineResult.message}</p>
                                {offlineResult.syncedAt && (
                                    <p className="text-xs text-slate-500 mt-2">Cached {formatSyncTime(new Date(offlineResult.syncedAt))}</p>
                                )}
                                <div className="mt-3 text-xs text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                    Offline Mode — {blacklistCount.toLocaleString()} devices in local cache
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ONLINE RESULT */}
                {result && (
                    <div className={`p-[1px] rounded-3xl bg-gradient-to-b ${result.status === 'CLEAN' && result.riskScore >= 50 ? 'from-emerald-500/50 via-emerald-500/10' : 'from-red-600/60 via-red-600/20'}`}>
                        <div className="bg-slate-900/90 rounded-[23px] p-6 shadow-2xl">
                            <div className="flex justify-between items-start mb-6 border-b border-slate-800 pb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-white">{result.brand} {result.model}</h2>
                                    <p className="font-mono text-slate-400 tracking-widest">{result.imei}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-slate-500 font-bold uppercase">Trust Index</p>
                                    <p className={`text-4xl font-black ${result.riskScore >= 90 ? 'text-emerald-400' : result.riskScore >= 50 ? 'text-amber-400' : 'text-red-500'}`}>
                                        {result.riskScore}/100
                                    </p>
                                    <p className="text-sm font-bold uppercase mt-1 text-slate-400">{result.status}</p>
                                </div>
                            </div>

                            {result.riskScore < 90 && (
                                <div className="mt-6 bg-slate-950 p-6 rounded-2xl border border-rose-900/50">
                                    <h3 className="text-rose-400 font-bold mb-2 flex items-center gap-2">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        Report Suspicious Seller
                                    </h3>
                                    <p className="text-sm text-slate-400 mb-6">
                                        This device has a low trust index or is flagged. If someone is attempting to sell this to you, report it immediately.
                                        {!isOnline && <span className="block mt-2 text-amber-400 font-semibold">📵 Report will be queued and auto-sent when you reconnect.</span>}
                                    </p>

                                    {reportStatus ? (
                                        <div className={`p-4 border rounded-xl font-medium text-sm ${reportStatus.includes('queued') || reportStatus.includes('offline')
                                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                            }`}>
                                            {reportStatus}
                                        </div>
                                    ) : (
                                        <form onSubmit={handleReport} className="space-y-4">
                                            <input type="email" value={sellerEmail} onChange={e => setSellerEmail(e.target.value)} placeholder="Seller's PTS Email (if known)" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-rose-500 focus:outline-none" />
                                            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the seller and the incident..." rows={3} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-rose-500 focus:outline-none resize-none" />
                                            <button type="submit" className="bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 px-6 rounded-xl w-full">
                                                {isOnline ? 'Transmit Encrypted Alert to Police' : '📵 Queue Report (Sends When Online)'}
                                            </button>
                                        </form>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
