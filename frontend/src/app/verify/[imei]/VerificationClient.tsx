'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { generateCapSign } from '@/lib/capsign';

export default function VerificationClient() {
    const { imei } = useParams();
    const [status, setStatus] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const verifyDevice = async () => {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://pts-backend-api.vercel.app/api/v1';
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
        if (!status) return;
        setIsPrinting(true);
        try {
            const isClean = status.status === 'CLEAN';
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const W = pdf.internal.pageSize.getWidth();
            const H = pdf.internal.pageSize.getHeight();

            // Background
            pdf.setFillColor(0, 0, 0);
            pdf.rect(0, 0, W, H, 'F');

            // Accent bars
            const r = isClean ? 16 : 220, g = isClean ? 185 : 38, b = isClean ? 129 : 38;
            pdf.setFillColor(r, g, b);
            pdf.rect(0, 0, W, 8, 'F');
            pdf.rect(0, H - 8, W, 8, 'F');
            pdf.rect(0, 0, 4, H, 'F');

            // Header
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'bold');
            pdf.text('POLICE TRACKING SYSTEM — NATIONAL DEVICE REGISTRY', W / 2, 18, { align: 'center' });

            pdf.setFontSize(24);
            pdf.setTextColor(r, g, b);
            pdf.text(`DEVICE ${isClean ? 'VERIFIED CLEAN' : 'FLAGGED — DO NOT BUY'}`, W / 2, 32, { align: 'center' });

            pdf.setDrawColor(r, g, b);
            pdf.setLineWidth(0.4);
            pdf.line(14, 37, W - 14, 37);

            // Status badge
            pdf.setFontSize(8);
            pdf.setTextColor(100, 116, 139);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`REGISTRY STATUS: ${status.status}   |   TRUST INDEX: ${status.riskScore}/100`, W / 2, 45, { align: 'center' });

            const sig = await generateCapSign({ imei: status.imei, timestamp: Date.now(), type: 'VERIFICATION' });

            // Device info box
            pdf.setFillColor(15, 23, 42);
            pdf.setDrawColor(30, 41, 59);
            pdf.setLineWidth(0.5);
            pdf.roundedRect(14, 52, W - 28, 60, 2, 2, 'FD');

            const fields = [
                ['DEVICE', `${status.brand} ${status.model}`],
                ['IMEI NUMBER', status.imei],
                ['RESPONSIBLE ENTITY', status.registeredBy || 'N/A'],
                ['ESTIMATED VALUE', `₦${status.estimatedValue?.toLocaleString() || '0'} NGN`],
                ['REGISTRY SIGNATURE', sig],
                ['VERIFICATION DATE', new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })],
            ];
            let y = 64;
            fields.forEach(([label, value]) => {
                pdf.setFontSize(6); pdf.setTextColor(100, 116, 139); pdf.setFont('helvetica', 'bold');
                pdf.text(label, 20, y);
                pdf.setFontSize(label === 'REGISTRY SIGNATURE' ? 6 : 9);
                pdf.setTextColor(label === 'REGISTRY SIGNATURE' ? r : 255, label === 'REGISTRY SIGNATURE' ? g : 255, label === 'REGISTRY SIGNATURE' ? b : 255);
                pdf.setFont('helvetica', label === 'REGISTRY SIGNATURE' ? 'bold' : 'normal');
                pdf.text(String(value), 20, y + 5);
                y += 13;
            });

            // Advisory
            pdf.setFontSize(8);
            pdf.setTextColor(r, g, b);
            pdf.setFont('helvetica', 'bold');
            pdf.text('OFFICIAL DIRECTIVE:', 14, 122);
            pdf.setFontSize(7);
            pdf.setTextColor(200, 200, 200);
            pdf.setFont('helvetica', 'normal');
            const directive = isClean
                ? 'This device is verified CLEAN and available for legitimate ownership transfer. Ensure 2FA Handover Code is used for physical delivery.'
                : 'This device is flagged in the National Tracking System. Acquisition is illegal and will trigger a geolocation signal to local authorities.';
            const lines = pdf.splitTextToSize(directive, W - 28);
            pdf.text(lines, 14, 129);

            // Verify URL
            pdf.setDrawColor(r, g, b);
            pdf.setLineWidth(0.3);
            pdf.line(14, 148, W - 14, 148);
            pdf.setFontSize(7); pdf.setTextColor(100, 116, 139);
            pdf.text('VERIFY ONLINE AT:', W / 2, 154, { align: 'center' });
            pdf.setFontSize(8); pdf.setTextColor(r, g, b);
            pdf.text(`https://pts-vexel.vercel.app/verify/${status.imei}`, W / 2, 160, { align: 'center' });

            // Footer
            pdf.setFontSize(6); pdf.setTextColor(71, 85, 105);
            pdf.text('Cryptographically signed by PTS Central Authority. Any tampering voids this document.', W / 2, H - 14, { align: 'center' });
            pdf.setTextColor(100, 116, 139);
            pdf.text('© VEXEL INNOVATIONS 2026 — SENTINEL AI REGISTRY', W / 2, H - 10, { align: 'center' });

            pdf.save(`PTS_VERIFICATION_${status.imei}.pdf`);
        } catch (err) {
            console.error('Print failed:', err);
            alert('PDF generation failed. Please try again.');
        } finally {
            setIsPrinting(false);
        }
    };

    const handleSafeContact = async (e: React.FormEvent) => {
        e.preventDefault();
        setScLoading(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://pts-backend-api.vercel.app/api/v1';
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
                {/* Visual Content (Passport UI) */}
                <div className="grid grid-cols-1 gap-8">
                    <div className={`p-8 rounded-[3rem] border ${isClean ? 'bg-emerald-950/20 border-emerald-900/30' : 'bg-red-950/20 border-red-900/30'} backdrop-blur-3xl shadow-2xl transition-all duration-500`}>
                        <div className="flex justify-between items-start mb-10">
                            <div>
                                <span className={`text-[10px] font-black uppercase tracking-[0.3em] px-3 py-1 rounded-full ${isClean ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>PTS Official Record</span>
                                <h1 className="text-4xl font-black text-white mt-4 uppercase tracking-tighter">Asset Registry</h1>
                            </div>
                            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                                <span className="text-xl font-bold text-white">VXL</span>
                            </div>
                        </div>

                        <div className="space-y-6 mb-10">
                            <div className="flex justify-between items-center py-4 border-b border-white/5">
                                <span className="text-sm font-medium text-slate-400">Device</span>
                                <span className="text-lg font-black text-white">{status.brand} {status.model}</span>
                            </div>
                            <div className="flex justify-between items-center py-4 border-b border-white/5">
                                <span className="text-sm font-medium text-slate-400">IMEI Status</span>
                                <span className={`text-lg font-black ${isClean ? 'text-emerald-400' : 'text-red-500'}`}>{status.status}</span>
                            </div>
                            <div className="flex justify-between items-center py-4 border-b border-white/5">
                                <span className="text-sm font-medium text-slate-400">Registered By</span>
                                <span className="text-sm font-bold text-slate-300">{status.registeredBy || 'Private Consumer'}</span>
                            </div>
                        </div>

                        <button
                            onClick={printVerification}
                            disabled={isPrinting}
                            className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-sm transition-all duration-300 flex items-center justify-center gap-3 ${isClean ? 'bg-emerald-500 hover:bg-emerald-400 text-emerald-950 shadow-lg shadow-emerald-500/20' : 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20'}`}>
                            {isPrinting ? 'Sealing Passport...' : 'Obtain Official Passport'}
                        </button>
                    </div>

                    {/* Safe Contact Signal if stolen */}
                    {!isClean && !scSuccess && (
                        <div className="p-8 rounded-[3rem] bg-slate-900/50 border border-slate-800 backdrop-blur-xl">
                            <h2 className="text-xl font-black text-white uppercase mb-4">Alert Recovery Agent</h2>
                            <p className="text-sm text-slate-400 mb-6 font-medium leading-relaxed">If you have found this device or are currently viewing it, you can send an anonymous signal to the registered owner to facilitate recovery.</p>
                            <form onSubmit={handleSafeContact} className="space-y-4">
                                <textarea
                                    placeholder="Message to owner (e.g. I found this in Lagos, call me)"
                                    className="w-full bg-black/50 border border-white/10 rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-red-500/50 transition-colors"
                                    value={safeContactMsg}
                                    onChange={(e) => setSafeContactMsg(e.target.value)}
                                    rows={3}
                                />
                                <input
                                    placeholder="Your phone/email (optional)"
                                    className="w-full bg-black/50 border border-white/10 rounded-2xl p-4 text-sm text-white focus:outline-none"
                                    value={safeContactContact}
                                    onChange={(e) => setSafeContactContact(e.target.value)}
                                />
                                <button
                                    disabled={scLoading}
                                    className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold uppercase tracking-wider text-xs transition-colors">
                                    {scLoading ? 'Sending Signal...' : 'Send Safe Recovery Signal'}
                                </button>
                            </form>
                        </div>
                    )}

                    {scSuccess && (
                        <div className="p-8 rounded-[3rem] bg-emerald-500 text-emerald-950 border border-emerald-400 text-center">
                            <h3 className="text-lg font-black uppercase mb-1">Signal Dispatched</h3>
                            <p className="text-sm font-bold opacity-80">The owner has been notified via the PTS secure channel.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

