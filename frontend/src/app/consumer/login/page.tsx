"use client";

import { useState } from 'react';
import FaceCapture from '@/components/FaceCapture';

export default function ConsumerLogin() {
    const [isLogin, setIsLogin] = useState(true);
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // Identity fields
    const [fullName, setFullName] = useState('');
    const [nationalId, setNationalId] = useState('');
    const [facialFile, setFacialFile] = useState<File | null>(null);
    const [confirmPassword, setConfirmPassword] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [address, setAddress] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isOtpStep, setIsOtpStep] = useState(false);
    const [otp, setOtp] = useState('');
    const [otpType, setOtpType] = useState<'REGISTER' | 'RESET'>('REGISTER');

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');
        setSuccessMsg('');

        if ((!isLogin || isForgotPassword) && password !== confirmPassword && newPassword !== confirmPassword) {
            setError('Passwords do not match');
            setIsSubmitting(false);
            return;
        }

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

            if (isForgotPassword) {
                const res = await fetch(`${apiUrl.replace('/api/v1', '')}/api/v1/auth/reset-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, newPassword })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);

                setSuccessMsg(data.message);
                if (data.requiresOtp) {
                    setIsOtpStep(true);
                    setOtpType('RESET');
                } else {
                    setIsForgotPassword(false);
                    setPassword('');
                    setNewPassword('');
                }
                return; // Wait for OTP or end
            }

            let facialDataUrl = '';
            if (!isLogin && facialFile) {
                // Upload facial data first
                const formData = new FormData();
                formData.append('file', facialFile);

                const uploadRes = await fetch(`${apiUrl.replace('/api/v1', '')}/api/v1/upload/document`, {
                    method: 'POST',
                    body: formData
                });
                const uploadData = await uploadRes.json();
                if (!uploadRes.ok) throw new Error(uploadData.error || 'Failed to upload facial data');
                facialDataUrl = uploadData.url;
            }

            const endpoint = isLogin ? '/api/v1/auth/login' : '/api/v1/auth/register';
            const body = isLogin
                ? { email, password }
                : { email, password, role: 'CONSUMER', fullName, nationalId, facialDataUrl, phoneNumber, address };

            const res = await fetch(`${apiUrl.replace('/api/v1', '')}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            if (data.requiresOtp) {
                setSuccessMsg(data.message);
                setIsOtpStep(true);
                setOtpType(isLogin ? 'REGISTER' : 'REGISTER'); // Both use email verification
                return;
            }

            if (!isLogin) {
                // Automatically log them in after registration
                const loginRes = await fetch(`${apiUrl.replace('/api/v1', '')}/api/v1/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const loginData = await loginRes.json();
                if (!loginRes.ok && loginData.requiresOtp) {
                    setSuccessMsg(loginData.error);
                    setIsOtpStep(true);
                    setOtpType('REGISTER');
                    return;
                }
                localStorage.setItem('pts_token', loginData.token);
            } else {
                localStorage.setItem('pts_token', data.token);
            }

            window.location.href = '/consumer/dashboard';
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
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const endpoint = otpType === 'REGISTER' ? '/api/v1/auth/verify-email' : '/api/v1/auth/verify-reset-otp';
            const res = await fetch(`${apiUrl.replace('/api/v1', '')}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setSuccessMsg(data.message);
            setIsOtpStep(false);
            setOtp('');
            if (otpType === 'REGISTER') {
                setIsLogin(true);
            } else {
                // For password reset, after OTP is verified, wait for admin final approval or show success
                setIsForgotPassword(false);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-cyan-500"></div>
                <div className="flex justify-center mb-6">
                    <div className="w-14 h-14 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-2xl border border-emerald-500/30 shadow-lg shadow-emerald-500/20">PTS</div>
                </div>
                <h2 className="text-2xl font-bold text-white text-center mb-2">{isOtpStep ? 'Verify OTP' : isForgotPassword ? 'Reset Password' : isLogin ? 'Device Owner Login' : 'Create Device Owner ID'}</h2>
                <p className="text-slate-400 text-sm text-center mb-8">{isOtpStep ? 'Enter the 6-digit code sent to your email (or provided by admin)' : isForgotPassword ? 'Enter your email and a new password' : 'Access your Digital Device Ownership Certificates'}</p>

                {error && <p className="mb-4 text-red-400 bg-red-500/10 p-3 rounded-lg text-sm text-center border border-red-500/20 font-medium">{error}</p>}
                {successMsg && <p className="mb-4 text-emerald-400 bg-emerald-500/10 p-3 rounded-lg text-sm text-center border border-emerald-500/20 font-medium">{successMsg}</p>}

                {isOtpStep ? (
                    <form onSubmit={handleVerifyOtp} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">One-Time Password (OTP)</label>
                            <input type="text" value={otp} onChange={e => setOtp(e.target.value)} placeholder="123456" className="w-full bg-slate-950/50 border border-slate-700/50 hover:border-slate-600 rounded-xl px-4 py-3.5 text-white text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors" required maxLength={6} />
                        </div>
                        <button type="submit" disabled={isSubmitting} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-4 rounded-xl mt-6 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2">
                            {isSubmitting && <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                            Verify Identity
                        </button>
                        <button type="button" onClick={() => setIsOtpStep(false)} className="w-full text-slate-400 hover:text-white transition-colors text-sm font-medium">
                            Back
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleAuth} className="space-y-5">
                        {!isLogin && !isForgotPassword && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Full Legal Name</label>
                                    <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Doe" className="w-full bg-slate-950/50 border border-slate-700/50 hover:border-slate-600 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors" required={!isLogin && !isForgotPassword} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">National ID Number</label>
                                    <input type="text" value={nationalId} onChange={e => setNationalId(e.target.value)} placeholder="NIN / SSN" className="w-full bg-slate-950/50 border border-slate-700/50 hover:border-slate-600 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors" required={!isLogin && !isForgotPassword} />
                                </div>
                                <div>
                                    <FaceCapture onCapture={setFacialFile} label="Identity Verification (Live Selfie)" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Phone Number</label>
                                    <input type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="+234..." className="w-full bg-slate-950/50 border border-slate-700/50 hover:border-slate-600 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors" required={!isLogin && !isForgotPassword} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Physical Address</label>
                                    <textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="Full residential address" className="w-full bg-slate-950/50 border border-slate-700/50 hover:border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors h-20" required={!isLogin && !isForgotPassword} />
                                </div>
                            </>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email Address</label>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" className="w-full bg-slate-950/50 border border-slate-700/50 hover:border-slate-600 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors" required />
                        </div>
                        {isForgotPassword ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">New Password</label>
                                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" className="w-full bg-slate-950/50 border border-slate-700/50 hover:border-slate-600 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors" required minLength={6} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm New Password</label>
                                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" className="w-full bg-slate-950/50 border border-slate-700/50 hover:border-slate-600 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors" required minLength={6} />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-slate-950/50 border border-slate-700/50 hover:border-slate-600 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors" required />
                                </div>
                                {!isLogin && (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm Password</label>
                                        <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" className="w-full bg-slate-950/50 border border-slate-700/50 hover:border-slate-600 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors" required />
                                    </div>
                                )}
                            </div>
                        )}
                        <button type="submit" disabled={isSubmitting} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-4 rounded-xl mt-6 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2">
                            {isSubmitting && <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                            {isForgotPassword ? 'Reset Password' : isLogin ? 'Access Vault' : isSubmitting ? 'Verifying Identity...' : 'Create Vault Identity'}
                        </button>
                    </form>
                )}

                <div className="mt-6 text-center space-y-3 flex flex-col items-center">
                    {!isForgotPassword && isLogin && (
                        <button onClick={() => setIsForgotPassword(true)} className="text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors">
                            Forgot Password?
                        </button>
                    )}
                    <button onClick={() => { setIsLogin(!isLogin); setIsForgotPassword(false); }} className="text-sm font-medium text-slate-400 hover:text-white transition-colors">
                        {isLogin ? "Don't have a PTS Identity? Create one." : "Already have an account? Log in."}
                    </button>
                    {isForgotPassword && (
                        <button onClick={() => setIsForgotPassword(false)} className="text-sm font-medium text-slate-400 hover:text-white transition-colors">
                            Back to Login
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
