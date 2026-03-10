'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function TransferForm() {
    const searchParams = useSearchParams();
    const initialDeviceId = searchParams.get('deviceId') || '';

    const [devices, setDevices] = useState<any[]>([]);
    const [selectedDevice, setSelectedDevice] = useState(initialDeviceId);
    const [buyerEmail, setBuyerEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [useEscrow, setUseEscrow] = useState(false);
    const [escrowAmount, setEscrowAmount] = useState('');

    useEffect(() => {
        const fetchDevices = async () => {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
                const res = await fetch(`${apiUrl.replace('/api/v1', '')}/api/v1/consumers/dashboard`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('pts_token')}` }
                });
                const data = await res.json();
                if (res.ok) {
                    // Only allow transferring CLEAN devices
                    setDevices(data.devices.filter((d: any) => d.status === 'CLEAN'));
                }
            } catch (e) { }
        };
        fetchDevices();
    }, []);

    const handleTransfer = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        setError('');

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const res = await fetch(`${apiUrl}/transfers/initiate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('pts_token')}`
                },
                body: JSON.stringify({
                    deviceId: selectedDevice,
                    buyerEmail,
                    price: 0,
                    useEscrow,
                    escrowAmount: useEscrow ? parseFloat(escrowAmount) : 0
                })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error);

            // Highlight the handover code
            setMessage(`TRANSFER SECURED. HANDOVER CODE: ${data.handoverCode}. Give this code to the buyer to complete the verification.`);
            setBuyerEmail('');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-200">
            <a href="/consumer/dashboard" className="mb-8 text-emerald-400 font-medium hover:text-emerald-300 transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Back to Vault
            </a>

            <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-cyan-500"></div>

                <h2 className="text-2xl font-bold text-white mb-2">Transfer Ownership</h2>
                <p className="text-slate-400 text-sm mb-8">Securely transfer your DDOC to another registered user.</p>

                {error && <p className="mb-6 p-4 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 font-medium text-sm">{error}</p>}
                {message && <p className="mb-6 p-4 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium text-sm">{message}</p>}

                <form onSubmit={handleTransfer} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Select Device</label>
                        <select
                            value={selectedDevice}
                            onChange={e => setSelectedDevice(e.target.value)}
                            className="w-full bg-slate-950/50 border border-slate-700/50 hover:border-slate-600 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                            required
                        >
                            <option value="" disabled>-- Select an asset --</option>
                            {devices.map(d => (
                                <option key={d.id} value={d.id}>{d.brand} {d.model} ({d.imei})</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Buyer's PTS Email</label>
                        <input
                            type="email"
                            value={buyerEmail}
                            onChange={e => setBuyerEmail(e.target.value)}
                            placeholder="buyer@email.com"
                            className="w-full bg-slate-950/50 border border-slate-700/50 hover:border-slate-600 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                            required
                        />
                        <p className="text-xs text-slate-500 mt-2">The buyer must have a verified PTS consumer identity.</p>
                    </div>

                    <div className="bg-slate-950/50 p-6 rounded-2xl border border-blue-500/10 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="text-sm font-bold text-blue-400">PTS P2P Escrow</h4>
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">National Safe-Trade Safeguard</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setUseEscrow(!useEscrow)}
                                className={`w-12 h-6 rounded-full p-1 transition-colors ${useEscrow ? 'bg-blue-600' : 'bg-slate-800 border border-slate-700'}`}
                            >
                                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${useEscrow ? 'translate-x-6' : 'translate-x-0'}`}></div>
                            </button>
                        </div>

                        {useEscrow && (
                            <div className="animate-in slide-in-from-top-2 duration-300">
                                <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">Escrow Amount (₦)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₦</span>
                                    <input
                                        type="number"
                                        value={escrowAmount}
                                        onChange={e => setEscrowAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-mono"
                                        required={useEscrow}
                                    />
                                </div>
                                <p className="text-[9px] text-slate-500 mt-2 italic">Funds will be held in National Escrow and released ONLY when the buyer inputs the Handover Code. 2% service fee applies.</p>
                            </div>
                        )}
                    </div>

                    <button disabled={loading} type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-4 rounded-xl pt-4 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50 mt-4">
                        {loading ? 'Initiating Transfer...' : 'Initiate Secure Transfer'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default function ConsumerTransfer() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Loading...</div>}>
            <TransferForm />
        </Suspense>
    );
}
