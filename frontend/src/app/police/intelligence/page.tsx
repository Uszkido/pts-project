'use client';
import { useState, useEffect } from 'react';

export default function PoliceIntelligence() {
    const [incidents, setIncidents] = useState<any[]>([]);
    const [alerts, setAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<'INCIDENTS' | 'ALERTS'>('INCIDENTS');

    useEffect(() => {
        if (!localStorage.getItem('pts_token')) {
            window.location.href = '/police/login';
            return;
        }

        const fetchIntelligence = async () => {
            setLoading(true);
            try {
                const headers = { 'Authorization': `Bearer ${localStorage.getItem('pts_token')}` };

                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
                const [incidentsRes, alertsRes] = await Promise.all([
                    fetch(`${apiUrl.replace('/api/v1', '')}/api/v1/police/incidents`, { headers }),
                    fetch(`${apiUrl.replace('/api/v1', '')}/api/v1/police/vendor-alerts`, { headers })
                ]);

                const incidentsData = await incidentsRes.json();
                const alertsData = await alertsRes.json();

                if (!incidentsRes.ok) throw new Error(incidentsData.error);
                if (!alertsRes.ok) throw new Error(alertsData.error);

                setIncidents(incidentsData.reports);
                setAlerts(alertsData.alerts);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchIntelligence();
    }, []);

    return (
        <div className="min-h-screen bg-slate-950 font-sans text-slate-200">
            <nav className="border-b border-rose-900/50 bg-slate-900/80 backdrop-blur-md px-6 py-4 flex justify-between items-center sticky top-0 z-50">
                <div className="text-white font-bold flex items-center gap-3">
                    <span className="w-9 h-9 rounded-lg bg-red-600 flex items-center justify-center shadow-lg shadow-red-500/20">PTS</span>
                    <div className="flex flex-col">
                        <span className="leading-tight">Law Enforcement</span>
                        <span className="text-[10px] text-red-400 uppercase tracking-widest font-semibold flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-400"></div> Classified Access</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <a href="/police/dashboard" className="text-sm font-semibold text-red-400 hover:text-red-300 transition-colors hidden sm:block">National Registry</a>
                    <button onClick={() => { localStorage.removeItem('pts_token'); window.location.href = '/police/login'; }} className="text-sm font-medium text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 px-4 py-2 rounded-lg transition-colors">Terminate Session</button>
                </div>
            </nav>

            <main className="max-w-6xl mx-auto p-4 sm:p-6 mt-6 sm:mt-10">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
                        <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Intelligence & Enforcement Portal</h1>
                        <p className="text-slate-400 text-sm mt-1">Live feed of consumer incident reports and vendor suspicious activity alerts.</p>
                    </div>
                </div>

                {error && <p className="mb-6 p-4 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 font-medium">{error}</p>}

                <div className="mb-6 border-b border-slate-800">
                    <ul className="flex flex-wrap -mb-px text-sm font-medium text-center">
                        <li className="mr-2">
                            <button
                                onClick={() => setActiveTab('INCIDENTS')}
                                className={`inline-block p-4 border-b-2 rounded-t-lg transition-colors ${activeTab === 'INCIDENTS' ? 'text-red-500 border-red-500' : 'border-transparent hover:text-slate-300 hover:border-slate-300 text-slate-500'}`}
                            >
                                Consumer Incident Reports ({incidents.length})
                            </button>
                        </li>
                        <li className="mr-2">
                            <button
                                onClick={() => setActiveTab('ALERTS')}
                                className={`inline-block p-4 border-b-2 rounded-t-lg transition-colors ${activeTab === 'ALERTS' ? 'text-amber-500 border-amber-500' : 'border-transparent hover:text-slate-300 hover:border-slate-300 text-slate-500'}`}
                            >
                                Vendor Suspicious Alerts ({alerts.length})
                            </button>
                        </li>
                    </ul>
                </div>

                {loading ? (
                    <div className="text-center py-10 text-slate-500">Decrypting Intelligence Data...</div>
                ) : activeTab === 'INCIDENTS' ? (
                    <div className="grid gap-6">
                        {incidents.length === 0 ? (
                            <div className="text-center py-10 text-slate-500 bg-slate-900/50 rounded-2xl border border-slate-800">No active incidents reported.</div>
                        ) : incidents.map(report => (
                            <div key={report.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg hover:border-red-900/50 transition-colors relative overflow-hidden">
                                {report.device.lastKnownLocation && (
                                    <div className="absolute top-0 right-0 p-4">
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                                            LIVE TRACKING: {report.device.lastKnownLocation}
                                        </div>
                                    </div>
                                )}
                                <div className="flex justify-between items-start mb-4 relative z-10">
                                    <div className="flex items-center gap-3">
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${report.type === 'LOST' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                                            {report.type}
                                        </span>
                                        <span className="text-xs font-mono text-slate-500">{new Date(report.createdAt).toLocaleString()}</span>
                                    </div>
                                    {/* Status chip moved to right aligned with location ping if available */}
                                </div>
                                <h3 className="text-xl font-bold text-white mb-1">{report.device.brand} {report.device.model}</h3>
                                <p className="text-sm font-mono text-slate-400 tracking-widest mb-4 flex items-center gap-2">
                                    IMEI: {report.device.imei}
                                    <span className="text-xs font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md uppercase tracking-wider">{report.status}</span>
                                </p>

                                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                                    <p className="text-sm text-slate-300"><strong className="text-slate-500">Reporter:</strong> {report.reporter.email}</p>
                                    {report.location && <p className="text-sm text-slate-300 mt-1"><strong className="text-slate-500">Known Incident Area:</strong> {report.location}</p>}
                                    {report.description && <p className="text-sm text-slate-300 mt-2 italic border-l-2 border-slate-700 pl-3">"{report.description}"</p>}

                                    {/* Evidence Render Block */}
                                    {report.evidenceUrls && report.evidenceUrls.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-slate-800/50">
                                            <p className="text-[10px] text-amber-500 uppercase tracking-widest font-bold mb-2">Attached Evidence (Classified)</p>
                                            <div className="flex flex-wrap gap-2">
                                                {report.evidenceUrls.map((url: string, i: number) => (
                                                    <a key={i} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 text-xs font-semibold py-1.5 px-3 rounded-lg border border-slate-700 transition-colors">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                                        Review Evidence File {i + 1}
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="grid gap-6">
                        {alerts.length === 0 ? (
                            <div className="text-center py-10 text-slate-500 bg-slate-900/50 rounded-2xl border border-slate-800">No suspicious vendor activity detected.</div>
                        ) : alerts.map(alert => (
                            <div key={alert.id} className="bg-slate-900 border border-amber-900/30 rounded-2xl p-6 shadow-lg hover:border-amber-900/50 transition-colors">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                            Suspicious Seller Alert
                                        </span>
                                        <span className="text-xs font-mono text-slate-500">{new Date(alert.createdAt).toLocaleString()}</span>
                                    </div>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-1">{alert.device.brand} {alert.device.model}</h3>
                                <p className="text-sm font-mono text-slate-400 tracking-widest mb-4">IMEI: {alert.device.imei}</p>

                                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                                    <p className="text-sm text-slate-300"><strong className="text-amber-500">Reporting Vendor:</strong> {alert.vendor.companyName || alert.vendor.email}</p>
                                    {alert.sellerEmail && <p className="text-sm text-slate-300 mt-1"><strong className="text-slate-500">Attempted Seller:</strong> {alert.sellerEmail}</p>}
                                    {alert.description && <p className="text-sm text-slate-300 mt-2 italic">"{alert.description}"</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
