'use client';
import { useState, useEffect } from 'react';
import MapComponent from '@/components/MapComponent';

export default function VendorScanner() {
    const [imei, setImei] = useState('');
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const [sellerEmail, setSellerEmail] = useState('');
    const [description, setDescription] = useState('');
    const [reportStatus, setReportStatus] = useState<string | null>(null);
    const [nearbyRisks, setNearbyRisks] = useState<any[]>([]);

    useEffect(() => {
        if (!localStorage.getItem('pts_token')) {
            window.location.href = '/vendor/login';
            return;
        }

        const fetchRisks = async () => {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
                const res = await fetch(`${apiUrl}/vendors/nearby-risks`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('pts_token')}` }
                });
                const data = await res.json();
                if (res.ok) setNearbyRisks(data.risks || []);
            } catch (e) { }
        };
        fetchRisks();
    }, []);

    const handleScan = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setResult(null);
        setReportStatus(null);

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const res = await fetch(`${apiUrl.replace('/api/v1', '')}/api/v1/devices/verify/${imei}`);
            const data = await res.json();
            if (res.ok) setResult(data.device);
        } catch (err: any) { }
        finally { setLoading(false); }
    };

    const handleReport = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const res = await fetch(`${apiUrl.replace('/api/v1', '')}/api/v1/vendors/suspicious-alert`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('pts_token')}`
                },
                body: JSON.stringify({ imei, sellerEmail, description })
            });
            const data = await res.json();
            if (res.ok) {
                setReportStatus('Alert successfully transmitted to Police Intelligence. Do not proceed with this transaction.');
                setSellerEmail(''); setDescription('');
            }
        } catch (e) { }
    };

    return (
        <div className="min-h-screen bg-slate-950 font-sans text-slate-200">
            <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 py-4 flex justify-between items-center sticky top-0 z-50">
                <div className="text-white font-bold flex items-center gap-3">
                    <span className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">PTS</span>
                    <div className="flex flex-col">
                        <span className="leading-tight">Vendor Terminal</span>
                        <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-semibold flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div> Connected</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <a href="/vendor/dashboard" className="text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors hidden sm:block">Register Inventory</a>
                    <button onClick={() => { localStorage.removeItem('pts_token'); window.location.href = '/vendor/login'; }} className="text-sm font-medium text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 px-4 py-2 rounded-lg transition-colors">Sign Out</button>
                </div>
            </nav>

            <main className="max-w-4xl mx-auto p-4 sm:p-6 mt-6 sm:mt-10">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold text-white mb-2">Pre-Purchase IMEI Scanner</h1>
                    <p className="text-slate-400 text-sm">Scan a customer's device before completing a trade-in or purchase.</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl mb-8">
                    <form onSubmit={handleScan} className="flex gap-4">
                        <input type="text" value={imei} onChange={e => setImei(e.target.value.replace(/\D/g, '').slice(0, 15))} placeholder="Enter 15-digit IMEI" required className="flex-1 bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white text-lg font-mono tracking-widest focus:ring-1 focus:ring-blue-500" />
                        <button type="submit" disabled={imei.length < 15 || loading} className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 rounded-xl disabled:opacity-50">
                            {loading ? 'Scanning...' : 'Scan Device'}
                        </button>
                    </form>
                </div>

                {nearbyRisks.length > 0 && (
                    <div className="mb-8 bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-red-950/20">
                            <h3 className="text-xs font-black uppercase tracking-widest text-red-400 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping"></div>
                                High-Risk Radar: Local Reported Pings
                            </h3>
                        </div>
                        <div className="h-48 w-full">
                            <MapComponent
                                zoom={10}
                                interactive={false}
                                markers={nearbyRisks.map(r => ({
                                    lat: r.latitude,
                                    lng: r.longitude,
                                    label: `Ping: ${r.device.brand} ${r.device.model}`,
                                    color: "#ef4444"
                                }))}
                            />
                        </div>
                    </div>
                )}

                {result && (
                    <div className={`p-[1px] rounded-3xl bg-gradient-to-b ${result.status === 'CLEAN' && result.riskScore >= 50 ? 'from-emerald-500/50 via-emerald-500/10' : 'from-red-600/60 via-red-600/20'}`}>
                        <div className="bg-slate-900/90 rounded-[23px] p-6 shadow-2xl">
                            <div className="flex justify-between items-start mb-6 border-b border-slate-800 pb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-white">{result.brand} {result.model}</h2>
                                    <p className="font-mono text-slate-400 tracking-widest">{result.imei}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-slate-500 font-bold uppercase">Trust Index</p>
                                    <p className={`text-4xl font-black ${result.riskScore >= 90 ? 'text-emerald-400' : result.riskScore >= 50 ? 'text-amber-400' : 'text-red-500'}`}>{result.riskScore}/100</p>
                                    <p className="text-sm font-bold uppercase mt-1 text-slate-400">{result.status}</p>
                                </div>
                            </div>

                            {result.riskScore < 90 && (
                                <div className="mt-6 bg-slate-950 p-6 rounded-2xl border border-rose-900/50">
                                    <h3 className="text-rose-400 font-bold mb-2 flex items-center gap-2">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                        Report Suspicious Seller
                                    </h3>
                                    <p className="text-sm text-slate-400 mb-6">This device has a low trust index or is flagged. If someone is attempting to sell this to you, report it to the authorities immediately to improve your Vendor Compliance Rating.</p>

                                    {reportStatus ? (
                                        <div className="p-4 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl font-medium text-sm">
                                            {reportStatus}
                                        </div>
                                    ) : (
                                        <form onSubmit={handleReport} className="space-y-4">
                                            <input type="email" value={sellerEmail} onChange={e => setSellerEmail(e.target.value)} placeholder="Attempted Seller's PTS Email (if known)" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-rose-500" />
                                            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the seller and the incident (e.g. 'Man in red jacket requested cash only')." rows={3} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-rose-500"></textarea>
                                            <button type="submit" className="bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 px-6 rounded-xl w-full flex items-center justify-center gap-2">
                                                Transmit Encrypted Alert to Police
                                            </button>
                                        </form>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
