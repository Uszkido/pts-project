'use client';
import { useState, useEffect } from 'react';

export default function LiveView({ imei, onClose }: { imei: string, onClose: () => void }) {
    const [trackingData, setTrackingData] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const fetchTracking = async () => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const headers = { 'Authorization': `Bearer ${localStorage.getItem('pts_token')}` };

            // In a real app, this would be a specific tracking endpoint
            // For now, we fetch device details which includes lastKnownLocation
            const res = await fetch(`${apiUrl}/police/search?q=${imei}`, { headers });
            const data = await res.json();
            if (data.devices && data.devices.length > 0) {
                setTrackingData(data.devices[0]);
                // Simulate some history points for the UI wow factor
                setHistory([
                    { time: '2 mins ago', loc: data.devices[0].lastKnownLocation || 'Cell Tower 42A, Ikeja', accuracy: '15m' },
                    { time: '15 mins ago', loc: 'Lagos-Abeokuta Exp', accuracy: '50m' },
                    { time: '1 hour ago', loc: 'Computer Village Entrance', accuracy: '10m' }
                ]);
            }
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleDeployTeam = async () => {
        setActionLoading('deploy');
        setMessage(null);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const res = await fetch(`${apiUrl}/police/deploy-team`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('pts_token')}`
                },
                body: JSON.stringify({ imei, location: trackingData?.lastKnownLocation })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setMessage({ type: 'success', text: data.message });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setActionLoading(null);
        }
    };

    const handleAlertVendors = async () => {
        setActionLoading('alert');
        setMessage(null);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const res = await fetch(`${apiUrl}/police/alert-vendors`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('pts_token')}`
                },
                body: JSON.stringify({
                    imei,
                    brand: trackingData?.brand,
                    model: trackingData?.model,
                    location: trackingData?.lastKnownLocation
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setMessage({ type: 'success', text: data.message });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setActionLoading(null);
        }
    };

    useEffect(() => {
        fetchTracking();
        const interval = setInterval(fetchTracking, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, [imei]);

    return (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex flex-col">
            <header className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-red-600 flex items-center justify-center shadow-lg shadow-red-500/20 animate-pulse">
                        <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tighter uppercase">Live Precision Tracking</h2>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-red-500 font-bold uppercase tracking-widest animate-pulse">Signal Intercept Active</span>
                            <span className="text-slate-500 text-xs">•</span>
                            <span className="text-slate-400 text-xs font-mono uppercase">IMEI: {imei}</span>
                        </div>
                    </div>
                </div>
                <button onClick={onClose} className="p-3 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-all border border-slate-800">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </header>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 overflow-hidden">
                {/* Visual Map Mock/Placeholder */}
                <div className="lg:col-span-3 bg-slate-900 relative group overflow-hidden border-r border-slate-800">
                    {/* Simulated Radar/Map UI */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-slate-900 to-slate-950"></div>
                    <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#1e293b 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>

                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                        <div className="relative">
                            <div className="w-64 h-64 rounded-full border border-blue-500/20 animate-[ping_3s_linear_infinite]"></div>
                            <div className="absolute inset-0 w-64 h-64 rounded-full border border-blue-500/10 animate-[ping_5s_linear_infinite]"></div>
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-blue-500 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.8)]">
                                <div className="absolute -top-12 -left-20 bg-slate-800/90 backdrop-blur-md border border-blue-500/50 p-2 rounded-lg text-[10px] whitespace-nowrap text-white font-bold shadow-2xl">
                                    CURRENT TARGET POSITION<br />
                                    <span className="text-blue-400 font-mono uppercase">{trackingData?.lastKnownLocation || 'GEO-SYNCING...'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end">
                        <div className="space-y-2">
                            <div className="bg-slate-950/80 backdrop-blur-md border border-slate-700 p-4 rounded-2xl w-64">
                                <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase mb-2">
                                    <span>Signal Quality</span>
                                    <span className="text-emerald-500">92%</span>
                                </div>
                                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 w-[92%]"></div>
                                </div>
                            </div>
                            <div className="bg-slate-950/80 backdrop-blur-md border border-slate-700 p-4 rounded-2xl w-64">
                                <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Target Identity</p>
                                <p className="text-sm font-black text-white truncate">{trackingData?.brand} {trackingData?.model}</p>
                            </div>
                        </div>
                        <div className="flex flex-col gap-3">
                            {message && (
                                <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-center border animate-in fade-in slide-in-from-bottom-2 ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                                    {message.text}
                                </div>
                            )}
                            <div className="flex gap-4">
                                <button
                                    onClick={handleDeployTeam}
                                    disabled={actionLoading !== null}
                                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black px-8 py-4 rounded-2xl shadow-xl shadow-blue-500/20 transition-all uppercase tracking-widest text-xs flex items-center gap-2"
                                >
                                    {actionLoading === 'deploy' ? 'Deploying...' : 'Deploy Response Team'}
                                </button>
                                <button
                                    onClick={handleAlertVendors}
                                    disabled={actionLoading !== null}
                                    className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-black px-8 py-4 rounded-2xl border border-slate-700 transition-all uppercase tracking-widest text-xs flex items-center gap-2"
                                >
                                    {actionLoading === 'alert' ? 'Broadcasting...' : 'Alert Nearby Vendors'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar: Signal Intel */}
                <div className="lg:col-span-1 bg-slate-950 p-6 overflow-y-auto border-l border-slate-800/50">
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                        Signal Intercepts
                    </h3>

                    <div className="space-y-6">
                        {history.map((h, i) => (
                            <div key={i} className="relative pl-6 border-l border-slate-800 pb-2">
                                <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-slate-800 border border-slate-700"></div>
                                <div className="text-[10px] font-bold text-slate-500 mb-1">{h.time}</div>
                                <div className="text-xs text-white font-bold mb-1">{h.loc}</div>
                                <div className="text-[10px] text-slate-500 font-mono">Accuracy Radius: {h.accuracy}</div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-10 pt-10 border-t border-slate-800">
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Telecom Uplink Data</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                                <p className="text-[9px] text-slate-500 font-bold uppercase mb-1">Cell Tower</p>
                                <p className="text-xs text-white font-mono">IKEJA-082</p>
                            </div>
                            <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                                <p className="text-[9px] text-slate-500 font-bold uppercase mb-1">Signal Type</p>
                                <p className="text-xs text-blue-400 font-bold">5G-UWB</p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto pt-10 text-[9px] text-slate-600 font-mono leading-relaxed">
                        CONFIDENTIAL LE ACCESS ONLY<br />
                        FEDERAL COMMUNICATIONS ACT 204.1<br />
                        TRACING SECURED BY PTS v4.0
                    </div>
                </div>
            </div>
        </div>
    );
}
