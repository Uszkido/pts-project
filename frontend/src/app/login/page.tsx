'use client';
import { useState, useEffect } from 'react';

const ROLE_REDIRECTS: Record<string, string> = {
    ADMIN: '/admin/dashboard',
    POLICE: '/police/dashboard',
    VENDOR: '/vendor/dashboard',
    CONSUMER: '/consumer/dashboard',
};

export default function UnifiedLogin() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [isOtpStep, setIsOtpStep] = useState(false);
    const [otp, setOtp] = useState('');
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');
        setSuccessMsg('');

        try {
            const { api } = await import('@/lib/api');

            if (isForgotPassword) {
                if (newPassword !== confirmPassword) {
                    setError('Passwords do not match');
                    return;
                }
                const data = await api.post('/auth/reset-password', { email, newPassword });
                setSuccessMsg(data.message || 'Password reset successful. You can now log in.');
                setIsForgotPassword(false);
                setNewPassword('');
                setConfirmPassword('');
                return;
            }

            const data = await api.post('/auth/login', { email, password });

            const role = data.user?.role as string;
            const destination = ROLE_REDIRECTS[role];

            if (!destination) {
                throw new Error('Unrecognized account type. Please contact support.');
            }

            localStorage.setItem('pts_token', data.token);
            window.location.href = destination;

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');
        try {
            const { api } = await import('@/lib/api');
            const data = await api.post('/auth/verify-email', { email, otp });
            setSuccessMsg(data.message || 'Email verified. You can now log in.');
            setIsOtpStep(false);
            setOtp('');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const accentClass = 'from-blue-500 via-indigo-500 to-violet-600';

    if (!mounted) return null;

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
            <div className="w-full max-w-md relative z-10">
                <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden">

                    <div className="p-8 sm:p-10">
                        {/* Logo */}
                        <div className="flex flex-col items-center mb-8">
                            <div className="w-12 h-12 rounded bg-blue-700 flex items-center justify-center font-bold text-white text-xl mb-4">
                                PTS
                            </div>
                            <h1 className="text-2xl font-extrabold text-white tracking-tight">
                                {isOtpStep ? 'Verify Email' : isForgotPassword ? 'Reset Password' : 'Welcome Back'}
                            </h1>
                            <p className="text-slate-500 text-sm mt-1 text-center">
                                {isOtpStep
                                    ? 'Enter the 6-digit code sent to your email'
                                    : isForgotPassword
                                        ? 'Enter your email and choose a new password'
                                        : 'Sign in to access your dashboard.'}
                            </p>
                        </div>

                        {/* Role pills — decorative, shown on login view */}
                        {!isForgotPassword && !isOtpStep && (
                            <div className="flex gap-2 flex-wrap justify-center mb-7">
                                {[
                                    { label: 'Vendor', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
                                    { label: 'Device Owner', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
                                ].map(r => (
                                    <span key={r.label} className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${r.color}`}>
                                        {r.label}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Error / success banners */}
                        {error && (
                            <div className="mb-5 flex items-start gap-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium px-4 py-3 rounded-xl">
                                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                {error}
                            </div>
                        )}
                        {successMsg && (
                            <div className="mb-5 flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium px-4 py-3 rounded-xl">
                                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                {successMsg}
                            </div>
                        )}

                        {/* OTP FORM */}
                        {isOtpStep ? (
                            <form onSubmit={handleVerifyOtp} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Verification Code</label>
                                    <input
                                        type="text"
                                        value={otp}
                                        onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        placeholder="· · · · · ·"
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-4 text-white text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:border-blue-500 transition-colors"
                                        required
                                        maxLength={6}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || otp.length < 6}
                                    className="w-full py-3 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                                >
                                    {isSubmitting && <Spinner />}
                                    Verify Code
                                </button>
                                <button type="button" onClick={() => setIsOtpStep(false)} className="w-full text-slate-400 hover:text-white text-sm font-medium transition-colors">← Back to login</button>
                            </form>
                        ) : (
                            /* MAIN FORM */
                            <form onSubmit={handleLogin} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Email Address</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        placeholder="you@example.com"
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                                        required
                                    />
                                </div>

                                {isForgotPassword ? (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-1.5">New Password</label>
                                            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors" required minLength={6} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm New Password</label>
                                            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors" required minLength={6} />
                                        </div>
                                    </>
                                ) : (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                            required
                                        />
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full py-3 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 mt-2"
                                >
                                    {isSubmitting && <Spinner />}
                                    {isForgotPassword ? 'Reset Password' : isSubmitting ? 'Authenticating...' : 'Sign In →'}
                                </button>

                                <div className="flex flex-col items-center gap-2 pt-2">
                                    {!isForgotPassword ? (
                                        <button type="button" onClick={() => { setIsForgotPassword(true); setError(''); }} className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors">
                                            Forgot password?
                                        </button>
                                    ) : (
                                        <button type="button" onClick={() => { setIsForgotPassword(false); setError(''); }} className="text-sm font-medium text-slate-400 hover:text-white transition-colors">
                                            ← Back to login
                                        </button>
                                    )}
                                </div>
                            </form>
                        )}

                        {/* Divider */}
                        <div className="flex items-center gap-3 my-6">
                            <div className="flex-1 h-px bg-slate-800" />
                            <span className="text-xs text-slate-600 font-medium">New to PTS?</span>
                            <div className="flex-1 h-px bg-slate-800" />
                        </div>

                        {/* Register CTA */}
                        <a
                            href="/register"
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors text-sm"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                            Create an Account
                        </a>

                        <p className="text-center text-[10px] text-slate-700 mt-6">
                            Access is logged &amp; monitored. Misuse triggers automatic suspension.
                        </p>
                    </div>
                </div>

                {/* Back to home */}
                <div className="text-center mt-5">
                    <a href="/" className="text-xs text-slate-600 hover:text-slate-400 transition-colors font-medium">← Back to PTS Sentinel Home</a>
                </div>
            </div>
        </div>
    );
}

function Spinner() {
    return (
        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
    );
}
