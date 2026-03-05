'use client';
import { useState, useEffect } from 'react';

export default function Dashboard() {
    const [imei, setImei] = useState('');
    const [brand, setBrand] = useState('');
    const [model, setModel] = useState('');
    const [serial, setSerial] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');
    const [vendorTier, setVendorTier] = useState<number | null>(null);
    const [isDirectSale, setIsDirectSale] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('pts_token');
        if (!token) {
            window.location.href = '/vendor/login';
            return;
        }

        // Mock fetching vendor profile for Tier
        const fetchProfile = async () => {
            // In a real app, we'd hit /api/v1/auth/me
            // For prototype, let's assume Tier 1-3 based on user session or default
            setVendorTier(1);
        };
        fetchProfile();
    }, []);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(''); setError('');
        try {
            const res = await fetch('http://localhost:5000/api/v1/registry/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('pts_token')}`
                },
                body: JSON.stringify({
                    imei,
                    brand,
                    model,
                    serialNumber: serial,
                    customerEmail: isDirectSale ? customerEmail : null
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setMessage('Device registered successfully! It is now secured in the national DB.');
            setImei(''); setBrand(''); setModel(''); setSerial('');
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 font-sans text-slate-200">
            <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 py-4 flex justify-between items-center sticky top-0 z-50">
                <div className="text-white font-bold flex items-center gap-3">
                    <span className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">PTS</span>
                    <div className="flex flex-col">
                        <span className="leading-tight">Vendor Terminal</span>
                        {vendorTier && (
                            <span className="text-[10px] text-blue-400 uppercase tracking-widest font-bold flex items-center gap-1">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                Tier {vendorTier} Verified Retailer
                            </span>
                        )}
                        <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-semibold flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div> System Active</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <a href="/vendor/scanner" className="text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors hidden sm:block">Pre-Purchase Scanner</a>
                    <button onClick={() => { localStorage.removeItem('pts_token'); window.location.href = '/vendor/login'; }} className="text-sm font-medium text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 px-4 py-2 rounded-lg transition-colors">Sign Out</button>
                </div>
            </nav>

            <main className="max-w-4xl mx-auto p-4 sm:p-6 mt-6 sm:mt-10">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Register Inventory</h1>
                        <p className="text-slate-400 text-sm mt-1">Cryptographically bind clean devices to your vendor ID.</p>
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-xl">
                    {message && <p className="mb-6 p-4 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-3 font-medium"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> {message}</p>}
                    {error && <p className="mb-6 p-4 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-3 font-medium"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> {error}</p>}

                    <form onSubmit={handleRegister} className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="sm:col-span-2 relative group">
                                <label className="block text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wide">15-Digit IMEI Number <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                    <input type="text" value={imei} onChange={e => setImei(e.target.value.replace(/\D/g, '').slice(0, 15))} required placeholder="e.g. 359123456789012" className="w-full bg-slate-950/50 border border-slate-700/50 hover:border-slate-600 rounded-xl pl-12 pr-4 py-4 text-white text-lg font-mono tracking-wider focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wide">Device Brand <span className="text-red-500">*</span></label>
                                <input type="text" value={brand} onChange={e => setBrand(e.target.value)} required placeholder="e.g. Apple" className="w-full bg-slate-950/50 border border-slate-700/50 hover:border-slate-600 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wide">Device Model <span className="text-red-500">*</span></label>
                                <input type="text" value={model} onChange={e => setModel(e.target.value)} required placeholder="e.g. iPhone 14 Pro" className="w-full bg-slate-950/50 border border-slate-700/50 hover:border-slate-600 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" />
                            </div>

                            <div className="sm:col-span-2">
                                <label className="block text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wide">Manufacturer Serial Number <span className="text-slate-500 font-normal normal-case">(Optional)</span></label>
                                <input type="text" value={serial} onChange={e => setSerial(e.target.value)} placeholder="e.g. C02WM0R0HTDF" className="w-full bg-slate-950/50 border border-slate-700/50 hover:border-slate-600 rounded-xl px-4 py-3.5 text-white font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" />
                            </div>

                            <div className="sm:col-span-2 pt-4 border-t border-slate-800">
                                <div className="flex items-center justify-between p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-white">Direct-to-Customer Registration</span>
                                        <span className="text-xs text-slate-500">Assign ownership immediately upon registration</span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={isDirectSale} onChange={e => setIsDirectSale(e.target.checked)} className="sr-only peer" />
                                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                                {isDirectSale && (
                                    <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <label className="block text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wide">Customer Email Address <span className="text-red-500">*</span></label>
                                        <input type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} required placeholder="customer@email.com" className="w-full bg-slate-950/50 border border-blue-500/30 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600" />
                                        <p className="text-[10px] text-slate-500 mt-2">Consumer must have a registered PTS account to receive ownership.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="pt-4 mt-8 border-t border-slate-800 flex justify-end">
                            <button type="submit" disabled={imei.length < 15} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-8 rounded-xl transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2 disabled:opacity-50">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                                Secure to Registry
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
}
