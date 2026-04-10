'use client';
import { useState } from 'react';

export default function Login() {
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');
        setSuccessMsg('');

        try {
            const { api } = await import('@/lib/api');

            if (isForgotPassword) {
                const data = await api.post('/auth/reset-password', { email, newPassword });
                setSuccessMsg(data.message);
                setIsForgotPassword(false);
                setPassword('');
                setNewPassword('');
                return;
            }

            const data = await api.post('/auth/login', { email, password });

            localStorage.setItem('pts_token', data.token);
            window.location.href = '/vendor/dashboard';
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-emerald-500"></div>
                <div className="flex justify-center mb-6">
                    <div className="w-14 h-14 rounded-xl bg-blue-600/20 text-blue-500 flex items-center justify-center font-black text-2xl border border-blue-500/30 shadow-lg shadow-blue-500/20">PTS</div>
                </div>
                <h2 className="text-2xl font-bold text-white text-center mb-2">{isForgotPassword ? 'Reset Password' : 'Vendor Portal'}</h2>
                <p className="text-slate-400 text-sm text-center mb-8">{isForgotPassword ? 'Enter your email and new secure password' : 'Secure login for certified merchants'}</p>

                {error && <p className="mb-4 text-red-400 bg-red-500/10 p-3 rounded-lg text-sm text-center border border-red-500/20 font-medium">{error}</p>}
                {successMsg && <p className="mb-4 text-blue-400 bg-blue-500/10 p-3 rounded-lg text-sm text-center border border-blue-500/20 font-medium">{successMsg}</p>}

                <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Email Address</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="vendor@pts.com" className="w-full bg-slate-950/50 border border-slate-700/50 hover:border-slate-600 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors" required />
                    </div>
                    {isForgotPassword ? (
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">New Password</label>
                            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" className="w-full bg-slate-950/50 border border-slate-700/50 hover:border-slate-600 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors" required minLength={6} />
                        </div>
                    ) : (
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-slate-950/50 border border-slate-700/50 hover:border-slate-600 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors" required />
                        </div>
                    )}
                    <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-xl mt-6 transition-colors shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2">
                        {isSubmitting && <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                        {isForgotPassword ? 'Reset Password' : isSubmitting ? 'Verifying...' : 'Access Terminal'}
                    </button>
                </form>
                <div className="mt-8 text-center text-xs text-slate-500 flex flex-col items-center space-y-3">
                    {!isForgotPassword ? (
                        <button onClick={() => setIsForgotPassword(true)} className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors">
                            Forgot Password?
                        </button>
                    ) : (
                        <button onClick={() => setIsForgotPassword(false)} className="text-sm font-medium text-slate-400 hover:text-white transition-colors">
                            Back to Login
                        </button>
                    )}
                    <p className="mt-3">Don't have an account? <a href="/vendor/register" className="text-blue-400 hover:text-blue-300 font-bold">Register as Vendor</a></p>
                    <p>By logging in, you agree to the National Registry Guidelines.</p>
                </div>
            </div>
        </div>
    );
}
