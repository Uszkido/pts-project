'use client';
import { useState } from 'react';

export default function VendorRegister() {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [uploading, setUploading] = useState<string | null>(null);

    // Step 1: Account
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [nationalId, setNationalId] = useState('');

    // Step 2: Business
    const [companyName, setCompanyName] = useState('');
    const [businessAddress, setBusinessAddress] = useState('');
    const [businessRegNo, setBusinessRegNo] = useState('');
    const [shopLatitude, setShopLatitude] = useState('');
    const [shopLongitude, setShopLongitude] = useState('');

    // Step 3: Documents
    const [shopPhotoUrl, setShopPhotoUrl] = useState('');
    const [cacCertificateUrl, setCacCertificateUrl] = useState('');

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

    const uploadFile = async (file: File, type: string) => {
        setUploading(type);
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
    };

    const getLocation = () => {
        if (!navigator.geolocation) { setError('Geolocation not supported'); return; }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setShopLatitude(pos.coords.latitude.toString());
                setShopLongitude(pos.coords.longitude.toString());
            },
            () => setError('Location access denied. Enter coordinates manually.')
        );
    };

    const handleSubmit = async () => {
        if (password !== confirmPassword) { setError('Passwords do not match'); return; }
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${apiUrl.replace('/api/v1', '')}/api/v1/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email, password, fullName, nationalId, companyName,
                    businessAddress, businessRegNo, shopPhotoUrl, cacCertificateUrl,
                    shopLatitude, shopLongitude, role: 'VENDOR'
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setSuccess(data.message);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-slate-900 border border-emerald-500/20 rounded-3xl p-8 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Registration Submitted!</h2>
                    <p className="text-slate-400 mb-6">{success}</p>
                    <p className="text-sm text-slate-500 mb-4">An administrator will review your credentials and business documents. You'll be notified once your account is approved.</p>
                    <a href="/vendor/login" className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl transition-colors">Go to Login</a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500"></div>

                <div className="p-8">
                    <div className="flex justify-center mb-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-600/20 text-blue-500 flex items-center justify-center font-black text-lg border border-blue-500/30">PTS</div>
                    </div>
                    <h2 className="text-2xl font-bold text-white text-center mb-1">Vendor Registration</h2>
                    <p className="text-slate-400 text-sm text-center mb-6">Register your business to sell verified devices</p>

                    {/* Progress Steps */}
                    <div className="flex items-center justify-center gap-2 mb-8">
                        {[1, 2, 3].map(s => (
                            <div key={s} className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= s ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'}`}>{s}</div>
                                {s < 3 && <div className={`w-10 h-0.5 ${step > s ? 'bg-blue-500' : 'bg-slate-700'}`}></div>}
                            </div>
                        ))}
                    </div>

                    {error && <p className="mb-4 text-red-400 bg-red-500/10 p-3 rounded-lg text-sm text-center border border-red-500/20 font-medium">{error}</p>}

                    {/* Step 1: Account Info */}
                    {step === 1 && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider mb-4">Account Details</h3>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Full Name *</label>
                                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="John Doe" className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors" required />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Email Address *</label>
                                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="vendor@business.com" className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors" required />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">National ID (NIN) *</label>
                                <input type="text" value={nationalId} onChange={e => setNationalId(e.target.value)} placeholder="12345678901" className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Password *</label>
                                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors" required />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Confirm *</label>
                                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors" required />
                                </div>
                            </div>
                            <button onClick={() => { if (!email || !password || !fullName) { setError('Please fill all required fields'); return; } setError(''); setStep(2); }} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl mt-4 transition-colors">Next: Business Info →</button>
                        </div>
                    )}

                    {/* Step 2: Business Info */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wider mb-4">Business Information</h3>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Business / Shop Name *</label>
                                <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="TechZone Mobile Store" className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors" required />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Business Address *</label>
                                <input type="text" value={businessAddress} onChange={e => setBusinessAddress(e.target.value)} placeholder="15 Marina Road, Lagos Island, Lagos" className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors" required />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">CAC / Business Registration No.</label>
                                <input type="text" value={businessRegNo} onChange={e => setBusinessRegNo(e.target.value)} placeholder="RC-1234567" className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Shop Location on Map</label>
                                <div className="flex gap-2">
                                    <input type="text" value={shopLatitude} onChange={e => setShopLatitude(e.target.value)} placeholder="Latitude" className="flex-1 bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors" />
                                    <input type="text" value={shopLongitude} onChange={e => setShopLongitude(e.target.value)} placeholder="Longitude" className="flex-1 bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors" />
                                </div>
                                <button type="button" onClick={getLocation} className="mt-2 w-full text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-2">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    📍 Use My Current Location
                                </button>
                            </div>
                            <div className="flex gap-3 mt-4">
                                <button onClick={() => setStep(1)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-colors">← Back</button>
                                <button onClick={() => { if (!companyName || !businessAddress) { setError('Business name and address are required'); return; } setError(''); setStep(3); }} className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition-colors">Next: Documents →</button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Documents */}
                    {step === 3 && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-4">Business Documents</h3>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Shop Physical Photo *</label>
                                {shopPhotoUrl ? (
                                    <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                        <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        <span className="text-xs text-emerald-400 font-medium truncate">Photo uploaded</span>
                                    </div>
                                ) : (
                                    <label className={`block w-full p-4 bg-slate-950/50 border-2 border-dashed border-slate-700 rounded-xl text-center cursor-pointer hover:border-blue-500/50 transition-colors ${uploading === 'shop' ? 'opacity-50' : ''}`}>
                                        <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                            if (e.target.files?.[0]) { const url = await uploadFile(e.target.files[0], 'shop'); if (url) setShopPhotoUrl(url); }
                                        }} />
                                        <svg className="w-8 h-8 text-slate-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        <span className="text-xs text-slate-400">{uploading === 'shop' ? 'Uploading...' : 'Click to upload shop photo'}</span>
                                    </label>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">CAC Certificate *</label>
                                {cacCertificateUrl ? (
                                    <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                        <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        <span className="text-xs text-emerald-400 font-medium truncate">Certificate uploaded</span>
                                    </div>
                                ) : (
                                    <label className={`block w-full p-4 bg-slate-950/50 border-2 border-dashed border-slate-700 rounded-xl text-center cursor-pointer hover:border-blue-500/50 transition-colors ${uploading === 'cac' ? 'opacity-50' : ''}`}>
                                        <input type="file" accept="image/*,.pdf" className="hidden" onChange={async (e) => {
                                            if (e.target.files?.[0]) { const url = await uploadFile(e.target.files[0], 'cac'); if (url) setCacCertificateUrl(url); }
                                        }} />
                                        <svg className="w-8 h-8 text-slate-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                        <span className="text-xs text-slate-400">{uploading === 'cac' ? 'Uploading...' : 'Click to upload CAC certificate (JPG, PNG, PDF)'}</span>
                                    </label>
                                )}
                            </div>
                            <div className="flex gap-3 mt-4">
                                <button onClick={() => setStep(2)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-colors">← Back</button>
                                <button onClick={handleSubmit} disabled={loading} className="flex-1 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50">
                                    {loading ? 'Submitting...' : 'Submit Registration'}
                                </button>
                            </div>
                        </div>
                    )}

                    <p className="text-center mt-6 text-xs text-slate-600">Already registered? <a href="/vendor/login" className="text-blue-400 hover:text-blue-300">Sign in</a></p>
                </div>
            </div>
        </div>
    );
}
