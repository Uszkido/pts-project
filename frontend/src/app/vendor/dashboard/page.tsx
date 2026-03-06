'use client';
import { useState, useEffect } from 'react';

type VendorProfile = {
    id: string;
    email: string;
    companyName: string;
    vendorTier: number;
};

type DashboardMetrics = {
    totalInventory: number;
    totalSales: number;
    trustScore: number;
};

export default function Dashboard() {
    // Registration Form State
    const [imei, setImei] = useState('');
    const [brand, setBrand] = useState('');
    const [model, setModel] = useState('');
    const [serial, setSerial] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');
    const [isDirectSale, setIsDirectSale] = useState(false);

    // UI State
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<'register' | 'inventory' | 'sales'>('inventory');
    const [loading, setLoading] = useState(true);

    // Dashboard Data
    const [profile, setProfile] = useState<VendorProfile | null>(null);
    const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
    const [inventory, setInventory] = useState<any[]>([]);
    const [sales, setSales] = useState<any[]>([]);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const res = await fetch(`${apiUrl}/vendors/dashboard`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('pts_token')}`
                }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch dashboard data');

            setProfile(data.profile);
            setMetrics(data.metrics);
            setInventory(data.inventory);
            setSales(data.sales);
        } catch (err: any) {
            setError(err.message);
            if (err.message.includes('401') || err.message.includes('403')) {
                window.location.href = '/vendor/login';
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const token = localStorage.getItem('pts_token');
        if (!token) {
            window.location.href = '/vendor/login';
            return;
        }
        fetchDashboardData();
    }, []);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(''); setError('');
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const res = await fetch(`${apiUrl}/devices`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('pts_token')}`
                },
                body: JSON.stringify({
                    imei,
                    brand,
                    model,
                    serialNumber: serial
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setMessage(`Device registered securely. IMEI: ${data.device.imei}`);
            setImei(''); setBrand(''); setModel(''); setSerial('');

            // If direct sale, initiate transfer
            if (isDirectSale && customerEmail) {
                await initiateSale(data.device.id, customerEmail);
            } else {
                fetchDashboardData(); // Refresh inventory
            }
        } catch (err: any) {
            setError(err.message);
        }
    };

    const initiateSale = async (deviceId: string, buyerEmail: string) => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const res = await fetch(`${apiUrl}/transfers/initiate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('pts_token')}`
                },
                body: JSON.stringify({ deviceId, buyerEmail })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setMessage(message + ' | Transfer initiated. Waiting for buyer action.');
        } catch (err: any) {
            setError(`Failed to initiate sale: ${err.message}`);
        } finally {
            fetchDashboardData(); // Refresh inventory and sales lists
        }
    };

    const runTransferPrompt = (deviceId: string) => {
        const buyerEmail = prompt("Enter the customer's PTS registered email to transfer ownership: ");
        if (buyerEmail) {
            initiateSale(deviceId, buyerEmail);
        }
    };

    if (loading) {
        return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white"><div className="animate-pulse">Loading Vendor Profile...</div></div>;
    }

    return (
        <div className="min-h-screen bg-slate-950 font-sans text-slate-200">
            <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-xl">
                <div className="text-white font-bold flex items-center gap-3">
                    <span className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">PTS</span>
                    <div className="flex flex-col">
                        <span className="leading-tight truncate max-w-[150px] sm:max-w-none">{profile?.companyName || 'Vendor Profile'}</span>
                        <span className="text-[10px] text-blue-400 uppercase tracking-widest font-bold flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                            Tier {profile?.vendorTier} Verified Retailer
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <a href="/vendor/scanner" className="text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors hidden sm:block">Pre-Purchase Scanner</a>
                    <button onClick={() => { localStorage.removeItem('pts_token'); window.location.href = '/vendor/login'; }} className="text-sm font-medium text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 px-4 py-2 rounded-lg transition-colors border border-slate-700">Sign Out</button>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 mt-4">
                {/* Top Metrics Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform"><svg className="w-20 h-20 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11 4a1 1 0 10-2 0v4a1 1 0 102 0V7zm-3 1a1 1 0 10-2 0v3a1 1 0 102 0V8zM8 9a1 1 0 00-2 0v2a1 1 0 102 0V9z" clipRule="evenodd" /></svg></div>
                        <p className="text-sm font-bold text-slate-500 mb-1 tracking-wider uppercase">Active Inventory</p>
                        <h3 className="text-4xl font-black text-white">{metrics?.totalInventory} <span className="text-lg font-medium text-slate-500">devices</span></h3>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform"><svg className="w-20 h-20 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg></div>
                        <p className="text-sm font-bold text-slate-500 mb-1 tracking-wider uppercase">Units Sold</p>
                        <h3 className="text-4xl font-black text-emerald-400">{metrics?.totalSales} <span className="text-lg font-medium text-emerald-600/50">historical</span></h3>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-slate-500 mb-1 tracking-wider uppercase">Public Trust Index</p>
                            <h3 className="text-4xl font-black text-white">{metrics?.trustScore}<span className="text-xl font-bold text-slate-600">/100</span></h3>
                            <p className="text-xs font-semibold text-blue-400 mt-1">Excellent Standing</p>
                        </div>
                        <div className="w-16 h-16 rounded-full border-4 border-slate-800 flex items-center justify-center shrink-0" style={{ background: `conic-gradient(from 0deg, #3b82f6 ${(metrics?.trustScore || 0)}%, transparent 0)` }}>
                            <div className="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center">
                                <span className="font-bold text-xs">TIER {profile?.vendorTier}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Dashboard Navigation */}
                <div className="flex border-b border-slate-800 mb-8 overflow-x-auto hide-scrollbar">
                    <button onClick={() => setActiveTab('inventory')} className={`pb-4 px-6 text-sm font-bold tracking-wide break-keep whitespace-nowrap transition-colors border-b-2 ${activeTab === 'inventory' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>My Store Inventory</button>
                    <button onClick={() => setActiveTab('sales')} className={`pb-4 px-6 text-sm font-bold tracking-wide break-keep whitespace-nowrap transition-colors border-b-2 ${activeTab === 'sales' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Sales Ledger</button>
                    <button onClick={() => setActiveTab('register')} className={`pb-4 px-6 text-sm font-bold tracking-wide break-keep whitespace-nowrap transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'register' ? 'border-blue-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg> Add Inventory
                    </button>
                </div>

                {message && <p className="mb-6 p-4 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-3 font-medium animate-in fade-in slide-in-from-top-2"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> {message}</p>}
                {error && <p className="mb-6 p-4 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-3 font-medium animate-in fade-in slide-in-from-top-2"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> {error}</p>}

                {/* Tab Content: Inventory */}
                {activeTab === 'inventory' && (
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                        {inventory.length === 0 ? (
                            <div className="p-16 text-center border-b border-slate-800">
                                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-10 h-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg></div>
                                <h3 className="text-xl font-bold text-white mb-2">No Active Inventory</h3>
                                <p className="text-slate-400 mb-6 max-w-sm mx-auto">You currently have no devices registered in your store's possession.</p>
                                <button onClick={() => setActiveTab('register')} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg">Register First Device</button>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-950 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500 font-bold">
                                            <th className="p-5">Device Make</th>
                                            <th className="p-5">IMEI Number</th>
                                            <th className="p-5">Status</th>
                                            <th className="p-5">Risk</th>
                                            <th className="p-5 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800 flex-1">
                                        {inventory.map(device => (
                                            <tr key={device.id} className="hover:bg-slate-800/30 transition-colors group">
                                                <td className="p-5">
                                                    <p className="font-bold text-white">{device.brand}</p>
                                                    <p className="text-sm text-slate-400">{device.model}</p>
                                                </td>
                                                <td className="p-5 font-mono text-slate-300 tracking-widest">{device.imei}</td>
                                                <td className="p-5">
                                                    <span className={`inline-flex px-2 py-1 rounded-md text-xs font-bold ${device.status === 'CLEAN' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                                        {device.status}
                                                    </span>
                                                </td>
                                                <td className="p-5 font-bold text-slate-300">{device.riskScore}</td>
                                                <td className="p-5 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => runTransferPrompt(device.id)} className="bg-blue-600 hover:bg-blue-500 text-xs text-white font-bold py-2 px-4 rounded-lg shadow mr-2">Sell / Transfer</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Tab Content: Sales History */}
                {activeTab === 'sales' && (
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                        {sales.length === 0 ? (
                            <div className="p-16 text-center">
                                <h3 className="text-xl font-bold text-white mb-2">No Sales History</h3>
                                <p className="text-slate-400">You haven't completed any device transfers yet.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-950 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500 font-bold">
                                            <th className="p-5">Date</th>
                                            <th className="p-5">Device Sold</th>
                                            <th className="p-5">Buyer Identity</th>
                                            <th className="p-5 text-right">Verification</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800 flex-1">
                                        {sales.map(sale => (
                                            <tr key={sale.id} className="hover:bg-slate-800/30 transition-colors">
                                                <td className="p-5 text-sm font-medium text-slate-400">{new Date(sale.transferDate).toLocaleDateString()}</td>
                                                <td className="p-5">
                                                    <p className="font-bold text-white mb-0.5">{sale.device.brand} {sale.device.model}</p>
                                                    <p className="text-xs font-mono text-slate-500 tracking-widest">{sale.device.imei}</p>
                                                </td>
                                                <td className="p-5 text-slate-300">{sale.buyer.email}</td>
                                                <td className="p-5 text-right">
                                                    <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-bold bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
                                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> SECURED
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Tab Content: Register Device (Original UI slightly improved) */}
                {activeTab === 'register' && (
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-xl animate-in fade-in zoom-in-95 duration-300">
                        <div className="mb-8">
                            <h2 className="text-xl font-bold text-white">Add Device to National DB</h2>
                            <p className="text-slate-400 text-sm mt-1">Cryptographically bind clean devices to your vendor ID before putting them on display.</p>
                        </div>
                        <form onSubmit={handleRegister} className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="sm:col-span-2 relative group">
                                    <label className="block text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wide">15-Digit IMEI Number <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                        <input type="text" value={imei} onChange={e => setImei(e.target.value.replace(/\D/g, '').slice(0, 15))} required placeholder="e.g. 359123456789012" className="w-full bg-slate-950/50 border border-slate-700/50 hover:border-slate-600 rounded-xl pl-12 pr-4 py-3 text-white font-mono tracking-wider focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wide">Device Brand <span className="text-red-500">*</span></label>
                                    <input type="text" value={brand} onChange={e => setBrand(e.target.value)} required placeholder="e.g. Apple" className="w-full bg-slate-950/50 border border-slate-700/50 hover:border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wide">Device Model <span className="text-red-500">*</span></label>
                                    <input type="text" value={model} onChange={e => setModel(e.target.value)} required placeholder="e.g. iPhone 14 Pro" className="w-full bg-slate-950/50 border border-slate-700/50 hover:border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" />
                                </div>
                                <div className="sm:col-span-2 pt-4 border-t border-slate-800 hidden">
                                    {/* Direct sale ui hidden for simplicity in this view */}
                                </div>
                            </div>
                            <div className="pt-4 border-t border-slate-800 flex justify-end">
                                <button type="submit" disabled={imei.length < 15} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg flex items-center gap-2 disabled:opacity-50">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                                    Secure to Vendor Inventory
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </main>
        </div>
    );
}
