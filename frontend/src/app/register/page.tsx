'use client';

import { useState, useEffect } from 'react';
import FaceCapture from '@/components/FaceCapture';
import RegulaDocumentScanner from '@/components/RegulaDocumentScanner';
import { getHighAccuracyLocation, reverseGeocode } from '@/lib/ptsGeolocation';

type AccountType = 'CONSUMER' | 'VENDOR' | null;

// ─── Shared helpers ───────────────────────────────────────────────────────────
const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'https://pts-backend-api.vercel.app/api/v1');

async function uploadFile(file: File, setUploading: (t: string | null) => void, setError: (e: string) => void): Promise<string | null> {
    setUploading(file.name);
    try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${apiUrl}/upload/document`, { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data.url;
    } catch (err: any) {
        setError(`Upload failed: ${err.message}`);
        return null;
    } finally {
        setUploading(null);
    }
}

function Spinner() {
    return (
        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
    );
}

// ─── OTP Verification screen (shared) ────────────────────────────────────────
function OtpStep({ email, setError, setSuccessMsg, successMsg, error }: {
    email: string;
    setError: (e: string) => void;
    setSuccessMsg: (m: string) => void;
    successMsg: string;
    error: string;
}) {
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${apiUrl}/auth/verify-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setSuccessMsg(data.message || 'Email verified successfully!');
            setDone(true);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (done) {
        return (
            <div className="text-center space-y-4 py-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-xl font-bold text-white">Registration Complete!</h3>
                <p className="text-slate-400 text-sm">{successMsg || 'Your account has been created.'}</p>
                <p className="text-xs text-slate-500">Pending admin verification of documents before full access.</p>
                <a href="/login" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl transition-colors text-sm">
                    Proceed to Login →
                </a>
            </div>
        );
    }

    return (
        <form onSubmit={handleVerify} className="space-y-5">
            {error && <p className="text-red-400 bg-red-500/10 border border-red-500/20 text-sm p-3 rounded-xl text-center">{error}</p>}
            {successMsg && <p className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 text-sm p-3 rounded-xl text-center">{successMsg}</p>}
            <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Verification Code (OTP)</label>
                <input
                    type="text"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="· · · · · ·"
                    className="w-full bg-slate-950/60 border border-slate-700/60 rounded-xl px-4 py-4 text-white text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                    required
                    maxLength={6}
                />
                <p className="text-[11px] text-slate-500 mt-2 text-center">Code sent to {email}. Contact admin if not received.</p>
            </div>
            <button type="submit" disabled={loading || otp.length < 6} className="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-blue-500 to-violet-600 hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                {loading && <Spinner />}
                Complete Verification
            </button>
        </form>
    );
}

// ─── Consumer Registration form ───────────────────────────────────────────────
function ConsumerRegisterForm({ onOtp, onSuccessMsg }: { onOtp: (email: string) => void; onSuccessMsg: (m: string) => void }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [nationalId, setNationalId] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [address, setAddress] = useState('');
    const [facialFile, setFacialFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) { setError('Passwords do not match'); return; }
        setLoading(true);
        setError('');

        let facialDataUrl = '';
        if (facialFile) {
            const url = await uploadFile(facialFile, setUploading, setError);
            if (!url) { setLoading(false); return; }
            facialDataUrl = url;
        }

        try {
            const res = await fetch(`${apiUrl}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, role: 'CONSUMER', fullName, nationalId, facialDataUrl, phoneNumber, address }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            if (data.requiresOtp) {
                onSuccessMsg(data.message || 'OTP sent to your email.');
                onOtp(email);
            } else {
                onSuccessMsg(data.message || 'Registration complete!');
                onOtp(email);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-red-400 bg-red-500/10 border border-red-500/20 text-sm p-3 rounded-xl text-center">{error}</p>}

            <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Full Legal Name *</label>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Doe" className="w-full bg-slate-950/60 border border-slate-700/60 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all" required />
            </div>

            <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">National ID (NIN) *</label>
                <input type="text" value={nationalId} onChange={e => setNationalId(e.target.value)} placeholder="12345678901" className="w-full bg-slate-950/60 border border-slate-700/60 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all" />
                <div className="mt-2">
                    <RegulaDocumentScanner onExtracted={(d: { fullName: string; nationalId: string }) => { setFullName(d.fullName); setNationalId(d.nationalId); }} />
                </div>
            </div>

            <div>
                <FaceCapture onCapture={setFacialFile} label="Identity Selfie (Live Capture)" />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Email *</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" className="w-full bg-slate-950/60 border border-slate-700/60 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all" required />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Phone *</label>
                    <input type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="+234..." className="w-full bg-slate-950/60 border border-slate-700/60 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all" required />
                </div>
            </div>

            <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Residential Address *</label>
                <textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="Full residential address" className="w-full bg-slate-950/60 border border-slate-700/60 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all h-16" required />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Password *</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-slate-950/60 border border-slate-700/60 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all" required />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Confirm *</label>
                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" className="w-full bg-slate-950/60 border border-slate-700/60 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all" required />
                </div>
            </div>

            <button type="submit" disabled={loading || !!uploading} className="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-500 to-cyan-600 hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-2">
                {(loading || uploading) && <Spinner />}
                {uploading ? 'Uploading...' : loading ? 'Creating Account...' : 'Create Device Owner Account →'}
            </button>
        </form>
    );
}

// ─── Vendor Registration form (multi-step) ────────────────────────────────────
function VendorRegisterForm({ onOtp, onSuccessMsg }: { onOtp: (email: string) => void; onSuccessMsg: (m: string) => void }) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [uploading, setUploading] = useState<string | null>(null);

    // Step 1
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [nationalId, setNationalId] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [facialFile, setFacialFile] = useState<File | null>(null);
    const [facialDataUrl, setFacialDataUrl] = useState('');

    // Step 2
    const [companyName, setCompanyName] = useState('');
    const [businessAddress, setBusinessAddress] = useState('');
    const [businessRegNo, setBusinessRegNo] = useState('');
    const [shopLatitude, setShopLatitude] = useState('');
    const [shopLongitude, setShopLongitude] = useState('');
    const [shopAddress, setShopAddress] = useState('');
    const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
    const [locationStatus, setLocationStatus] = useState<'idle' | 'locating' | 'done' | 'error'>('idle');

    // Step 3
    const [shopPhotoUrl, setShopPhotoUrl] = useState('');
    const [cacCertificateUrl, setCacCertificateUrl] = useState('');

    const getLocation = async () => {
        setLocationStatus('locating');
        setError('');
        try {
            const pos = await getHighAccuracyLocation();
            const { latitude, longitude, accuracy } = pos.coords;
            setShopLatitude(latitude.toString());
            setShopLongitude(longitude.toString());
            setLocationAccuracy(accuracy);
            const addr = await reverseGeocode(latitude, longitude);
            setShopAddress(addr);
            setLocationStatus('done');
        } catch {
            setLocationStatus('error');
            setError('Location access denied. Enter coordinates manually.');
        }
    };

    const handleSubmit = async () => {
        if (password !== confirmPassword) { setError('Passwords do not match'); return; }
        setLoading(true);
        setError('');
        try {
            let faceUrl = facialDataUrl;
            if (facialFile && !faceUrl) {
                const url = await uploadFile(facialFile, setUploading, setError);
                if (!url) { setLoading(false); return; }
                faceUrl = url;
                setFacialDataUrl(url);
            }

            const res = await fetch(`${apiUrl}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email, password, fullName, nationalId, companyName,
                    businessAddress, businessRegNo, shopPhotoUrl, cacCertificateUrl,
                    shopLatitude, shopLongitude, role: 'VENDOR', phoneNumber, facialDataUrl: faceUrl,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            if (data.requiresOtp) {
                onSuccessMsg(data.message || 'OTP sent to your email.');
                onOtp(email);
            } else {
                onSuccessMsg(data.message || 'Registration submitted for review!');
                onOtp(email);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const steps = ['Account', 'Business', 'Documents'];

    return (
        <div>
            {/* Progress */}
            <div className="flex items-center justify-center gap-2 mb-6">
                {steps.map((label, idx) => {
                    const s = idx + 1;
                    const active = step >= s;
                    return (
                        <div key={s} className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${active ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'}`}>{s}</div>
                            <span className={`text-xs font-semibold hidden sm:block ${active ? 'text-slate-300' : 'text-slate-600'}`}>{label}</span>
                            {s < 3 && <div className={`w-8 h-px transition-all ${step > s ? 'bg-blue-500' : 'bg-slate-700'}`} />}
                        </div>
                    );
                })}
            </div>

            {error && <p className="mb-4 text-red-400 bg-red-500/10 border border-red-500/20 text-sm p-3 rounded-xl text-center">{error}</p>}

            {/* Step 1 */}
            {step === 1 && (
                <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-3">Account Details</h3>
                    <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Full Name *</label>
                        <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="John Doe" className="w-full bg-slate-950/60 border border-slate-700/60 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all" required />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">National ID (NIN) *</label>
                        <input type="text" value={nationalId} onChange={e => setNationalId(e.target.value)} placeholder="12345678901" className="w-full bg-slate-950/60 border border-slate-700/60 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all" />
                        <div className="mt-2">
                            <RegulaDocumentScanner onExtracted={(d: { fullName: string; nationalId: string }) => { setFullName(d.fullName); setNationalId(d.nationalId); }} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 mb-1">Email *</label>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="vendor@biz.com" className="w-full bg-slate-950/60 border border-slate-700/60 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all" required />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 mb-1">Phone *</label>
                            <input type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="+234..." className="w-full bg-slate-950/60 border border-slate-700/60 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all" required />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 mb-1">Password *</label>
                            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-slate-950/60 border border-slate-700/60 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all" required />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 mb-1">Confirm *</label>
                            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" className="w-full bg-slate-950/60 border border-slate-700/60 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all" required />
                        </div>
                    </div>
                    <button onClick={() => { if (!email || !password || !fullName) { setError('Fill all required fields'); return; } setError(''); setStep(2); }} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl mt-2 transition-colors">
                        Next: Business Info →
                    </button>
                </div>
            )}

            {/* Step 2 */}
            {step === 2 && (
                <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-3">Business Information</h3>
                    <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Business / Shop Name *</label>
                        <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="TechZone Mobile Store" className="w-full bg-slate-950/60 border border-slate-700/60 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all" required />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Business Address *</label>
                        <input type="text" value={businessAddress} onChange={e => setBusinessAddress(e.target.value)} placeholder="15 Marina Road, Lagos Island" className="w-full bg-slate-950/60 border border-slate-700/60 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all" required />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">CAC / Business Reg. No.</label>
                        <input type="text" value={businessRegNo} onChange={e => setBusinessRegNo(e.target.value)} placeholder="RC-1234567" className="w-full bg-slate-950/60 border border-slate-700/60 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Shop GPS Location</label>
                        <div className="flex gap-2 mb-2">
                            <input type="text" value={shopLatitude} onChange={e => setShopLatitude(e.target.value)} placeholder="Latitude" className="flex-1 bg-slate-950/60 border border-slate-700/60 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 transition-all" />
                            <input type="text" value={shopLongitude} onChange={e => setShopLongitude(e.target.value)} placeholder="Longitude" className="flex-1 bg-slate-950/60 border border-slate-700/60 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 transition-all" />
                        </div>
                        <button type="button" onClick={getLocation} disabled={locationStatus === 'locating'} className="w-full text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-slate-300 py-2.5 rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-2">
                            📍 {locationStatus === 'locating' ? 'Acquiring GPS Fix...' : 'Use My Current Location'}
                        </button>
                        {locationStatus === 'done' && shopAddress && (
                            <div className="mt-2 p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                                <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-1">📍 Confirmed</p>
                                <p className="text-xs text-slate-300">{shopAddress}</p>
                                {locationAccuracy !== null && <p className="text-[10px] text-slate-500 mt-1">±{locationAccuracy.toFixed(0)}m accuracy</p>}
                            </div>
                        )}
                    </div>
                    <div className="flex gap-3 mt-2">
                        <button onClick={() => setStep(1)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-colors text-sm">← Back</button>
                        <button onClick={() => { if (!companyName || !businessAddress) { setError('Business name and address required'); return; } setError(''); setStep(3); }} className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition-colors text-sm">Next: Documents →</button>
                    </div>
                </div>
            )}

            {/* Step 3 */}
            {step === 3 && (
                <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-3">Business Documents</h3>

                    {/* Shop Photo */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Shop Physical Photo *</label>
                        {shopPhotoUrl ? (
                            <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                <span className="text-xs text-emerald-400 font-medium">Photo uploaded ✓</span>
                            </div>
                        ) : (
                            <label className={`block w-full p-4 bg-slate-950/50 border-2 border-dashed border-slate-700 rounded-xl text-center cursor-pointer hover:border-blue-500/50 transition-colors ${uploading === 'shop' ? 'opacity-50' : ''}`}>
                                <input type="file" accept="image/*" className="hidden" onChange={async (e) => { if (e.target.files?.[0]) { const url = await uploadFile(e.target.files[0], (t) => setUploading(t ? 'shop' : null), setError); if (url) setShopPhotoUrl(url); } }} />
                                <svg className="w-8 h-8 text-slate-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                <span className="text-xs text-slate-400">{uploading === 'shop' ? 'Uploading...' : 'Click to upload shop photo'}</span>
                            </label>
                        )}
                    </div>

                    {/* CAC */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">CAC Certificate *</label>
                        {cacCertificateUrl ? (
                            <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                <span className="text-xs text-emerald-400 font-medium">Certificate uploaded ✓</span>
                            </div>
                        ) : (
                            <label className={`block w-full p-4 bg-slate-950/50 border-2 border-dashed border-slate-700 rounded-xl text-center cursor-pointer hover:border-blue-500/50 transition-colors ${uploading === 'cac' ? 'opacity-50' : ''}`}>
                                <input type="file" accept="image/*,.pdf" className="hidden" onChange={async (e) => { if (e.target.files?.[0]) { const url = await uploadFile(e.target.files[0], (t) => setUploading(t ? 'cac' : null), setError); if (url) setCacCertificateUrl(url); } }} />
                                <svg className="w-8 h-8 text-slate-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                <span className="text-xs text-slate-400">{uploading === 'cac' ? 'Uploading...' : 'Click to upload CAC cert (JPG, PNG, PDF)'}</span>
                            </label>
                        )}
                    </div>

                    {/* Face Capture */}
                    <div>
                        <FaceCapture onCapture={async (file) => {
                            setFacialFile(file);
                            const url = await uploadFile(file, setUploading, setError);
                            if (url) setFacialDataUrl(url);
                        }} label="Owner Face Verification (Live Capture) *" />
                    </div>

                    <div className="flex gap-3 mt-2">
                        <button onClick={() => setStep(2)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-colors text-sm">← Back</button>
                        <button onClick={handleSubmit} disabled={loading || !!uploading} className="flex-1 bg-gradient-to-r from-emerald-600 to-blue-600 hover:opacity-90 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
                            {(loading || uploading) && <Spinner />}
                            {loading ? 'Submitting...' : 'Submit Registration'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function UnifiedRegister() {
    const [accountType, setAccountType] = useState<AccountType>(null);
    const [isOtpStep, setIsOtpStep] = useState(false);
    const [otpEmail, setOtpEmail] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [error, setError] = useState('');
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const handleOtp = (email: string) => { setOtpEmail(email); setIsOtpStep(true); };

    const accentClass = accountType === 'VENDOR'
        ? 'from-blue-500 via-purple-500 to-indigo-600'
        : accountType === 'CONSUMER'
            ? 'from-emerald-400 via-teal-500 to-cyan-600'
            : 'from-blue-500 via-indigo-500 to-violet-600';

    if (!mounted) return null;

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/6 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-600/6 rounded-full blur-3xl pointer-events-none" />

            <div className="w-full max-w-lg relative">
                <div className="bg-slate-900/90 border border-slate-800/80 rounded-3xl shadow-2xl shadow-black/40 backdrop-blur-xl overflow-hidden">
                    <div className={`h-[3px] w-full bg-gradient-to-r ${accentClass} transition-all duration-500`} />

                    <div className="p-8">
                        {/* Header */}
                        <div className="flex flex-col items-center mb-7">
                            <div className={`w-13 h-13 w-14 h-14 rounded-2xl bg-gradient-to-br ${accentClass} flex items-center justify-center font-black text-white text-xl tracking-tighter shadow-xl shadow-blue-500/25 mb-4`}>
                                PTS
                            </div>
                            <h1 className="text-2xl font-extrabold text-white tracking-tight">
                                {isOtpStep ? 'Verify Your Email' : accountType ? (accountType === 'VENDOR' ? 'Vendor Registration' : 'Device Owner Registration') : 'Create Your Account'}
                            </h1>
                            <p className="text-slate-500 text-sm mt-1 text-center">
                                {isOtpStep ? `Code sent to ${otpEmail}` : accountType ? 'Fill in your details below' : 'Choose the account type that applies to you'}
                            </p>
                        </div>

                        {/* OTP Step */}
                        {isOtpStep ? (
                            <OtpStep
                                email={otpEmail}
                                setError={setError}
                                setSuccessMsg={setSuccessMsg}
                                successMsg={successMsg}
                                error={error}
                            />
                        ) : !accountType ? (
                            /* ── Account type selector ─────────────────────────── */
                            <div className="space-y-4">
                                <p className="text-center text-xs text-slate-500 font-medium uppercase tracking-widest mb-5">I am registering as a…</p>

                                {/* Device Owner */}
                                <button
                                    onClick={() => setAccountType('CONSUMER')}
                                    className="w-full group flex items-center gap-5 bg-slate-800/50 hover:bg-emerald-500/10 border border-slate-700/60 hover:border-emerald-500/40 rounded-2xl p-5 transition-all duration-200 text-left"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                    </div>
                                    <div>
                                        <p className="font-bold text-white group-hover:text-emerald-300 transition-colors">Device Owner</p>
                                        <p className="text-xs text-slate-500 mt-0.5">Register your phone, manage ownership certificates &amp; report theft</p>
                                    </div>
                                    <svg className="w-5 h-5 text-slate-600 group-hover:text-emerald-400 ml-auto shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                </button>

                                {/* Vendor */}
                                <button
                                    onClick={() => setAccountType('VENDOR')}
                                    className="w-full group flex items-center gap-5 bg-slate-800/50 hover:bg-blue-500/10 border border-slate-700/60 hover:border-blue-500/40 rounded-2xl p-5 transition-all duration-200 text-left"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                    </div>
                                    <div>
                                        <p className="font-bold text-white group-hover:text-blue-300 transition-colors">Certified Vendor / Merchant</p>
                                        <p className="text-xs text-slate-500 mt-0.5">Register your business to sell &amp; register devices on the PTS platform</p>
                                    </div>
                                    <svg className="w-5 h-5 text-slate-600 group-hover:text-blue-400 ml-auto shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                </button>


                            </div>
                        ) : (
                            /* ── Registration Form ────────────────────────────── */
                            <div>
                                <button
                                    onClick={() => setAccountType(null)}
                                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors mb-5 font-medium"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                    Change account type
                                </button>

                                {accountType === 'CONSUMER' ? (
                                    <ConsumerRegisterForm onOtp={handleOtp} onSuccessMsg={setSuccessMsg} />
                                ) : (
                                    <VendorRegisterForm onOtp={handleOtp} onSuccessMsg={setSuccessMsg} />
                                )}
                            </div>
                        )}

                        {/* Footer links */}
                        {!isOtpStep && (
                            <p className="text-center text-xs text-slate-600 mt-6">
                                Already have an account?{' '}
                                <a href="/login" className="text-blue-400 hover:text-blue-300 font-bold transition-colors">Sign In</a>
                            </p>
                        )}
                    </div>
                </div>

                <div className="text-center mt-5">
                    <a href="/" className="text-xs text-slate-600 hover:text-slate-400 transition-colors font-medium">← Back to PTS Sentinel Home</a>
                </div>
            </div>
        </div>
    );
}
