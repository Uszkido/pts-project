'use client';
import { useState, useEffect } from 'react';

export default function PoliceDashboard() {
    const [devices, setDevices] = useState<any[]>([]);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState(''); // '' means all, 'STOLEN', etc.
    const [loading, setLoading] = useState(true);

    const fetchDevices = async () => {
        setLoading(true);
        try {
            const url = filter
                ? `http://localhost:5000/api/v1/police/devices?status=${filter}`
                : 'http://localhost:5000/api/v1/police/devices';

            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('pts_token')}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setDevices(data.devices);
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
        fetchDevices();
    }, [filter]);

    const updateStatus = async (imei: string, newStatus: string) => {
        try {
            const res = await fetch(`http://localhost:5000/api/v1/police/devices/${imei}/status`, {
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
            fetchDevices(); // refresh
        } catch (err: any) {
            alert(err.message);
        }
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
                    <a href="/police/intelligence" className="text-sm font-semibold text-red-400 hover:text-red-300 transition-colors hidden sm:block">Intelligence Portal</a>
                    <button onClick={() => { localStorage.removeItem('pts_token'); window.location.href = '/police/login'; }} className="text-sm font-medium text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 px-4 py-2 rounded-lg transition-colors">Terminate Session</button>
                </div>
            </nav>

            <main className="max-w-6xl mx-auto p-4 sm:p-6 mt-6 sm:mt-10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10a4 4 0 014-4h10a4 4 0 014 4v10a4 4 0 01-4 4H7a4 4 0 01-4-4V10z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6V4a2 2 0 012-2h0a2 2 0 012 2v2" /></svg>
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Cross-Reference Registry</h1>
                            <p className="text-slate-400 text-sm mt-1">Review registered devices and flag suspicious activity.</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg focus:ring-red-500 focus:border-red-500 block p-2.5 outline-none"
                        >
                            <option value="">All Devices</option>
                            <option value="CLEAN">Clean</option>
                            <option value="STOLEN">Stolen</option>
                            <option value="LOST">Lost</option>
                            <option value="INVESTIGATING">Investigating</option>
                        </select>
                    </div>
                </div>

                {error && <p className="mb-6 p-4 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 font-medium">{error}</p>}

                <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-slate-400">
                            <thead className="text-xs text-slate-300 uppercase bg-slate-800/50 border-b border-slate-800">
                                <tr>
                                    <th className="px-6 py-4 font-semibold tracking-wider">IMEI</th>
                                    <th className="px-6 py-4 font-semibold tracking-wider">Device Info</th>
                                    <th className="px-6 py-4 font-semibold tracking-wider">Registered Entity</th>
                                    <th className="px-6 py-4 font-semibold tracking-wider">Current Status</th>
                                    <th className="px-6 py-4 font-semibold tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={5} className="px-6 py-8 text-center">Decrypting Registry Data...</td></tr>
                                ) : devices.length === 0 ? (
                                    <tr><td colSpan={5} className="px-6 py-8 text-center">No devices found matching criteria.</td></tr>
                                ) : devices.map((device: any) => (
                                    <tr key={device.id} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-4 font-mono font-medium text-white">{device.imei}</td>
                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-white">{device.brand} {device.model}</div>
                                            <div className="text-xs text-slate-500 mt-0.5">SN: {device.serialNumber || 'N/A'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-white">{device.registeredOwner.companyName || 'Unknown Vendor'}</div>
                                            <div className="text-xs text-slate-500">{device.registeredOwner.email}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${device.status === 'CLEAN' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                device.status === 'INVESTIGATING' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                                    'bg-red-500/10 text-red-400 border border-red-500/20'
                                                }`}>
                                                {device.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {device.status !== 'INVESTIGATING' && (
                                                <button onClick={() => updateStatus(device.imei, 'INVESTIGATING')} className="text-xs font-semibold text-amber-400 hover:text-amber-300 ml-3">Flag for Investigation</button>
                                            )}
                                            {device.status !== 'CLEAN' && (
                                                <button onClick={() => updateStatus(device.imei, 'CLEAN')} className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 ml-3">Clear Flag</button>
                                            )}
                                            {device.status !== 'STOLEN' && (
                                                <button onClick={() => updateStatus(device.imei, 'STOLEN')} className="text-xs font-semibold text-red-400 hover:text-red-300 ml-3">Mark Stolen</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}
