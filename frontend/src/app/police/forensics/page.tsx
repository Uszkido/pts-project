'use client';
import { useState, useEffect } from 'react';

export default function ForensicPortal() {
    const [imei, setImei] = useState('');
    const [deviceData, setDeviceData] = useState<any>(null);
    const [passport, setPassport] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!localStorage.getItem('pts_token')) {
            window.location.href = '/police/login';
            return;
        }
    }, []);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (imei.length < 15) return;
        setLoading(true);
        setError('');
        setDeviceData(null);
        try {
            const res = await fetch(`http://localhost:5000/api/v1/passports/${imei}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('pts_token')}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setDeviceData(data.device);
            setPassport(data.passport);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 font-sans text-slate-200">
            <nav className="border-b border-rose-900/50 bg-slate-900/80 backdrop-blur-md px-6 py-4 flex justify-between items-center sticky top-0 z-50">
                <div className="text-white font-bold flex items-center gap-3">
                    <span className="w-9 h-9 rounded-lg bg-red-600 flex items-center justify-center shadow-lg shadow-red-500/20">PTS</span>
                    <div className="flex flex-col">
                        <span className="leading-tight">Forensic Division</span>
                        <span className="text-[10px] text-red-400 uppercase tracking-widest font-semibold flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-400"></div> Classified Access</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <a href="/police/dashboard" className="text-sm font-semibold text-red-400 hover:text-red-300 transition-colors">National Registry</a>
                    <a href="/police/intelligence" className="text-sm font-semibold text-red-400 hover:text-red-300 transition-colors">Intelligence Portal</a>
                </div>
            </nav>

            <main className="max-w-6xl mx-auto p-4 sm:p-6 mt-6 sm:mt-10">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
                        <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Chain-of-Custody Forensics</h1>
                        <p className="text-slate-400 text-sm mt-1">Trace an IMEI's complete lifecycle and ownership evolution.</p>
                    </div>
                </div>

                <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl mb-10 shadow-xl">
                    <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                value={imei}
                                onChange={e => setImei(e.target.value.replace(/\D/g, '').slice(0, 15))}
                                placeholder="Enter 15-Digit IMEI to trace..."
                                className="w-full bg-slate-950/80 border border-slate-700/50 hover:border-red-900/40 rounded-xl px-4 py-4 text-white text-lg font-mono tracking-widest focus:outline-none focus:border-red-600 transition-all placeholder:text-slate-700"
                            />
                        </div>
                        <button type="submit" disabled={imei.length < 15 || loading} className="bg-red-600 hover:bg-red-500 text-white font-bold py-4 px-10 rounded-xl transition-all shadow-lg shadow-red-500/20 disabled:opacity-50 min-w-[200px]">
                            {loading ? 'Decrypting...' : 'Initiate Trace'}
                        </button>
                    </form>
                    {error && <p className="mt-4 text-red-400 font-medium px-2 flex items-center gap-2"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg> {error}</p>}
                </div>

                {deviceData && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Device Info Panel */}
                        <div className="lg:col-span-1 space-y-6">
                            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl">
                                <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-6">Subject Identification</h3>
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-sm text-slate-500">Device Class</p>
                                        <p className="text-xl font-bold text-white">{deviceData.brand} {deviceData.model}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500">Tracking IMEI</p>
                                        <p className="text-lg font-mono text-white tracking-widest">{deviceData.imei}</p>
                                    </div>
                                    <div className="pt-4 border-t border-slate-800">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-slate-500">Registry Status</span>
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${deviceData.status === 'CLEAN' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                    deviceData.status === 'STOLEN' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                                }`}>
                                                {deviceData.status}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center mt-3">
                                            <span className="text-sm text-slate-500">Risk Score</span>
                                            <span className="text-lg font-bold text-white tracking-tighter tabular-nums">{deviceData.riskScore}/100</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl">
                                <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-6">Last Known Custodian</h3>
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-sm text-slate-500">Entity Name</p>
                                        <p className="text-lg font-bold text-white">{deviceData.currentOwner.companyName || 'Private Individual'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500">Digital Identity</p>
                                        <p className="text-sm text-slate-400">{deviceData.currentOwner.email}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Timeline Panel */}
                        <div className="lg:col-span-2">
                            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl h-full">
                                <div className="flex justify-between items-center mb-10">
                                    <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest">Ownership Chain Evolution</h3>
                                    <span className="text-[10px] text-slate-600 font-mono italic">Audit Log: TS-LE-VERIFIED</span>
                                </div>

                                <div className="relative pl-10 border-l-2 border-slate-800 space-y-12 pb-10">
                                    {passport.map((entry) => (
                                        <div key={entry.id} className="relative">
                                            <div className={`absolute -left-[51px] top-0 w-8 h-8 rounded-full border-4 border-slate-900 flex items-center justify-center shadow-lg ${entry.type === 'REGISTRATION' ? 'bg-emerald-600' :
                                                    entry.type === 'TRANSFER' ? 'bg-blue-600' :
                                                        entry.type === 'STATUS_CHANGE' ? 'bg-amber-600' :
                                                            entry.type === 'SALE' ? 'bg-purple-600' : 'bg-slate-600'
                                                }`}>
                                                {entry.type === 'REGISTRATION' && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>}
                                                {entry.type === 'TRANSFER' && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>}
                                                {entry.type === 'STATUS_CHANGE' && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                                            </div>

                                            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 mb-2">
                                                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-tighter">{new Date(entry.createdAt).toLocaleString()}</span>
                                                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">ROLE: {entry.actor?.role}</span>
                                            </div>

                                            <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800/80 hover:border-red-900/20 transition-colors">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-xs font-black text-rose-500 tracking-tightest uppercase">{entry.type}</span>
                                                    <span className="text-xs text-slate-500">•</span>
                                                    <span className="text-xs text-slate-400 font-bold">{entry.actor?.companyName || entry.actor?.email}</span>
                                                </div>
                                                <p className="text-slate-200 text-sm leading-relaxed">{entry.description}</p>
                                                {entry.metadata && (
                                                    <div className="mt-3 overflow-x-auto">
                                                        <code className="text-[10px] text-slate-600 bg-black/40 px-2 py-1 rounded">METADATA_EXTRACT: {entry.metadata}</code>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
