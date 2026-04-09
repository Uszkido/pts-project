'use client';
import { useState } from 'react';

export default function AdminLogin() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://pts-backend-api.vercel.app/api/v1';
            const res = await fetch(`${apiUrl.replace('/api/v1', '')}/api/v1/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            if (data.role !== 'ADMIN') throw new Error('You do not have administrator privileges.');

            localStorage.setItem('pts_token', data.token);
            window.location.href = '/admin/dashboard';
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-red-600"></div>
                <div className="flex justify-center mb-6">
                    <div className="w-14 h-14 rounded-xl bg-amber-600/20 text-amber-500 flex items-center justify-center font-black text-xl border border-amber-500/30 shadow-lg shadow-amber-500/20">
                        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-white text-center mb-2">Admin Console</h2>
                <p className="text-slate-400 text-sm text-center mb-8">Authorized personnel only</p>

                {error && <p className="mb-4 text-red-400 bg-red-500/10 p-3 rounded-lg text-sm text-center border border-red-500/20 font-medium">{error}</p>}

                <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@pts.gov" className="w-full bg-slate-950/50 border border-slate-700/50 hover:border-slate-600 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-colors" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-slate-950/50 border border-slate-700/50 hover:border-slate-600 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-colors" required />
                    </div>
                    <button type="submit" className="w-full bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-white font-bold py-3.5 px-4 rounded-xl mt-6 transition-all shadow-lg shadow-amber-500/20">
                        Access Admin Console
                    </button>
                </form>
                <p className="text-center mt-6 text-xs text-slate-600">This portal is monitored and secured.</p>
            </div>
        </div>
    );
}
