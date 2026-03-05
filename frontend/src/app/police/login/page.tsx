'use client';
import { useState } from 'react';

export default function PoliceLogin() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('http://localhost:5000/api/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            if (data.role !== 'POLICE' && data.role !== 'ADMIN') {
                throw new Error('Unauthorized role. Law enforcement personnel only.');
            }

            localStorage.setItem('pts_token', data.token);
            window.location.href = '/police/dashboard';
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-indigo-500"></div>
                <div className="flex justify-center mb-6">
                    <div className="w-14 h-14 rounded-xl bg-red-600/20 text-red-500 flex items-center justify-center font-black text-2xl border border-red-500/30 shadow-lg shadow-red-500/20">PTS</div>
                </div>
                <h2 className="text-2xl font-bold text-white text-center mb-2">Law Enforcement Portal</h2>
                <p className="text-slate-400 text-sm text-center mb-8">Secure login for authorized agencies</p>

                {error && <p className="mb-4 text-red-400 bg-red-500/10 p-3 rounded-lg text-sm text-center border border-red-500/20 font-medium">{error}</p>}

                <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Agency Email</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="officer@pts.com" className="w-full bg-slate-950/50 border border-slate-700/50 hover:border-slate-600 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 transition-colors" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-slate-950/50 border border-slate-700/50 hover:border-slate-600 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 transition-colors" required />
                    </div>
                    <button type="submit" className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3.5 px-4 rounded-xl mt-6 transition-colors shadow-lg shadow-red-500/20">
                        Secure Access
                    </button>
                </form>
                <div className="mt-8 text-center text-xs text-slate-500">
                    <p>This portal is strictly for authorized law enforcement operations.</p>
                </div>
            </div>
        </div>
    );
}
