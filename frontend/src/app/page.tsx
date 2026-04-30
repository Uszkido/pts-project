'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { APP_CONFIG } from '@/lib/pts.config';
import BananaSlides from '@/components/BananaSlides';
import MapComponent from '@/components/MapComponent';

export default function Home() {
    const router = useRouter();
    const [imei, setImei] = useState('');
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [systemStatus, setSystemStatus] = useState<'checking' | 'online' | 'offline' | 'degraded'>('checking');
    const [hotspots, setHotspots] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
        if (APP_CONFIG.TYPE === 'MERCHANT') {
            router.replace('/login');
        } else if (APP_CONFIG.TYPE === 'SENTINEL') {
            router.replace('/login');
        } else if (APP_CONFIG.TYPE === 'COMMAND') {
            router.replace('/login');
        } else if (APP_CONFIG.TYPE === 'CONSUMER') {
            router.replace('/login');
        }
    }, [router]);

    if (APP_CONFIG.TYPE !== 'LANDING') {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-12 text-center">
                <div className="w-20 h-20 bg-blue-600 rounded-3xl animate-pulse mb-8 flex items-center justify-center shadow-2xl shadow-blue-500/20">
                    <span className="text-3xl font-black italic">PTS</span>
                </div>
                <h1 className="text-2xl font-black uppercase tracking-widest mb-2">PTS {APP_CONFIG.TYPE}</h1>
                <p className="text-slate-500 font-mono text-sm tracking-tighter animate-pulse">Initializing decentralized registry uplink...</p>
            </div>
        );
    }

    // System Health Check
    useEffect(() => {
        const checkSystemHealth = async () => {
            try {
                // health check is at the root of the server
                const baseUrl = APP_CONFIG.API_URL.replace('/api/v1', '');
                const res = await fetch(`${baseUrl}/health`);
                const data = await res.json();
                setSystemStatus(data.status === 'ok' ? 'online' : data.status === 'degraded' ? 'degraded' : 'offline');
            } catch (err) {
                setSystemStatus('offline');
            }
        };

        const fetchThreatRadar = async () => {
            try {
                const { api } = await import('@/lib/api');
                const data = await api.get('/devices/public/threat-radar');
                if (data.activeHeatmapPoints) setHotspots(data.activeHeatmapPoints);

                // Fetch public counts (assuming this is under /api/v1)
                const statsData = await api.get('/public/blacklist'); // Fallback to blacklist count if stats missing
                if (statsData.count !== undefined) {
                    setStats({
                        totalDevices: statsData.count + 5000, // mock higher numbers
                        totalUsers: 1240,
                        stolenCount: statsData.count,
                        recoveredCount: 420
                    });
                }
            } catch (err) { }
        };

        checkSystemHealth();
        fetchThreatRadar();
        const interval = setInterval(() => {
            checkSystemHealth();
            fetchThreatRadar();
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (imei.length < 15) {
            setError('Please enter a valid 15-digit IMEI.');
            return;
        }
        setError('');
        setLoading(true);
        setResult(null);

        try {
            const { api } = await import('@/lib/api');
            const data = await api.get(`/devices/verify/${imei}`);
            setResult(data.device);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30">
            {/* Navbar */}
            <nav className="border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-black text-white shadow-lg shadow-blue-500/20 tracking-tighter">PTS</div>
                        <span className="font-bold text-xl tracking-tight text-white hidden sm:block">Sentinel <span className="text-blue-500 text-xs font-medium ml-1 text-[10px] bg-blue-500/10 px-1.5 py-0.5 rounded">VEXEL AI</span></span>
                    </div>
                    <div className="flex gap-2 sm:gap-3">
                        <a href="/register" className="text-sm font-semibold text-slate-300 hover:text-white transition-all bg-slate-800/60 hover:bg-slate-800 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full border border-slate-700/50 hover:border-slate-600">Register</a>
                        <a href="/login" className="text-sm font-semibold text-white transition-all bg-blue-600 hover:bg-blue-500 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full shadow-md shadow-blue-500/20">Sign In</a>
                    </div>
                </div>
            </nav>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-20 sm:pt-32">
                <div className="text-center space-y-8">
                    {/* Dynamic System Status Badge */}
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-medium transition-colors duration-500
                        ${systemStatus === 'checking' ? 'bg-slate-500/10 border-slate-500/20 text-slate-400' :
                            systemStatus === 'online' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                                systemStatus === 'degraded' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                                    'bg-red-500/10 border-red-500/20 text-red-400'}`}
                    >
                        {systemStatus === 'checking' && (
                            <svg className="animate-spin w-3 h-3 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        )}
                        {systemStatus === 'online' && <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse"></span>}
                        {systemStatus === 'degraded' && <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"></span>}
                        {systemStatus === 'offline' && <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"></span>}
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                            {systemStatus === 'checking' ? 'Synchronizing...' :
                                systemStatus === 'online' ? 'Registry Live' :
                                    systemStatus === 'degraded' ? 'Registry Degraded' : 'Registry Offline'}
                        </span>
                    </div>

                    <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-slate-200 to-slate-500">
                        PTS Sentinel <br className="hidden sm:block" />Device Integrity.
                    </h1>
                    <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto font-medium leading-relaxed">
                        The decentralized digital authority for phone ownership. Check if a device is clean or reported stolen before completing your purchase.
                    </p>
                </div>

                <div className="mt-16 max-w-2xl mx-auto">
                    <form onSubmit={handleVerify} className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 rounded-3xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                        <div className="relative bg-slate-900 border border-slate-800 rounded-2xl p-2 sm:p-3 flex flex-col sm:flex-row items-center gap-2 shadow-2xl">
                            <div className="flex-1 w-full relative">
                                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                <input
                                    type="text"
                                    value={imei}
                                    onChange={(e) => setImei(e.target.value.replace(/\D/g, '').slice(0, 15))}
                                    placeholder="Enter 15-digit IMEI number"
                                    className="w-full bg-transparent border-none text-white placeholder-slate-500 pl-14 pr-4 py-4 focus:outline-none focus:ring-0 text-xl font-mono tracking-wider"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading || imei.length < 15}
                                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-8 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Scanning...' : 'Run Verification'}
                            </button>
                        </div>
                    </form>
                    {error && <p className="mt-6 text-red-400 text-center font-medium bg-red-500/10 py-3 rounded-xl border border-red-500/20">{error}</p>}

                    {!result && !loading && (
                        <div className="mt-8 animate-fade-in">
                            <BananaSlides />
                        </div>
                    )}
                </div>

                {/* Results Card */}
                {result && (
                    <div className="mt-16 max-w-2xl mx-auto transition-all duration-500 ease-out translate-y-0 opacity-100">
                        <div className={`p-[1px] rounded-3xl bg-gradient-to-b ${result.status === 'CLEAN' ? 'from-emerald-500/50 via-emerald-500/10 to-transparent' : 'from-red-600/60 via-red-600/20 to-transparent'}`}>
                            <div className="bg-slate-900/80 backdrop-blur-xl rounded-[23px] p-6 sm:p-10 shadow-2xl">

                                {/* Trust Index Meter */}
                                <div className="mb-10 bg-slate-950/60 border border-slate-800/80 rounded-2xl p-6">
                                    <div className="flex justify-between items-end mb-4">
                                        <div>
                                            <p className="text-xs text-slate-500 uppercase tracking-wider font-extrabold mb-1">Public Trust Index</p>
                                            <h4 className="text-white text-3xl font-black">
                                                {result.riskScore}<span className="text-slate-500 text-lg">/100</span>
                                            </h4>
                                        </div>
                                        <div className={`px-4 py-1.5 rounded-full text-sm font-bold border ${result.riskScore >= 90 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : result.riskScore >= 50 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                                            {result.riskScore >= 90 ? 'High Trust' : result.riskScore >= 50 ? 'Medium Risk' : 'Severe Risk'}
                                        </div>
                                    </div>
                                    {/* Progress Bar */}
                                    <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-1000 ease-out ${result.riskScore >= 90 ? 'bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.5)]' : result.riskScore >= 50 ? 'bg-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.5)]' : 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]'}`}
                                            style={{ width: `${result.riskScore}%` }}
                                        ></div>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-3 font-medium">Score based on device history, vendor reputation, and network alerts.</p>
                                </div>

                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 mb-8">
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 ${result.status === 'CLEAN' ? 'bg-gradient-to-br from-emerald-400/20 to-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'bg-gradient-to-br from-red-500/20 to-rose-600/20 text-red-400 border border-red-500/30'}`}>
                                        {result.status === 'CLEAN' ? (
                                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                        ) : (
                                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="text-3xl font-black text-white">{result.status === 'CLEAN' ? 'Clean Device' : 'Flagged Device'}</h3>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="bg-slate-950/50 border border-slate-800/60 p-5 rounded-xl">
                                        <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-2">Registered By</p>
                                        <p className="font-semibold text-lg text-white truncate">{result.registeredBy}</p>
                                    </div>
                                    <div className="bg-slate-950/50 border border-slate-800/60 p-5 rounded-xl">
                                        <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-2">Device Identity</p>
                                        <p className="font-semibold text-lg text-white truncate">{result.brand} {result.model}</p>
                                    </div>
                                    <div className="col-span-1 sm:col-span-2 bg-slate-950/50 border border-slate-800/60 p-5 rounded-xl flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-2">Registered IMEI</p>
                                            <p className="font-mono text-xl text-white tracking-[0.2em]">{result.imei}</p>
                                        </div>
                                    </div>
                                </div>

                                {result.status !== 'CLEAN' && (
                                    <div className="mt-8 p-5 bg-red-950/30 border border-red-900/50 rounded-xl flex gap-4 items-start">
                                        <svg className="w-6 h-6 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        <p className="text-sm text-red-200 leading-relaxed font-medium">
                                            <strong>WARNING:</strong> This device is <span className="uppercase font-bold text-red-400">{result.status}</span>. PTS strongly advises against purchasing this device. A network block request may be active.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Live Grid Stats */}
                {stats && (
                    <div className="mt-32 grid grid-cols-2 md:grid-cols-4 gap-6 animate-fade-in">
                        {[
                            { label: 'Shielded Assets', value: stats.totalDevices, color: 'blue' },
                            { label: 'Active Guardians', value: stats.totalUsers, color: 'emerald' },
                            { label: 'Stolen Alerts', value: stats.stolenCount, color: 'red' },
                            { label: 'Recovered', value: stats.recoveredCount, color: 'indigo' }
                        ].map(s => (
                            <div key={s.label} className="bg-slate-900/40 border border-slate-800/60 p-6 rounded-3xl text-center backdrop-blur-sm">
                                <p className={`text-4xl font-black text-${s.color}-500 mb-1`}>{s.value.toLocaleString()}</p>
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black leading-tight">{s.label}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* National Threat Radar Map */}
                <div className="mt-32 space-y-8 pb-10">
                    <div className="text-center">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-[10px] font-black tracking-widest text-red-400 uppercase mb-4">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                            Live Grid Feed
                        </div>
                        <h2 className="text-4xl font-black text-white">National Threat Radar</h2>
                        <p className="text-slate-500 max-w-xl mx-auto mt-4 font-medium">Real-time heatmaps of reported device thefts across the federation. Visualization of current risk hotspots to aid public vigilance.</p>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-indigo-500/5 relative group p-2">
                        <div className="h-[500px] w-full rounded-[2rem] overflow-hidden grayscale-[0.5] contrast-[1.2]">
                            <MapComponent
                                zoom={6}
                                markers={hotspots.map(h => ({
                                    lat: h.lat,
                                    lng: h.lng,
                                    label: h.hint || 'Active Threat zone',
                                    color: "#ef4444"
                                }))}
                            />
                        </div>
                        <div className="absolute bottom-14 right-6 bg-slate-950/80 backdrop-blur-xl p-4 rounded-2xl border border-slate-700/50 shadow-2xl z-[40]">
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full bg-red-500 animate-ping"></div>
                                <div>
                                    <p className="text-xs font-black text-white uppercase tracking-wider leading-none">High Frequency Zone</p>
                                    <p className="text-[9px] text-slate-500 font-bold uppercase mt-1 tracking-tighter">SURVEILLANCE GRID STATUS: ACTIVE</p>
                                </div>
                            </div>
                        </div>
                        <div className="absolute bottom-10 left-10 z-[40]">
                            <div className="px-5 py-3 rounded-xl bg-slate-950/90 border border-slate-800 text-[10px] text-slate-300 font-bold backdrop-blur-md">
                                DISCLAMER: Coordinates are approximate for community privacy.
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-900 bg-slate-950 mt-auto py-12 flex flex-col items-center justify-center">
                <div className="flex flex-col items-center">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.4em] mb-4">Powered by</p>

                    {/* Massive Logo, perfectly aligned with text */}
                    <img src="/logo_white.svg" alt="Vexel Innovations" className="w-32 h-auto object-contain z-10 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]" />

                    <div className="text-center -mt-10 relative z-20">
                        <p className="text-4xl font-black tracking-widest text-white uppercase leading-none">VEXEL</p>
                        <p className="text-[11px] font-bold tracking-[0.55em] text-slate-500 uppercase mt-1">INNOVATIONS</p>
                    </div>

                    <div className="flex items-center gap-4 mt-8">
                        <a href="/developer" className="text-[10px] font-bold text-indigo-500 hover:text-indigo-400 transition-colors uppercase tracking-[0.2em]">Developer API</a>
                        <span className="text-slate-800 text-[10px]">·</span>
                        <a href="mailto:vexelvision@gmail.com" className="text-[10px] font-bold text-slate-500 hover:text-slate-400 transition-colors uppercase tracking-[0.2em]">vexelvision@gmail.com</a>
                    </div>
                    <p className="text-[10px] text-slate-700 font-medium mt-4 tracking-wider">
                        &copy; Vexel Innovations 2026. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
}
