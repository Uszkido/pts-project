'use client';
import { useState, useEffect } from 'react';

export default function PoliceDashboard() {
    const [devices, setDevices] = useState<any[]>([]);
    const [reports, setReports] = useState<any[]>([]);
    const [alerts, setAlerts] = useState<any[]>([]);
    const [metrics, setMetrics] = useState<any>(null);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState(''); // '' means all, 'STOLEN', etc.
    const [loading, setLoading] = useState(true);

    // Search
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSearch, setShowSearch] = useState(false);

    // Suspects
    const [suspects, setSuspects] = useState<any[]>([]);
    const [isAddSuspectOpen, setIsAddSuspectOpen] = useState(false);
    const [suspectForm, setSuspectForm] = useState({ fullName: '', alias: '', nationalId: '', phoneNumber: '', description: '', knownAddresses: '', dangerLevel: 'UNKNOWN' });
    const [isSubmittingSuspect, setIsSubmittingSuspect] = useState(false);

    // UI Tabs
    const [activeTab, setActiveTab] = useState<'registry' | 'incidents' | 'alerts' | 'suspects' | 'messages'>('registry');

    // Messages
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState({ subject: '', body: '' });

    const fetchData = async () => {
        setLoading(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const headers = { 'Authorization': `Bearer ${localStorage.getItem('pts_token')}` };

            // Fetch metrics
            const metricsRes = await fetch(`${apiUrl}/police/dashboard-metrics`, { headers });
            if (!metricsRes.ok) throw new Error('Failed to fetch metrics');
            const metricsData = await metricsRes.json();
            setMetrics(metricsData.metrics);

            // Fetch devices
            const devicesUrl = filter ? `${apiUrl}/police/devices?status=${filter}` : `${apiUrl}/police/devices`;
            const devicesRes = await fetch(devicesUrl, { headers });
            const devicesData = await devicesRes.json();
            setDevices(devicesData.devices || []);

            // Fetch incidents, alerts, messages simultaneously
            const [incidentsRes, alertsRes, messagesRes] = await Promise.all([
                fetch(`${apiUrl}/police/incidents`, { headers }),
                fetch(`${apiUrl}/police/vendor-alerts`, { headers }),
                fetch(`${apiUrl}/police/messages`, { headers })
            ]);

            const incidentsData = await incidentsRes.json();
            const alertsData = await alertsRes.json();
            const messagesData = await messagesRes.json();

            setReports(incidentsData.reports || []);
            setAlerts(alertsData.alerts || []);
            setMessages(messagesData.messages || []);

            // Fetch suspects
            const suspectsRes = await fetch(`${apiUrl}/police/suspects`, { headers });
            const suspectsData = await suspectsRes.json();
            setSuspects(suspectsData.suspects || []);

        } catch (err: any) {
            setError(err.message);
            if (err.message.includes('401') || err.message.includes('403')) {
                window.location.href = '/police/login';
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        if (searchQuery.length < 2) return;
        setIsSearching(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const res = await fetch(`${apiUrl}/police/search?q=${encodeURIComponent(searchQuery)}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('pts_token')}` }
            });
            const data = await res.json();
            setSearchResults(data.devices || []);
            setShowSearch(true);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsSearching(false);
        }
    };

    const shareLocation = async (incidentId: string) => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const res = await fetch(`${apiUrl}/police/incidents/${incidentId}/share-location`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('pts_token')}` }
            });
            if (!res.ok) throw new Error('Failed to share location');
            alert('Device location is now visible to the victim.');
            fetchData();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const createSuspect = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmittingSuspect(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const res = await fetch(`${apiUrl}/police/suspects`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('pts_token')}`
                },
                body: JSON.stringify(suspectForm)
            });
            if (!res.ok) throw new Error('Failed to create suspect record');
            alert('Suspect record created.');
            setIsAddSuspectOpen(false);
            setSuspectForm({ fullName: '', alias: '', nationalId: '', phoneNumber: '', description: '', knownAddresses: '', dangerLevel: 'UNKNOWN' });
            fetchData();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsSubmittingSuspect(false);
        }
    };

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const res = await fetch(`${apiUrl}/police/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('pts_token')}`
                },
                body: JSON.stringify({ ...newMessage, receiverRole: 'ADMIN' })
            });
            if (!res.ok) throw new Error('Failed to send message');
            setNewMessage({ subject: '', body: '' });
            fetchData();
            alert('Intelligence dispatched to System Administrator.');
        } catch (err: any) { alert(err.message); }
    };

    useEffect(() => {
        if (!localStorage.getItem('pts_token')) {
            window.location.href = '/police/login';
            return;
        }
        fetchData();
    }, [filter]);

    const updateStatus = async (imei: string, newStatus: string) => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const res = await fetch(`${apiUrl}/police/devices/${imei}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('pts_token')}`
                },
                body: JSON.stringify({ status: newStatus })
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error);
            }
            fetchData(); // refresh
        } catch (err: any) {
            alert(err.message);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 font-sans text-slate-200 selection:bg-red-500/30">
            <nav className="border-b border-rose-900/50 bg-slate-900/80 backdrop-blur-md px-6 py-4 flex justify-between items-center sticky top-0 z-50">
                <div className="text-white font-bold flex items-center gap-3">
                    <span className="w-9 h-9 rounded-lg bg-red-600 flex items-center justify-center shadow-lg shadow-red-500/20">PTS</span>
                    <div className="flex flex-col">
                        <span className="leading-tight">Law Enforcement</span>
                        <span className="text-[10px] text-red-400 uppercase tracking-widest font-semibold flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-400"></div> Classified Access</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <a href="/police/intelligence" className="text-sm font-semibold text-red-400 hover:text-red-300 transition-colors hidden sm:block">Intelligence Portal</a>
                    <button onClick={() => { localStorage.removeItem('pts_token'); window.location.href = '/police/login'; }} className="text-sm font-medium text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 px-4 py-2 rounded-lg transition-colors border border-slate-700">Terminate Session</button>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto p-4 sm:p-6 mt-6 sm:mt-10">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-white tracking-tight">Command Center</h1>
                        <p className="text-slate-400 text-sm mt-1">National Device Registry and Threat Monitoring</p>
                    </div>
                </div>

                {error && <p className="mb-6 p-4 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 font-medium">{error}</p>}

                {/* Device Search Bar */}
                <div className="mb-8 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
                    <div className="flex gap-3">
                        <div className="relative flex-1">
                            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                placeholder="Search devices by IMEI, brand, model, owner email..."
                                className="w-full bg-slate-950/80 border border-slate-700/50 rounded-xl pl-12 pr-4 py-3.5 text-white focus:outline-none focus:border-red-600 transition-all placeholder:text-slate-600"
                            />
                        </div>
                        <button onClick={handleSearch} disabled={isSearching || searchQuery.length < 2} className="bg-red-600 hover:bg-red-500 text-white font-bold px-8 rounded-xl transition-all disabled:opacity-50 flex items-center gap-2">
                            {isSearching ? 'Scanning...' : 'Search'}
                        </button>
                    </div>

                    {/* Search Results Dropdown */}
                    {showSearch && (
                        <div className="mt-4 border-t border-slate-800 pt-4">
                            <div className="flex justify-between items-center mb-3">
                                <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Search Results ({searchResults.length})</p>
                                <button onClick={() => { setShowSearch(false); setSearchResults([]); setSearchQuery(''); }} className="text-xs text-slate-500 hover:text-white">Clear</button>
                            </div>
                            {searchResults.length === 0 ? (
                                <p className="text-sm text-slate-500 py-4 text-center">No devices found matching "{searchQuery}"</p>
                            ) : (
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {searchResults.map((device: any) => (
                                        <a key={device.id} href={`/police/forensics`} className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/50 border border-slate-800 hover:border-red-900/50 transition-colors group">
                                            <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 overflow-hidden flex-shrink-0">
                                                {device.devicePhotoUrl ? (
                                                    <img src={device.devicePhotoUrl} alt={device.model} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-slate-700">
                                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-white group-hover:text-red-400 transition-colors truncate">{device.brand} {device.model}</p>
                                                <p className="text-xs font-mono text-slate-500 tracking-widest truncate">{device.imei}</p>
                                            </div>
                                            <div className="text-right">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${device.status === 'CLEAN' ? 'bg-emerald-500/10 text-emerald-400' : device.status === 'STOLEN' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>{device.status}</span>
                                                <p className="text-xs text-slate-500 mt-1">{device.registeredOwner?.email}</p>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Top Metrics Row */}
                {metrics && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors"></div>
                            <h3 className="text-slate-400 font-semibold text-sm mb-1 uppercase tracking-wider">Total Devices</h3>
                            <div className="text-3xl font-black text-white">{metrics.totalDevices}</div>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors"></div>
                            <h3 className="text-slate-400 font-semibold text-sm mb-1 uppercase tracking-wider">Clean / Verified</h3>
                            <div className="text-3xl font-black text-emerald-500">{metrics.cleanDevices}</div>
                        </div>
                        <div className="bg-slate-900 border border-red-900/30 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl group-hover:bg-red-500/20 transition-colors"></div>
                            <h3 className="text-slate-400 font-semibold text-sm mb-1 uppercase tracking-wider">Stolen Assets</h3>
                            <div className="text-3xl font-black text-red-500">{metrics.stolenDevices}</div>
                            {metrics.stolenDevices > 0 && <span className="absolute bottom-5 right-5 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span>}
                        </div>
                        <div className="bg-slate-900 border border-amber-900/30 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-colors"></div>
                            <h3 className="text-slate-400 font-semibold text-sm mb-1 uppercase tracking-wider">Active Investigations</h3>
                            <div className="text-3xl font-black text-amber-500">{metrics.investigatingDevices}</div>
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex border-b border-slate-800 mb-6 bg-slate-900/50 p-2 rounded-xl inline-flex">
                    <button onClick={() => setActiveTab('registry')} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'registry' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                        Global Registry
                    </button>
                    <button onClick={() => setActiveTab('incidents')} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'incidents' ? 'bg-slate-800 text-red-400 shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        Incident Reports {metrics?.openIncidents > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">{metrics.openIncidents}</span>}
                    </button>
                    <button onClick={() => setActiveTab('alerts')} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'alerts' ? 'bg-slate-800 text-amber-400 shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                        Vendor Alerts {metrics?.openAlerts > 0 && <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">{metrics.openAlerts}</span>}
                    </button>
                    <button onClick={() => setActiveTab('suspects')} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'suspects' ? 'bg-slate-800 text-purple-400 shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        Suspect Registry ({suspects.length})
                    </button>
                    <button onClick={() => setActiveTab('messages')} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'messages' ? 'bg-slate-800 text-blue-400 shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                        Admin Comms
                    </button>
                </div>

                {/* Tab Contents */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in duration-300 min-h-[400px]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center p-20 text-slate-500">
                            <div className="w-12 h-12 border-4 border-red-500/20 border-t-red-500 rounded-full animate-spin mb-4"></div>
                            Decrypting secure channel...
                        </div>
                    ) : activeTab === 'registry' ? (
                        <>
                            <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-end">
                                <select value={filter} onChange={(e) => setFilter(e.target.value)} className="bg-slate-950 border border-slate-700 text-white text-sm rounded-lg focus:ring-red-500 focus:border-red-500 block p-2 outline-none shadow-inner">
                                    <option value="">Filter: All Statuses</option>
                                    <option value="CLEAN">CLEAN</option>
                                    <option value="STOLEN">STOLEN</option>
                                    <option value="LOST">LOST</option>
                                    <option value="INVESTIGATING">INVESTIGATING</option>
                                </select>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left text-slate-400">
                                    <thead className="text-xs text-slate-300 uppercase bg-slate-950/50 border-b border-slate-800">
                                        <tr>
                                            <th className="px-6 py-4 font-semibold tracking-wider">IMEI Serial</th>
                                            <th className="px-6 py-4 font-semibold tracking-wider">Device Hardware</th>
                                            <th className="px-6 py-4 font-semibold tracking-wider">Registered Entity</th>
                                            <th className="px-6 py-4 font-semibold tracking-wider">National Status</th>
                                            <th className="px-6 py-4 font-semibold tracking-wider text-right">Overrides</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {devices.length === 0 ? (
                                            <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No registry entries found.</td></tr>
                                        ) : devices.map((device: any) => (
                                            <tr key={device.id} className="hover:bg-slate-800/30 transition-colors">
                                                <td className="px-6 py-4 font-mono font-bold text-white tracking-widest">{device.imei}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 overflow-hidden flex-shrink-0">
                                                            {device.devicePhotoUrl ? (
                                                                <img src={device.devicePhotoUrl} alt={device.model} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-slate-700">
                                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-white">{device.brand} {device.model}</div>
                                                            <div className="text-xs text-slate-500 mt-0.5">SN: {device.serialNumber || 'N/A'}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-white font-medium">{device.registeredOwner.companyName || 'Private Citizen'}</div>
                                                    <div className="text-xs text-slate-500">{device.registeredOwner.email}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${device.status === 'CLEAN' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                        device.status === 'INVESTIGATING' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30' :
                                                            'bg-red-500/10 text-red-500 border border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                                                        }`}>
                                                        {device.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right space-x-3">
                                                    {device.status !== 'INVESTIGATING' && (
                                                        <button onClick={() => updateStatus(device.imei, 'INVESTIGATING')} className="text-xs font-bold text-amber-500 hover:text-amber-400 transition-colors uppercase tracking-wide">Investigate</button>
                                                    )}
                                                    {device.status !== 'CLEAN' && (
                                                        <button onClick={() => updateStatus(device.imei, 'CLEAN')} className="text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-wide">Clear</button>
                                                    )}
                                                    {device.status !== 'STOLEN' && (
                                                        <button onClick={() => updateStatus(device.imei, 'STOLEN')} className="text-xs font-bold text-red-500 hover:text-red-400 transition-colors uppercase tracking-wide">Mark Stolen</button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    ) : activeTab === 'incidents' ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-slate-400">
                                <thead className="text-xs text-slate-300 uppercase bg-slate-950/50 border-b border-slate-800">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold tracking-wider">Report Date</th>
                                        <th className="px-6 py-4 font-semibold tracking-wider">Reported By</th>
                                        <th className="px-6 py-4 font-semibold tracking-wider">Device Details</th>
                                        <th className="px-6 py-4 font-semibold tracking-wider">Narrative</th>
                                        <th className="px-6 py-4 font-semibold tracking-wider">Status</th>
                                        <th className="px-6 py-4 font-semibold tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {reports.length === 0 ? (
                                        <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No active incident reports.</td></tr>
                                    ) : reports.map((report: any) => (
                                        <tr key={report.id} className="hover:bg-slate-800/30 transition-colors border-l-2 border-l-transparent hover:border-l-red-500">
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-300">{new Date(report.createdAt).toLocaleString()}</td>
                                            <td className="px-6 py-4 font-medium text-white">{report.reporter.email}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 overflow-hidden flex-shrink-0 shadow-inner">
                                                        {report.device.devicePhotoUrl ? (
                                                            <img src={report.device.devicePhotoUrl} alt={report.device.model} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-slate-700">
                                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-white">{report.device.brand} {report.device.model}</div>
                                                        <div className="text-xs text-slate-500 font-mono mt-1">{report.device.imei}</div>
                                                    </div>
                                                </div>
                                                {report.device.lastKnownLocation && (
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                                                        <span className="text-[10px] text-emerald-400 font-bold">TRACKED: {report.device.lastKnownLocation}</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 max-w-sm">
                                                <p className="text-sm text-slate-300 line-clamp-2">{report.description}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${report.status === 'OPEN' ? 'bg-red-500/10 text-red-500 border border-red-500/30' : 'bg-slate-800 text-slate-400'}`}>
                                                    {report.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {!report.locationSharedWithOwner ? (
                                                    <button onClick={() => shareLocation(report.id)} className="text-[10px] font-bold text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg border border-blue-500/20 transition-colors uppercase tracking-wide">
                                                        Share Location
                                                    </button>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 uppercase tracking-wide">Shared ✓</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : activeTab === 'alerts' ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-slate-400">
                                <thead className="text-xs text-slate-300 uppercase bg-slate-950/50 border-b border-slate-800">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold tracking-wider">Alert Date</th>
                                        <th className="px-6 py-4 font-semibold tracking-wider">Reporting Vendor</th>
                                        <th className="px-6 py-4 font-semibold tracking-wider">Scanned Device</th>
                                        <th className="px-6 py-4 font-semibold tracking-wider">Vendor Note</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {alerts.length === 0 ? (
                                        <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">No suspicious vendor alerts.</td></tr>
                                    ) : alerts.map((alert: any) => (
                                        <tr key={alert.id} className="hover:bg-slate-800/30 transition-colors border-l-2 border-l-transparent hover:border-l-amber-500">
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-300">{new Date(alert.createdAt).toLocaleString()}</td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-white">{alert.vendor.companyName}</div>
                                                <div className="text-xs text-slate-500">{alert.vendor.email}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 overflow-hidden flex-shrink-0">
                                                        {alert.device.devicePhotoUrl ? (
                                                            <img src={alert.device.devicePhotoUrl} alt={alert.device.model} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-slate-700">
                                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-white">{alert.device.brand} {alert.device.model}</div>
                                                        <div className="text-xs text-slate-500 font-mono mt-1">{alert.device.imei}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 max-w-sm">
                                                <p className="text-sm text-slate-300 line-clamp-2">{alert.notes || 'No additional notes provided.'}</p>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : activeTab === 'suspects' ? (
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-white">Known Suspects & Thieves</h3>
                                <button onClick={() => setIsAddSuspectOpen(true)} className="bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                    Add Suspect
                                </button>
                            </div>
                            {suspects.length === 0 ? (
                                <div className="text-center py-10 text-slate-500">No suspects recorded yet.</div>
                            ) : (
                                <div className="grid gap-4">
                                    {suspects.map((s: any) => (
                                        <div key={s.id} className="bg-slate-950/50 border border-slate-800 rounded-2xl p-5 hover:border-purple-900/50 transition-colors">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className="text-lg font-bold text-white">{s.fullName || 'Unknown'}</h4>
                                                    {s.alias && <p className="text-sm text-purple-400">a.k.a "{s.alias}"</p>}
                                                </div>
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${s.dangerLevel === 'EXTREME' ? 'bg-red-500/20 text-red-500 border border-red-500/30' :
                                                    s.dangerLevel === 'HIGH' ? 'bg-orange-500/20 text-orange-500 border border-orange-500/30' :
                                                        s.dangerLevel === 'MEDIUM' ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' :
                                                            s.dangerLevel === 'LOW' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                                                'bg-slate-800 text-slate-400 border border-slate-700'
                                                    }`}>{s.dangerLevel}</span>
                                            </div>
                                            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                                {s.nationalId && <div><span className="text-slate-500 text-xs">NIN:</span> <span className="text-slate-300 font-mono">{s.nationalId}</span></div>}
                                                {s.phoneNumber && <div><span className="text-slate-500 text-xs">Phone:</span> <span className="text-slate-300">{s.phoneNumber}</span></div>}
                                                {s.knownAddresses && <div className="col-span-2"><span className="text-slate-500 text-xs">Known Area:</span> <span className="text-slate-300">{s.knownAddresses}</span></div>}
                                            </div>
                                            {s.description && <p className="mt-2 text-sm text-slate-400 italic border-l-2 border-purple-500/30 pl-3">{s.description}</p>}
                                            {s.incidents && s.incidents.length > 0 && (
                                                <div className="mt-3 pt-3 border-t border-slate-800">
                                                    <p className="text-[10px] text-red-400 uppercase tracking-widest font-bold mb-1">Linked Incidents ({s.incidents.length})</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {s.incidents.map((inc: any) => (
                                                            <span key={inc.id} className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded-md">{inc.device?.brand} {inc.device?.model} — {inc.device?.imei}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : activeTab === 'messages' ? (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
                            <div className="lg:col-span-1 bg-slate-950/50 border border-slate-800 rounded-2xl p-6 shadow-md h-fit">
                                <h3 className="text-lg font-bold text-white mb-4">Secure Comms to Admin</h3>
                                <form onSubmit={sendMessage} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 mb-1">Subject Clearance *</label>
                                        <input type="text" value={newMessage.subject} onChange={e => setNewMessage({ ...newMessage, subject: e.target.value })} required className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500" placeholder="e.g. Clearance request for IMEI..." />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 mb-1">Intelligence Body *</label>
                                        <textarea value={newMessage.body} onChange={e => setNewMessage({ ...newMessage, body: e.target.value })} required rows={4} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500" placeholder="Type message to System Administrator..." />
                                    </div>
                                    <button type="submit" className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-red-500/20">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg> Transmit
                                    </button>
                                </form>
                            </div>
                            <div className="lg:col-span-2 bg-slate-950/50 border border-slate-800 rounded-2xl p-6 shadow-md min-h-[500px]">
                                <h3 className="text-lg font-bold text-white mb-6">Classified Communications Thread</h3>
                                <div className="space-y-4">
                                    {messages.map(msg => (
                                        <div key={msg.id} className={`p-4 rounded-xl border ${msg.sender?.role === 'POLICE' ? 'bg-red-500/5 border-red-500/20 ml-12' : 'bg-slate-800 border-slate-700 mr-12'}`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${msg.sender?.role === 'POLICE' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-500'}`}>{msg.sender?.role}</span>
                                                    <span className="text-sm font-bold text-white">{msg.sender?.fullName || msg.sender?.email}</span>
                                                </div>
                                                <span className="text-xs text-slate-500 font-medium">{new Date(msg.createdAt).toLocaleString()}</span>
                                            </div>
                                            <p className="text-sm font-bold text-slate-300 mb-1">{msg.subject}</p>
                                            <p className="text-sm text-slate-400 whitespace-pre-wrap">{msg.body}</p>
                                        </div>
                                    ))}
                                    {messages.length === 0 && <div className="text-center py-20 text-slate-500 font-mono text-sm max-w-sm mx-auto">&gt; NO ENCRYPTED MESSAGES IN THREAD.<br />&gt; AWAITING TRANSMISSION...</div>}
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>
            </main>

            {/* Add Suspect Modal */}
            {isAddSuspectOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500"></div>
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-500 flex items-center justify-center border border-purple-500/30">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">Register Suspect</h2>
                                    <p className="text-xs text-slate-400">Add to National Suspect Database</p>
                                </div>
                            </div>
                            <button onClick={() => setIsAddSuspectOpen(false)} className="text-slate-400 hover:text-white p-2">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <form onSubmit={createSuspect} className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name</label>
                                    <input type="text" value={suspectForm.fullName} onChange={e => setSuspectForm({ ...suspectForm, fullName: e.target.value })} placeholder="Legal name" required className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Alias / Street Name</label>
                                    <input type="text" value={suspectForm.alias} onChange={e => setSuspectForm({ ...suspectForm, alias: e.target.value })} placeholder="e.g. Two-Phones" className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">National ID (NIN)</label>
                                    <input type="text" value={suspectForm.nationalId} onChange={e => setSuspectForm({ ...suspectForm, nationalId: e.target.value })} placeholder="ID Number" className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Phone Number</label>
                                    <input type="text" value={suspectForm.phoneNumber} onChange={e => setSuspectForm({ ...suspectForm, phoneNumber: e.target.value })} placeholder="+234..." className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Known Addresses / Areas</label>
                                <input type="text" value={suspectForm.knownAddresses} onChange={e => setSuspectForm({ ...suspectForm, knownAddresses: e.target.value })} placeholder="e.g. Computer Village, Ikeja" className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Description / Intel</label>
                                <textarea value={suspectForm.description} onChange={e => setSuspectForm({ ...suspectForm, description: e.target.value })} placeholder="Physical description, known associates, MO..." rows={3} className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 resize-none"></textarea>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Danger Level</label>
                                <select value={suspectForm.dangerLevel} onChange={e => setSuspectForm({ ...suspectForm, dangerLevel: e.target.value })} className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500">
                                    <option value="UNKNOWN">Unknown</option>
                                    <option value="LOW">Low — Petty Theft</option>
                                    <option value="MEDIUM">Medium — Repeat Offender</option>
                                    <option value="HIGH">High — Armed / Violent</option>
                                    <option value="EXTREME">Extreme — Syndicate / Ring Leader</option>
                                </select>
                            </div>
                            <button type="submit" disabled={isSubmittingSuspect} className="w-full mt-2 bg-purple-600 hover:bg-purple-500 text-white font-bold py-3.5 px-4 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                                {isSubmittingSuspect && <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                                {isSubmittingSuspect ? 'Creating Record...' : 'Register Suspect in National Database'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
