'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function VerificationPage() {
    const { imei } = useParams();
    const [status, setStatus] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const verifyDevice = async () => {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
                const res = await fetch(`${apiUrl}/devices/verify/${imei}`);
                const data = await res.json();

                if (!res.ok) {
                    setError(data.message || 'Verification failed');
                } else {
                    setStatus(data.device);
                }
            } catch (err) {
                setError('Registry uplink failed. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        if (imei) verifyDevice();
    }, [imei]);

    const [safeContactMsg, setSafeContactMsg] = useState('');
    const [safeContactContact, setSafeContactContact] = useState('');
    const [scLoading, setScLoading] = useState(false);
    const [scSuccess, setScSuccess] = useState(false);

    const certificateRef = useRef<HTMLDivElement>(null);
    const [isPrinting, setIsPrinting] = useState(false);

    const printVerification = async () => {
        setIsPrinting(true);
        try {
            if (certificateRef.current) {
                const canvas = await html2canvas(certificateRef.current, {
                    scale: 3,
                    useCORS: true,
                    backgroundColor: '#000000'
                });
                const imgData = canvas.toDataURL('image/png', 1.0);
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
                pdf.save(`PTS_VERIFICATION_${status.imei}.pdf`);
            }
        } catch (err) {
            console.error('Print failed:', err);
            alert('Failed to generate printable document.');
        } finally {
            setIsPrinting(false);
        }
    };

    const handleSafeContact = async (e: React.FormEvent) => {
        e.preventDefault();
        setScLoading(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const res = await fetch(`${apiUrl}/public/safe-contact/${imei}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: safeContactMsg, finderContact: safeContactContact })
            });
            if (!res.ok) throw new Error();
            setScSuccess(true);
        } catch (err) {
            alert('Failed to send contact signal.');
        } finally {
            setScLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-emerald-500 font-mono tracking-widest text-xs uppercase animate-pulse">Querying National Registry...</p>
                </div>
            </div>
        );
    }

    if (error || !status) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-6 text-center">
                <div className="max-w-md w-full py-12 px-8 bg-red-950/20 border border-red-900/40 rounded-[2.5rem] shadow-2xl backdrop-blur-xl">
                    <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                        <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                    <h1 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Registry Alert</h1>
                    <p className="text-red-400 font-medium mb-8">{error || 'This IMEI is not recognized in the official tracking system.'}</p>
                    <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800 text-xs text-slate-500 flex items-center gap-3">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Buying an unregistered device carries high risk of future blacklisting by telecom operators.
                    </div>
                </div>
            </div>
        );
    }

    const isClean = status.status === 'CLEAN';

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 sm:p-12 relative overflow-hidden">
            {/* Background Aesthetics */}
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-20 pointer-events-none transition-colors duration-1000 ${isClean ? 'bg-[radial-gradient(circle_at_center,_#10b98122_0%,_transparent_70%)]' : 'bg-[radial-gradient(circle_at_center,_#ef444422_0%,_transparent_70%)]'}`}></div>

            <div className="max-w-xl w-full relative z-10">
                {/* Header Decoration */}
                <div className="flex justify-center mb-8">
                    <span className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center shadow-2xl">
                        <span className="text-white font-black text-xs">PTS</span>
                    </span>
                </div>

                <div ref={certificateRef} className={`overflow-hidden rounded-[3rem] border transition-all duration-700 shadow-2xl shadow-black ${isClean ? 'bg-slate-950 border-emerald-900/50' : 'bg-slate-950 border-red-900/50'}`}>
                    {/* Status Banner */}
                    <div className={`py-12 text-center relative overflow-hidden ${isClean ? 'bg-emerald-500/5' : 'bg-red-500/5'}`}>
                        {/* Animated scan line */}
                        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-current to-transparent opacity-20 animate-[scan_3s_linear_infinite]" style={{ color: isClean ? '#10b981' : '#ef4444' }}></div>

                        <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 border-4 shadow-2xl animate-in zoom-in-50 duration-500 ${isClean ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                            {isClean ? (
                                <svg className="w-12 h-12 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            ) : (
                                <svg className="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            )}
                        </div>

                        <h1 className={`text-5xl font-black uppercase tracking-tighter mb-2 ${isClean ? 'text-emerald-400' : 'text-red-500'}`}>
                            {status.status}
                        </h1>
                        <p className={`text-xs font-bold uppercase tracking-[0.3em] ${isClean ? 'text-emerald-500/60' : 'text-red-500/60'}`}>
                            Registry Validation Result
                        </p>
                    </div>

                    <div className="p-8 sm:p-12 pt-10 space-y-10">
                        {/* Summary Grid */}
                        <div className="grid grid-cols-2 gap-8 border-b border-slate-900 pb-10">
                            <div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1.5">Asset Identity</p>
                                <h2 className="text-xl font-bold text-white leading-tight">{status.brand}</h2>
                                <p className="text-sm text-slate-400">{status.model}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1.5">Trust Score</p>
                                <div className="flex items-end justify-end gap-1">
                                    <span className={`text-4xl font-black leading-none ${status.riskScore >= 80 ? 'text-emerald-400' : status.riskScore >= 50 ? 'text-amber-400' : 'text-red-500'}`}>
                                        {status.riskScore}
                                    </span>
                                    <span className="text-sm font-bold text-slate-600 mb-1">/100</span>
                                </div>
                            </div>
                        </div>

                        {/* Detailed Specs */}
                        <div className="space-y-6">
                            <div className="flex justify-between items-center bg-slate-900/30 p-4 rounded-2xl border border-slate-800">
                                <span className="text-xs font-bold text-slate-500 uppercase">Registered IMEI</span>
                                <span className="text-sm font-mono text-white tracking-widest">{status.imei}</span>
                            </div>
                            <div className="flex justify-between items-center bg-slate-900/30 p-4 rounded-2xl border border-slate-800">
                                <span className="text-xs font-bold text-slate-500 uppercase">Responsible Entity</span>
                                <span className="text-sm font-bold text-white">{status.registeredBy}</span>
                            </div>
                            <div className="flex justify-between items-center bg-slate-900/30 p-4 rounded-2xl border border-slate-800">
                                <span className="text-xs font-bold text-slate-500 uppercase">Registry Ver</span>
                                <span className="text-[10px] font-mono font-black text-slate-600 uppercase tracking-tighter flex items-center gap-2">
                                    <div className={`w-1.5 h-1.5 rounded-full ${isClean ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                                    NATIONAL-V4.2.1-IMMUTABLE
                                </span>
                            </div>
                        </div>

                        {/* Safe Contact Form for LOST devices */}
                        {status.status === 'LOST' && !scSuccess && (
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-[2rem] p-8 mt-6">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                    </div>
                                    <div>
                                        <h3 className="text-white font-bold">Secure Recovery Channel</h3>
                                        <p className="text-xs text-amber-500/70 font-bold uppercase tracking-widest">Found this device? Notify the owner.</p>
                                    </div>
                                </div>
                                <form onSubmit={handleSafeContact} className="space-y-4">
                                    <textarea
                                        value={safeContactMsg}
                                        onChange={e => setSafeContactMsg(e.target.value)}
                                        placeholder="Where did you find it? (e.g. Near Alaba Market, Lagos)"
                                        required
                                        className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-amber-500 transition-all placeholder:text-slate-600 resize-none"
                                        rows={3}
                                    />
                                    <input
                                        type="text"
                                        value={safeContactContact}
                                        onChange={e => setSafeContactContact(e.target.value)}
                                        placeholder="Your Phone / Email (Optional)"
                                        className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-amber-500 transition-all placeholder:text-slate-600"
                                    />
                                    <button
                                        type="submit"
                                        disabled={scLoading}
                                        className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black py-4 rounded-2xl uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2"
                                    >
                                        {scLoading ? 'Transmitting...' : 'Send Recovery Signal'}
                                    </button>
                                </form>
                            </div>
                        )}

                        {scSuccess && (
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-[2rem] p-8 mt-6 text-center animate-in zoom-in-95 duration-500">
                                <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
                                    <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                </div>
                                <h3 className="text-white font-black uppercase tracking-tight">Signal Received</h3>
                                <p className="text-sm text-emerald-400/80 mt-2">The owner has been notified via their secure PTS terminal. Thank you for your integrity.</p>
                            </div>
                        )}

                        {/* Recommendation */}
                        <div className={`p-6 rounded-[2rem] border ${isClean ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-red-500/5 border-red-500/20 text-red-500'}`}>
                            <div className="flex gap-4">
                                <div className="mt-1">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                                </div>
                                <div className="text-sm">
                                    <p className="font-black uppercase tracking-wide mb-1">PTS Official Directive</p>
                                    <p className="opacity-70 leading-relaxed text-[10px]">
                                        {isClean
                                            ? "This device is verified as CLEAN and available for legitimate ownership transfer. Ensure 2FA Handover Code is used for physical delivery."
                                            : "This device is flagged in the National Tracking System. Acquisition of this property is highly illegal and will trigger an immediate geolocation signal to local authorities."
                                        }
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Export Passport Button */}
                        <button
                            onClick={printVerification}
                            disabled={isPrinting}
                            className={`w-full py-5 rounded-3xl font-black uppercase tracking-[0.2em] text-xs transition-all flex items-center justify-center gap-3 shadow-xl ${isClean ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20' : 'bg-red-600 hover:bg-red-500 text-white shadow-red-500/20'}`}
                        >
                            {isPrinting ? (
                                <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            )}
                            {isPrinting ? 'Authenticating...' : 'Export Official Passport'}
                        </button>
                    </div>
                </div>

                {/* Footer Disclaimer */}
                <p className="mt-10 text-center text-[10px] text-slate-600 font-bold uppercase tracking-[0.2em] px-10 leading-relaxed">
                    Identity validation cryptographically signed by <br />Phone Tracking System Central Authority • {new Date().getFullYear()}
                </p>
            </div>

            <style jsx global>{`
                @keyframes scan {
                    from { transform: translateY(-100px); opacity: 0; }
                    50% { opacity: 0.5; }
                    to { transform: translateY(400px); opacity: 0; }
                }
            `}</style>
        </div>
    );
}
