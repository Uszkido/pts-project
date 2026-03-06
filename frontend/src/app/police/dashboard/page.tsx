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

    // UI Tabs
    const [activeTab, setActiveTab] = useState<'registry' | 'incidents' | 'alerts'>('registry');

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

            // Fetch incidents and alerts simultaneously
            const [incidentsRes, alertsRes] = await Promise.all([
                fetch(`${apiUrl}/police/incidents`, { headers }),
                fetch(`${apiUrl}/police/vendor-alerts`, { headers })
            ]);

            const incidentsData = await incidentsRes.json();
            const alertsData = await alertsRes.json();

            setReports(incidentsData.reports || []);
            setAlerts(alertsData.alerts || []);

        } catch (err: any) {
            setError(err.message);
            if (err.message.includes('401') || err.message.includes('403')) {
                window.location.href = '/police/login';
            }
        } finally {
            setLoading(false);
        }
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
                                                    <div className="font-bold text-white">{device.brand} {device.model}</div>
                                                    <div className="text-xs text-slate-500 mt-0.5">SN: {device.serialNumber || 'N/A'}</div>
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
                                                <div className="font-bold text-white">{report.device.brand} {report.device.model}</div>
                                                <div className="text-xs text-slate-500 font-mono mt-1">{report.device.imei}</div>
                                            </td>
                                            <td className="px-6 py-4 max-w-sm">
                                                <p className="text-sm text-slate-300 line-clamp-2">{report.description}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${report.status === 'OPEN' ? 'bg-red-500/10 text-red-500 border border-red-500/30' : 'bg-slate-800 text-slate-400'}`}>
                                                    {report.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
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
                                                <div className="font-bold text-white">{alert.device.brand} {alert.device.model}</div>
                                                <div className="text-xs text-slate-500 font-mono mt-1">{alert.device.imei}</div>
                                            </td>
                                            <td className="px-6 py-4 max-w-sm">
                                                <p className="text-sm text-slate-300 line-clamp-2">{alert.notes || 'No additional notes provided.'}</p>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
