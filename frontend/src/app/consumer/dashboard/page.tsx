'use client';
import { useState, useEffect } from 'react';

export default function ConsumerDashboard() {
    const [devices, setDevices] = useState<any[]>([]);
    const [pastDevices, setPastDevices] = useState<any[]>([]);
    const [pendingTransfers, setPendingTransfers] = useState<any[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedPassport, setSelectedPassport] = useState<any[] | null>(null);
    const [isPassportOpen, setIsPassportOpen] = useState(false);
    const [passportLoading, setPassportLoading] = useState(false);

    // UI tabs
    const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

    const fetchDashboard = async () => {
        setLoading(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const res = await fetch(`${apiUrl}/consumers/dashboard`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('pts_token')}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setDevices(data.devices || []);
            setPendingTransfers(data.pendingTransfers || []);
            setPastDevices(data.pastDevices || []);
        } catch (err: any) {
            setError(err.message);
            if (err.message.includes('401') || err.message.includes('403')) {
                window.location.href = '/consumer/login';
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!localStorage.getItem('pts_token')) {
            window.location.href = '/consumer/login';
            return;
        }
        fetchDashboard();
    }, []);

    const acceptTransfer = async (transferId: string) => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const res = await fetch(`${apiUrl}/transfers/accept/${transferId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('pts_token')}` }
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error);
            }
            fetchDashboard();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const fetchPassport = async (imei: string) => {
        setPassportLoading(true);
        setIsPassportOpen(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const res = await fetch(`${apiUrl}/passports/${imei}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('pts_token')}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setSelectedPassport(data.passport);
        } catch (err: any) {
            alert(err.message);
            setIsPassportOpen(false);
        } finally {
            setPassportLoading(false);
        }
    };

    const emergencyFreeze = async (deviceId: string) => {
        if (!confirm('Are you sure you want to FREEZE this asset? This cannot be easily undone and will actively flag the device across national telecom networks.')) return;

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const res = await fetch(`${apiUrl}/incidents/emergency-freeze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('pts_token')}`
                },
                body: JSON.stringify({ deviceId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            alert('🚨 EMERGENCY FREEZE ACTIVATED. Your Certificate has been revoked.');
            fetchDashboard();
        } catch (err: any) {
            alert(err.message);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 font-sans text-slate-200">
            <nav className="border-b border-emerald-900/40 bg-slate-900/80 backdrop-blur-md px-6 py-4 flex justify-between items-center sticky top-0 z-50">
                <div className="text-white font-bold flex items-center gap-3">
                    <span className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">PTS</span>
                    <div className="flex flex-col">
                        <span className="leading-tight">Digital Vault</span>
                        <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-semibold flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div> Secured</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => { localStorage.removeItem('pts_token'); window.location.href = '/consumer/login'; }} className="text-sm font-medium text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 px-4 py-2 rounded-lg transition-colors border border-slate-700">Sign Out</button>
                </div>
            </nav>

            <main className="max-w-5xl mx-auto p-4 sm:p-6 mt-6 sm:mt-10">
                {error && <p className="mb-6 p-4 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 font-medium">{error}</p>}

                {/* Pending Transfers Alert */}
                {pendingTransfers.length > 0 && (
                    <div className="mb-10 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 shadow-xl animate-in fade-in slide-in-from-top-4 duration-500">
                        <h2 className="text-xl font-bold text-amber-500 mb-4 flex items-center gap-2"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg> Incoming Device Transfers</h2>
                        <div className="space-y-4">
                            {pendingTransfers.map((tx: any) => (
                                <div key={tx.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-900/80 p-5 rounded-xl border border-slate-700/50 hover:border-amber-500/50 transition-colors">
                                    <div>
                                        <p className="font-semibold text-white text-lg">{tx.device.brand} {tx.device.model}</p>
                                        <p className="text-sm text-slate-400">From: {tx.seller.companyName || tx.seller.email} • IMEI: {tx.device.imei}</p>
                                    </div>
                                    <button onClick={() => acceptTransfer(tx.id)} className="mt-4 sm:mt-0 bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 px-6 rounded-xl transition-colors shadow-lg shadow-amber-500/20 flex items-center gap-2">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        Accept Ownership
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b border-slate-800 pb-4">
                    <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Your Asset Portfolio</h1>
                    <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1">
                        <button onClick={() => setActiveTab('active')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'active' ? 'bg-emerald-600/20 text-emerald-400' : 'text-slate-400 hover:text-white'}`}>Active Devices</button>
                        <button onClick={() => setActiveTab('history')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:text-white'}`}>Ownership History</button>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-20 text-slate-500">
                        <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                            <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        </div>
                        <p className="animate-pulse">Decrypting vault contents...</p>
                    </div>
                ) : activeTab === 'active' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in zoom-in-95 duration-300">
                        {devices.length === 0 ? (
                            <div className="col-span-full border border-dashed border-slate-700 bg-slate-900/30 rounded-3xl p-16 text-center">
                                <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-10 h-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg></div>
                                <h3 className="text-xl font-bold text-white mb-2">No Active Assets</h3>
                                <p className="text-slate-400 font-medium">There are no devices cryptographically bound to your identity right now.</p>
                            </div>
                        ) : (
                            devices.map((device: any) => {
                                const activeCert = device.certificates && device.certificates.length > 0 ? device.certificates[0] : null;

                                return (
                                    <div key={device.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden group hover:border-slate-700 transition-colors">
                                        <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl transition-colors ${device.status === 'CLEAN' ? 'bg-emerald-500/5 group-hover:bg-emerald-500/10' : 'bg-red-500/10 group-hover:bg-red-500/20'}`}></div>

                                        <div className="flex justify-between items-start mb-6 relative">
                                            <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${device.status === 'CLEAN' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                                                {device.status}
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] text-slate-500 font-bold uppercase">Trust Score</div>
                                                <div className={`text-lg font-black leading-none ${device.riskScore >= 80 ? 'text-emerald-400' : device.riskScore >= 50 ? 'text-amber-400' : 'text-red-500'}`}>{device.riskScore}</div>
                                            </div>
                                        </div>

                                        <h3 className="text-xl font-bold text-white mb-1 relative">{device.brand} {device.model}</h3>
                                        <p className="text-sm font-mono text-slate-400 mb-6 tracking-widest relative">{device.imei}</p>

                                        <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800/80 relative">
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Digital Ownership Certificate (DDOC)</p>
                                            {activeCert && activeCert.isActive ? (
                                                <div className="flex gap-3 items-center">
                                                    <div className="w-10 h-10 rounded-lg bg-emerald-400/[0.08] flex items-center justify-center">
                                                        <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    </div>
                                                    <div className="overflow-hidden">
                                                        <div className="text-xs text-white font-semibold truncate leading-tight">ACTIVE REGISTRATION</div>
                                                        <div className="text-[10px] text-slate-500 font-mono truncate">{activeCert.qrHash.substring(0, 20)}...</div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex gap-3 items-center">
                                                    <div className="w-10 h-10 rounded-lg bg-red-400/[0.08] flex items-center justify-center">
                                                        <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                                    </div>
                                                    <div className="overflow-hidden">
                                                        <div className="text-xs text-red-400 font-semibold truncate leading-tight">REVOKED & LOCKED</div>
                                                        <div className="text-[10px] text-slate-500">Device frozen on network.</div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-6 flex flex-col gap-3 relative z-10">
                                            <button onClick={() => fetchPassport(device.imei)} className="block w-full text-center bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white text-sm font-bold py-3 rounded-xl transition-all border border-blue-500/20">
                                                View Device Passport
                                            </button>
                                            {device.status === 'CLEAN' ? (
                                                <>
                                                    <a href={`/consumer/transfer?deviceId=${device.id}`} className="block w-full text-center bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold py-3 rounded-xl transition-colors border border-slate-700/50">
                                                        Transfer Asset
                                                    </a>
                                                    <button onClick={() => emergencyFreeze(device.id)} className="flex items-center justify-center gap-2 w-full bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 text-sm font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-red-500/20">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                        Emergency Freeze
                                                    </button>
                                                </>
                                            ) : (
                                                <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center text-sm text-slate-400 cursor-not-allowed">
                                                    Action Locked due to {device.status} status.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                ) : (
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                        {pastDevices.length === 0 ? (
                            <div className="p-16 text-center border-b border-slate-800">
                                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-10 h-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                                <h3 className="text-xl font-bold text-white mb-2">No Ownership History</h3>
                                <p className="text-slate-400 max-w-sm mx-auto">You have not completed any outgoing transfers or sold any devices.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-950 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500 font-bold">
                                            <th className="p-5">Transfer Date</th>
                                            <th className="p-5">Device Make</th>
                                            <th className="p-5">IMEI Number</th>
                                            <th className="p-5">Transferred To</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800 flex-1">
                                        {pastDevices.map((device, idx) => (
                                            <tr key={`${device.id}-${idx}`} className="hover:bg-slate-800/30 transition-colors group">
                                                <td className="p-5 text-slate-400 font-medium">{new Date(device.transferDetails?.date).toLocaleDateString()}</td>
                                                <td className="p-5">
                                                    <p className="font-bold text-white mb-0.5">{device.brand} {device.model}</p>
                                                    <p className="text-xs text-slate-500">Record Permanent</p>
                                                </td>
                                                <td className="p-5 font-mono text-slate-300 tracking-widest">{device.imei}</td>
                                                <td className="p-5">
                                                    <span className="text-slate-300">{device.transferDetails?.buyer?.email || 'Unknown'}</span>
                                                    {device.transferDetails?.buyer?.companyName && (
                                                        <span className="block text-xs text-blue-400 mt-1">{device.transferDetails.buyer.companyName}</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Device Passport Modal */}
                {isPassportOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl max-h-[85vh] overflow-hidden flex flex-col">
                            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-white leading-tight">Device Immutable Passport</h2>
                                        <p className="text-xs text-slate-500 uppercase tracking-widest font-mono mt-1">Chain-of-Custody Ledger</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsPassportOpen(false)} className="text-slate-400 hover:text-white p-2">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {passportLoading ? (
                                    <div className="text-center py-10 text-slate-500 italic">Accessing Ledger Nodes...</div>
                                ) : selectedPassport && selectedPassport.length > 0 ? (
                                    <div className="relative pl-8 border-l-2 border-slate-800 space-y-8">
                                        {selectedPassport.map((entry, idx) => (
                                            <div key={entry.id} className="relative">
                                                <div className={`absolute -left-[41px] top-0 w-5 h-5 rounded-full border-4 border-slate-900 ${entry.type === 'REGISTRATION' ? 'bg-emerald-500' :
                                                    entry.type === 'TRANSFER' ? 'bg-blue-500' :
                                                        entry.type === 'STATUS_CHANGE' ? 'bg-amber-500' : 'bg-slate-400'
                                                    }`}></div>
                                                <div className="text-[10px] text-slate-500 font-mono mb-1">{new Date(entry.createdAt).toLocaleString()}</div>
                                                <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-xl">
                                                    <div className="text-xs font-bold text-slate-300 uppercase tracking-wide mb-1 flex items-center gap-2">
                                                        {entry.type}
                                                        <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                                                        <span className="text-slate-500 lowercase font-normal">by {entry.actor?.companyName || entry.actor?.email || 'System'}</span>
                                                    </div>
                                                    <p className="text-sm text-white font-medium">{entry.description}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-center py-10 text-slate-500">No transaction logs found for this device.</p>
                                )}
                            </div>

                            <div className="p-6 bg-slate-950/50 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-500 italic">
                                <span>Verified by PTS National Registry Core v4.0</span>
                                <span className="flex items-center gap-1 text-emerald-500 font-bold tracking-tighter uppercase tabular-nums">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                    Immutable Sync
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
