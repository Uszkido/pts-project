'use client';
import { useState, useEffect } from 'react';

export default function PoliceIntelligence() {
    const [incidents, setIncidents] = useState<any[]>([]);
    const [alerts, setAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<'INCIDENTS' | 'ALERTS' | 'SUSPECTS'>('INCIDENTS');
    const [suspects, setSuspects] = useState<any[]>([]);

    // Suspect Creation
    const [isSuspectModalOpen, setIsSuspectModalOpen] = useState(false);
    const [newSuspect, setNewSuspect] = useState({ fullName: '', alias: '', nationalId: '', phoneNumber: '', description: '', photoUrl: '', knownAddresses: '', dangerLevel: 'UNKNOWN' });

    // Tracking Log State
    const [isTrackingOpen, setIsTrackingOpen] = useState(false);
    const [trackingImei, setTrackingImei] = useState('');
    const [trackingMethod, setTrackingMethod] = useState('GPS');
    const [trackingLocation, setTrackingLocation] = useState('');
    const [trackingAccuracy, setTrackingAccuracy] = useState('HIGH');
    const [trackingIp, setTrackingIp] = useState('');
    const [isSubmittingTracking, setIsSubmittingTracking] = useState(false);
    const [trackingLogs, setTrackingLogs] = useState<any[]>([]);
    const [showLogs, setShowLogs] = useState(false);
    const [isTriangulating, setIsTriangulating] = useState<string | null>(null);

    const fetchIntelligence = async () => {
        setLoading(true);
        try {
            const headers = { 'Authorization': `Bearer ${localStorage.getItem('pts_token')}` };

            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const [incidentsRes, alertsRes, suspectsRes] = await Promise.all([
                fetch(`${apiUrl.replace('/api/v1', '')}/api/v1/police/incidents`, { headers }),
                fetch(`${apiUrl.replace('/api/v1', '')}/api/v1/police/vendor-alerts`, { headers }),
                fetch(`${apiUrl.replace('/api/v1', '')}/api/v1/police/suspects`, { headers })
            ]);

            const incidentsData = await incidentsRes.json();
            const alertsData = await alertsRes.json();
            const suspectsData = await suspectsRes.json();

            if (!incidentsRes.ok) throw new Error(incidentsData.error);
            if (!alertsRes.ok) throw new Error(alertsData.error);
            if (!suspectsRes.ok) throw new Error(suspectsData.error);

            setIncidents(incidentsData.reports);
            setAlerts(alertsData.alerts);
            setSuspects(suspectsData.suspects || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!localStorage.getItem('pts_token')) {
            window.location.href = '/police/login';
            return;
        }

        fetchIntelligence();
    }, []);

    const shareLocationWithOwner = async (incidentId: string) => {
        if (!confirm('Are you sure you want to share real-time tracking with the device owner?')) return;
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const res = await fetch(`${apiUrl}/police/incidents/${incidentId}/share-location`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('pts_token')}` }
            });
            if (!res.ok) throw new Error('Failed to share tracking');
            alert('Tracking data is now shared with the registered owner.');
            fetchIntelligence();
        } catch (err: any) { alert(err.message); }
    };

    const submitSuspect = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const res = await fetch(`${apiUrl}/police/suspects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('pts_token')}` },
                body: JSON.stringify(newSuspect)
            });
            if (!res.ok) throw new Error('Failed to create suspect');
            setIsSuspectModalOpen(false);
            setNewSuspect({ fullName: '', alias: '', nationalId: '', phoneNumber: '', description: '', photoUrl: '', knownAddresses: '', dangerLevel: 'UNKNOWN' });
            fetchIntelligence();
        } catch (err: any) { alert(err.message); }
    };

    const submitTrackingLog = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmittingTracking(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const res = await fetch(`${apiUrl}/police/tracking-log`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('pts_token')}`
                },
                body: JSON.stringify({
                    deviceImei: trackingImei,
                    method: trackingMethod,
                    location: trackingLocation,
                    accuracy: trackingAccuracy,
                    ipAddress: trackingIp || undefined
                })
            });
            if (!res.ok) throw new Error('Failed to log tracking data');
            alert('Tracking data logged and device location updated.');
            setIsTrackingOpen(false);
            setTrackingLocation('');
            setTrackingIp('');
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsSubmittingTracking(false);
        }
    };

    const fetchTrackingLogs = async (imei: string) => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const res = await fetch(`${apiUrl}/police/tracking-logs/${imei}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('pts_token')}` }
            });
            const data = await res.json();
            setTrackingLogs(data.logs || []);
            setShowLogs(true);
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleTriangulation = async (method: string) => {
        setIsTriangulating(method);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const res = await fetch(`${apiUrl}/police/triangulate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('pts_token')}`
                },
                body: JSON.stringify({ method })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            alert(data.message);
            fetchIntelligence();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsTriangulating(null);
        }
    };

    const methodColors: Record<string, string> = {
        GPS: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        WIFI: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        IP: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
        CELLULAR: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        MANUAL: 'bg-slate-500/10 text-slate-400 border-slate-500/20'
    };

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

                {/* Tracking Method Panel */}
                <div className="mb-8 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-white">Multi-Method Device Triangulation</h3>
                                <p className="text-[10px] text-slate-500">GPS • WiFi Probe • IP Geolocation • Cellular Tower Triangulation • Manual Reports</p>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            {['GPS', 'WIFI', 'IP', 'CELLULAR'].map(m => (
                                <button
                                    key={m}
                                    onClick={() => handleTriangulation(m)}
                                    disabled={isTriangulating !== null}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black border transition-all hover:scale-105 active:scale-95 disabled:opacity-50 flex items-center gap-2 ${methodColors[m]}`}
                                >
                                    {isTriangulating === m ? (
                                        <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    ) : (
                                        <div className="w-1.5 h-1.5 rounded-full bg-current"></div>
                                    )}
                                    {m} SCAN
                                </button>
                            ))}
                        </div>
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
                        <li className="mr-2">
                            <button
                                onClick={() => setActiveTab('SUSPECTS')}
                                className={`inline-block p-4 border-b-2 rounded-t-lg transition-colors ${activeTab === 'SUSPECTS' ? 'text-purple-500 border-purple-500' : 'border-transparent hover:text-slate-300 hover:border-slate-300 text-slate-500'}`}
                            >
                                Suspect Registry ({suspects.length})
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
                                <div className="flex gap-4 items-center mb-4 relative z-10">
                                    <div className="w-16 h-16 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden flex-shrink-0 shadow-inner">
                                        {report.device.devicePhotos && report.device.devicePhotos.length > 0 ? (
                                            <img src={report.device.devicePhotos[0]} alt={report.device.model} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white mb-1">{report.device.brand} {report.device.model}</h3>
                                        <p className="text-sm font-mono text-slate-400 tracking-widest flex items-center gap-2">
                                            IMEI: {report.device.imei}
                                            <span className="text-xs font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md uppercase tracking-wider">{report.status}</span>
                                        </p>
                                    </div>
                                </div>

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
                                {/* Tracking Action Buttons */}
                                <div className="mt-4 flex flex-wrap gap-2">
                                    <button onClick={() => { setTrackingImei(report.device.imei); setIsTrackingOpen(true); }} className="flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white text-xs font-bold py-2 px-3 rounded-lg border border-emerald-500/20 transition-all">
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                                        Log Tracking Data
                                    </button>
                                    <button onClick={() => fetchTrackingLogs(report.device.imei)} className="flex items-center gap-1.5 bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-white text-xs font-bold py-2 px-3 rounded-lg border border-blue-500/20 transition-all">
                                        View Tracking History
                                    </button>
                                    {!report.locationSharedWithOwner && (
                                        <button onClick={() => shareLocationWithOwner(report.id)} className="flex items-center gap-1.5 bg-purple-500/10 hover:bg-purple-500 text-purple-400 hover:text-white text-xs font-bold py-2 px-3 rounded-lg border border-purple-500/20 transition-all ml-auto">
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                            Share Tracking With Owner
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : activeTab === 'ALERTS' ? (
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
                                <div className="flex gap-4 items-center mb-4">
                                    <div className="w-16 h-16 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden flex-shrink-0 shadow-inner">
                                        {alert.device.devicePhotos && alert.device.devicePhotos.length > 0 ? (
                                            <img src={alert.device.devicePhotos[0]} alt={alert.device.model} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white mb-1">{alert.device.brand} {alert.device.model}</h3>
                                        <p className="text-sm font-mono text-slate-400 tracking-widest">IMEI: {alert.device.imei}</p>
                                    </div>
                                </div>

                                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                                    <p className="text-sm text-slate-300"><strong className="text-amber-500">Reporting Vendor:</strong> {alert.vendor.companyName || alert.vendor.email}</p>
                                    {alert.sellerEmail && <p className="text-sm text-slate-300 mt-1"><strong className="text-slate-500">Attempted Seller:</strong> {alert.sellerEmail}</p>}
                                    {alert.description && <p className="text-sm text-slate-300 mt-2 italic">"{alert.description}"</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : activeTab === 'SUSPECTS' ? (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white">Known Suspects Database</h2>
                            <button onClick={() => setIsSuspectModalOpen(true)} className="bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                Log New Suspect
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {suspects.length === 0 ? (
                                <div className="col-span-full text-center py-10 text-slate-500 bg-slate-900/50 rounded-2xl border border-slate-800">No suspects currently logged.</div>
                            ) : suspects.map(suspect => (
                                <div key={suspect.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg hover:border-purple-900/50 transition-colors">
                                    <div className="flex items-start gap-4 mb-4">
                                        <div className="w-16 h-16 rounded-xl bg-slate-800 overflow-hidden flex-shrink-0 border border-slate-700 relative">
                                            {suspect.photoUrl ? (
                                                <img src={suspect.photoUrl} alt="Suspect" className="w-full h-full object-cover" />
                                            ) : (
                                                <svg className="w-8 h-8 text-slate-600 m-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-white leading-tight">{suspect.fullName}</h3>
                                            {suspect.alias && <p className="text-xs font-mono text-purple-400 mt-0.5">AKA: "{suspect.alias}"</p>}
                                            <span className={`inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${suspect.dangerLevel === 'HIGH' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : suspect.dangerLevel === 'MEDIUM' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-slate-800 text-slate-400'}`}>{suspect.dangerLevel} THREAT</span>
                                        </div>
                                    </div>
                                    <div className="space-y-2 text-sm text-slate-300">
                                        {suspect.nationalId && <p><span className="text-slate-500 text-xs uppercase block">NIN</span><span className="font-mono">{suspect.nationalId}</span></p>}
                                        {suspect.phoneNumber && <p><span className="text-slate-500 text-xs uppercase block">Phone</span><span className="font-mono">{suspect.phoneNumber}</span></p>}
                                        {suspect.knownAddresses && <p><span className="text-slate-500 text-xs uppercase block">Known Areas</span>{suspect.knownAddresses}</p>}
                                        {suspect.description && <p><span className="text-slate-500 text-xs uppercase block">Description</span>{suspect.description}</p>}
                                    </div>
                                    {suspect.incidents && suspect.incidents.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-400">
                                            Linked to <strong className="text-white">{suspect.incidents.length}</strong> reported incidents
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null
                }
            </main >

            {/* Suspect Creation Modal */}
            {isSuspectModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-red-500"></div>
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white">Log New Suspect</h2>
                            <button onClick={() => setIsSuspectModalOpen(false)} className="text-slate-500 hover:text-white text-xl">✕</button>
                        </div>
                        <form onSubmit={submitSuspect} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Full Name *</label>
                                    <input type="text" value={newSuspect.fullName} onChange={e => setNewSuspect({ ...newSuspect, fullName: e.target.value })} required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Alias / Nickname</label>
                                    <input type="text" value={newSuspect.alias} onChange={e => setNewSuspect({ ...newSuspect, alias: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">National ID (NIN)</label>
                                    <input type="text" value={newSuspect.nationalId} onChange={e => setNewSuspect({ ...newSuspect, nationalId: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Phone Number</label>
                                    <input type="text" value={newSuspect.phoneNumber} onChange={e => setNewSuspect({ ...newSuspect, phoneNumber: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500" />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Photo URL (Surveillance / Mugshot)</label>
                                    <input type="url" value={newSuspect.photoUrl} onChange={e => setNewSuspect({ ...newSuspect, photoUrl: e.target.value })} placeholder="https://..." className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500" />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Known Addresses & Hangouts</label>
                                    <input type="text" value={newSuspect.knownAddresses} onChange={e => setNewSuspect({ ...newSuspect, knownAddresses: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500" />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Physical Description</label>
                                    <textarea value={newSuspect.description} onChange={e => setNewSuspect({ ...newSuspect, description: e.target.value })} rows={3} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500" />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Danger Level Assessment</label>
                                    <select value={newSuspect.dangerLevel} onChange={e => setNewSuspect({ ...newSuspect, dangerLevel: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500">
                                        <option value="UNKNOWN">Unknown Threat</option>
                                        <option value="LOW">Low Threat</option>
                                        <option value="MEDIUM">Medium Threat (Armed/Dangerous)</option>
                                        <option value="HIGH">High Threat (Syndicate Leader)</option>
                                    </select>
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition-all mt-4">Save Suspect Record</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Log Tracking Data Modal */}
            {isTrackingOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-blue-500"></div>
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold text-white">Log Tracking Signal</h2>
                                <p className="text-xs text-slate-400 font-mono">Device IMEI: {trackingImei}</p>
                            </div>
                            <button onClick={() => setIsTrackingOpen(false)} className="text-slate-400 hover:text-white p-2">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <form onSubmit={submitTrackingLog} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Detection Method</label>
                                    <select value={trackingMethod} onChange={e => setTrackingMethod(e.target.value)} className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500">
                                        <option value="GPS">📡 GPS Satellite</option>
                                        <option value="WIFI">📶 WiFi Probe Request</option>
                                        <option value="IP">🌐 IP Geolocation</option>
                                        <option value="CELLULAR">📱 Cellular Triangulation</option>
                                        <option value="MANUAL">✍️ Manual Report</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Signal Accuracy</label>
                                    <select value={trackingAccuracy} onChange={e => setTrackingAccuracy(e.target.value)} className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500">
                                        <option value="HIGH">High (within 10m)</option>
                                        <option value="MEDIUM">Medium (within 100m)</option>
                                        <option value="LOW">Low (within 1km)</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Detected Location</label>
                                <input type="text" value={trackingLocation} onChange={e => setTrackingLocation(e.target.value)} placeholder="e.g., Lat: 6.5244, Lng: 3.3792 or Address" required className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500" />
                            </div>
                            {(trackingMethod === 'IP' || trackingMethod === 'WIFI') && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">IP Address (if available)</label>
                                    <input type="text" value={trackingIp} onChange={e => setTrackingIp(e.target.value)} placeholder="e.g., 102.89.23.45" className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white font-mono focus:outline-none focus:border-emerald-500" />
                                </div>
                            )}
                            <button type="submit" disabled={isSubmittingTracking} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                                {isSubmittingTracking ? 'Logging Signal...' : 'Confirm & Update Device Location'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Tracking History Modal */}
            {showLogs && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-500"></div>
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white">Tracking Signal History</h2>
                            <button onClick={() => { setShowLogs(false); setTrackingLogs([]); }} className="text-slate-400 hover:text-white p-2">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-6 max-h-[60vh] overflow-y-auto">
                            {trackingLogs.length === 0 ? (
                                <p className="text-center text-slate-500 py-8">No tracking signals logged for this device yet.</p>
                            ) : (
                                <div className="space-y-3">
                                    {trackingLogs.map((log: any) => (
                                        <div key={log.id} className="flex items-start gap-3 p-3 bg-slate-950/50 border border-slate-800 rounded-xl">
                                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold border mt-1 ${methodColors[log.method] || 'bg-slate-800 text-slate-400'}`}>{log.method}</span>
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-white">{log.location}</p>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className="text-[10px] text-slate-500 font-mono">{new Date(log.createdAt).toLocaleString()}</span>
                                                    {log.accuracy && <span className="text-[10px] text-slate-500">Accuracy: {log.accuracy}</span>}
                                                    {log.ipAddress && <span className="text-[10px] text-cyan-400 font-mono">IP: {log.ipAddress}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
