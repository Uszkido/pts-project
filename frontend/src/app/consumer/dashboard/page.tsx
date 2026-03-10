'use client';
import { useState, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function ConsumerDashboard() {
    const [devices, setDevices] = useState<any[]>([]);
    const [pastDevices, setPastDevices] = useState<any[]>([]);
    const [pendingTransfers, setPendingTransfers] = useState<any[]>([]);
    const [user, setUser] = useState<{ fullName?: string, email?: string } | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedPassport, setSelectedPassport] = useState<any[] | null>(null);
    const [isPassportOpen, setIsPassportOpen] = useState(false);
    const [passportLoading, setPassportLoading] = useState(false);
    const [selectedMaintenance, setSelectedMaintenance] = useState<any[] | null>(null);
    const [passportTab, setPassportTab] = useState<'chain' | 'service'>('chain');

    // Notifications State
    const [messages, setMessages] = useState<any[]>([]);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

    // Incident Reporting State
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [reportTargetDevice, setReportTargetDevice] = useState<any>(null);
    const [reportType, setReportType] = useState('STOLEN');
    const [reportLocation, setReportLocation] = useState('');
    const [reportDescription, setReportDescription] = useState('');
    const [policeReportNo, setPoliceReportNo] = useState('');
    const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
    const [isSubmittingReport, setIsSubmittingReport] = useState(false);
    const [reportError, setReportError] = useState('');

    // Device Registration State
    const [registrationForm, setRegistrationForm] = useState({
        brand: '', model: '', imei: '', serialNumber: '',
        screenSerialNumber: '', batterySerialNumber: '', motherboardSerialNumber: '', cameraSerialNumber: ''
    });
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [cartonFile, setCartonFile] = useState<File | null>(null);
    const [deviceFiles, setDeviceFiles] = useState<File[]>([]);
    const [isRegistering, setIsRegistering] = useState(false);
    const [regError, setRegError] = useState('');

    // UI tabs
    const [activeTab, setActiveTab] = useState<'active' | 'history' | 'register'>('active');

    // PDF Generation State
    const [isGeneratingPdf, setIsGeneratingPdf] = useState<string | null>(null);
    const certificateRef = useRef<HTMLDivElement>(null);
    const [certificateData, setCertificateData] = useState<any>(null);

    const fetchDashboardAndMessages = async () => {
        setLoading(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const headers = { 'Authorization': `Bearer ${localStorage.getItem('pts_token')}` };
            const [dashRes, msgsRes] = await Promise.all([
                fetch(`${apiUrl}/consumers/dashboard`, { headers }),
                fetch(`${apiUrl}/consumers/messages`, { headers })
            ]);
            const dashData = await dashRes.json();
            const msgsData = await msgsRes.json();

            if (!dashRes.ok) throw new Error(dashData.error);
            if (!msgsRes.ok) throw new Error(msgsData.error);

            setUser(dashData.fullName || dashData.email ? { fullName: dashData.fullName, email: dashData.email } : null);
            setDevices(dashData.devices || []);
            setPendingTransfers(dashData.pendingTransfers || []);
            setPastDevices(dashData.pastDevices || []);
            setMessages(msgsData.messages || []);
        } catch (err: any) {
            setError(err.message);
            if (err.message.includes('401') || err.message.includes('403')) {
                window.location.href = '/consumer/login';
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!localStorage.getItem('pts_token')) {
            window.location.href = '/consumer/login';
            return;
        }
        fetchDashboardAndMessages();
    }, []);

    const acceptTransfer = async (transferId: string) => {
        const handoverCode = prompt("Enter the 6-digit Handover Code provided by the seller/vendor to verify device 2FA handover:");
        if (!handoverCode) return;

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const res = await fetch(`${apiUrl}/transfers/accept/${transferId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('pts_token')}`
                },
                body: JSON.stringify({ handoverCode })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Transfer verification failed.');
            }

            alert('Transfer Verified! Device is now cryptographically bound to your portfolio.');
            fetchDashboardAndMessages();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const fetchPassport = async (imei: string) => {
        setPassportLoading(true);
        setIsPassportOpen(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const res = await fetch(`${apiUrl}/passports/${imei}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('pts_token')}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setSelectedPassport(data.passport);
            setSelectedMaintenance(data.maintenance || []);
            setPassportTab('chain');
        } catch (err: any) {
            alert(err.message);
            setIsPassportOpen(false);
        } finally {
            setPassportLoading(false);
        }
    };

    const emergencyFreeze = async (deviceId: string) => {
        if (!confirm('Are you sure you want to FREEZE this asset? This cannot be easily undone and will actively flag the device across national telecom networks.')) return;

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const res = await fetch(`${apiUrl}/incidents/emergency-freeze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('pts_token')}`
                },
                body: JSON.stringify({ deviceId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            alert('🚨 EMERGENCY FREEZE ACTIVATED. Your Certificate has been revoked.');
            fetchDashboardAndMessages();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const submitIncidentReport = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmittingReport(true);
        setReportError('');

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            let evidenceUrls: string[] = [];

            if (evidenceFile) {
                const formData = new FormData();
                formData.append('evidence', evidenceFile);

                const uploadRes = await fetch(`${apiUrl}/upload/evidence`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('pts_token')}` },
                    body: formData
                });
                const uploadData = await uploadRes.json();
                if (!uploadRes.ok) throw new Error(uploadData.error || 'Failed to upload evidence');
                evidenceUrls.push(uploadData.url);
            }

            const payload = {
                deviceId: reportTargetDevice.id,
                type: reportType,
                location: reportLocation,
                description: reportDescription,
                policeReportNo,
                evidenceUrls
            };

            const res = await fetch(`${apiUrl}/incidents/report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('pts_token')}`
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to submit report');
            alert('Incident report submitted to Law Enforcement.');
            setIsReportOpen(false);
            setReportTargetDevice(null);
            fetchDashboardAndMessages();
        } catch (err: any) {
            setReportError(err.message);
        } finally {
            setIsSubmittingReport(false);
        }
    };

    const submitRegistration = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsRegistering(true);
        setRegError('');

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            let purchaseReceiptUrl = null;
            let cartonPhotoUrl = null;
            let devicePhotos: string[] = [];

            // Upload Receipt
            if (receiptFile) {
                const formData = new FormData();
                formData.append('evidence', receiptFile);
                const uploadRes = await fetch(`${apiUrl}/upload/evidence`, {
                    method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('pts_token')}` }, body: formData
                });
                const uploadData = await uploadRes.json();
                if (!uploadRes.ok) throw new Error(uploadData.error || 'Failed to upload receipt');
                purchaseReceiptUrl = uploadData.url;
            }

            // Upload Carton Photo
            if (cartonFile) {
                const formData = new FormData();
                formData.append('evidence', cartonFile);
                const uploadRes = await fetch(`${apiUrl}/upload/evidence`, {
                    method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('pts_token')}` }, body: formData
                });
                const uploadData = await uploadRes.json();
                if (!uploadRes.ok) throw new Error(uploadData.error || 'Failed to upload carton photo');
                cartonPhotoUrl = uploadData.url;
            }

            // Upload Device Photos (Visual Identity — Multi-angle)
            if (deviceFiles.length > 0) {
                const formData = new FormData();
                deviceFiles.forEach(file => formData.append('files', file));

                const uploadRes = await fetch(`${apiUrl}/upload/multi`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('pts_token')}` },
                    body: formData
                });
                const uploadData = await uploadRes.json();
                if (!uploadRes.ok) throw new Error(uploadData.error || 'Failed to upload device photos');
                devicePhotos = uploadData.urls;
            }

            const payload = { ...registrationForm, devicePhotos, purchaseReceiptUrl, cartonPhotoUrl };

            const res = await fetch(`${apiUrl}/devices`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('pts_token')}` },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Registration failed');

            alert('Device successfully registered to your account.');
            setRegistrationForm({
                brand: '', model: '', imei: '', serialNumber: '',
                screenSerialNumber: '', batterySerialNumber: '', motherboardSerialNumber: '', cameraSerialNumber: ''
            });
            setReceiptFile(null);
            setCartonFile(null);
            setDeviceFiles([]);
            fetchDashboardAndMessages();
        } catch (err: any) {
            setRegError(err.message);
        } finally {
            setIsRegistering(false);
        }
    };

    const downloadCertificate = async (device: any) => {
        setIsGeneratingPdf(device.id);
        const activeCert = device.certificates && device.certificates.length > 0 ? device.certificates[0] : null;

        if (!activeCert || !activeCert.isActive) {
            alert('Cannot generate a certificate. Registration is missing or revoked.');
            setIsGeneratingPdf(null);
            return;
        }

        // Set the data for the invisible template
        setCertificateData({
            brand: device.brand,
            model: device.model,
            imei: device.imei,
            serial: device.serialNumber || 'N/A',
            owner: user?.fullName || user?.email || 'Registered Owner',
            date: new Date(activeCert.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
            hash: activeCert.qrHash,
            qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://pts-registry.vercel.app/verify/${device.imei}`
        });

        // Small delay to allow React to render the invisible template
        setTimeout(async () => {
            if (certificateRef.current) {
                try {
                    const canvas = await html2canvas(certificateRef.current, {
                        scale: 3,
                        useCORS: true,
                        backgroundColor: '#ffffff'
                    });
                    const imgData = canvas.toDataURL('image/png', 1.0);

                    const pdf = new jsPDF('p', 'mm', 'a4');
                    const pdfWidth = pdf.internal.pageSize.getWidth();
                    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

                    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
                    pdf.save(`PTS_CERTIFICATE_${device.brand}_${device.imei}.pdf`);
                } catch (err) {
                    console.error('Failed to generate PDF:', err);
                    alert('An error occurred while generating the certificate.');
                }
            }
            setIsGeneratingPdf(null);
            setCertificateData(null);
        }, 1000);
    };

    return (
        <div className="min-h-screen bg-slate-950 font-sans text-slate-200">
            <nav className="border-b border-emerald-900/40 bg-slate-900/80 backdrop-blur-md px-6 py-4 flex justify-between items-center sticky top-0 z-50">
                <div className="text-white font-bold flex items-center gap-3">
                    <span className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">PTS</span>
                    <div className="flex flex-col">
                        <span className="leading-tight">Digital Vault {user?.fullName && `— ${user.fullName}`}</span>
                        <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-semibold flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div> Secured Account</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <button onClick={() => setIsNotificationsOpen(!isNotificationsOpen)} className="relative p-2 text-slate-400 hover:text-white transition-colors">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                            {messages.length > 0 && <span className="absolute top-1 right-1 flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span></span>}
                        </button>
                        {isNotificationsOpen && (
                            <div className="absolute right-0 mt-3 w-80 max-h-96 overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 animate-in fade-in slide-in-from-top-2">
                                <div className="p-4 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-slate-900/95 backdrop-blur-md">
                                    <h3 className="text-sm font-bold text-white">System Messages</h3>
                                </div>
                                <div className="p-2 space-y-1">
                                    {messages.length === 0 ? (
                                        <div className="p-4 text-center text-xs text-slate-500">No new messages</div>
                                    ) : messages.map((msg: any) => (
                                        <div key={msg.id} className="p-3 bg-slate-800/30 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-slate-700/50">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${msg.sender.role === 'ADMIN' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-400'}`}>{msg.sender.role} NOTICE</span>
                                                <span className="text-[10px] text-slate-500 font-mono">{new Date(msg.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-sm font-bold text-white mb-0.5">{msg.subject}</p>
                                            <p className="text-xs text-slate-400 line-clamp-2">{msg.body}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <button onClick={() => { localStorage.removeItem('pts_token'); window.location.href = '/consumer/login'; }} className="text-sm font-medium text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 px-4 py-2 rounded-lg transition-colors border border-slate-700">Sign Out</button>
                </div>
            </nav>

            <main className="max-w-5xl mx-auto p-4 sm:p-6 mt-6 sm:mt-10">
                {error && <p className="mb-6 p-4 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 font-medium">{error}</p>}

                {/* Pending Transfers Alert */}
                {pendingTransfers.length > 0 && (
                    <div className="mb-10 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 shadow-xl animate-in fade-in slide-in-from-top-4 duration-500">
                        <h2 className="text-xl font-bold text-amber-500 mb-4 flex items-center gap-2"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg> Incoming Device Transfers</h2>
                        <div className="space-y-4">
                            {pendingTransfers.map((tx: any) => (
                                <div key={tx.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-900/80 p-5 rounded-xl border border-slate-700/50 hover:border-amber-500/50 transition-colors">
                                    <div>
                                        <p className="font-semibold text-white text-lg">{tx.device.brand} {tx.device.model}</p>
                                        <p className="text-sm text-slate-400">From: {tx.seller.companyName || tx.seller.email} • IMEI: {tx.device.imei}</p>
                                    </div>
                                    <button onClick={() => acceptTransfer(tx.id)} className="mt-4 sm:mt-0 bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 px-6 rounded-xl transition-colors shadow-lg shadow-amber-500/20 flex items-center gap-2">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        Accept Ownership
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b border-slate-800 pb-4">
                    <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Your Asset Portfolio</h1>
                    <div className="flex flex-wrap bg-slate-900 border border-slate-800 rounded-lg p-1 gap-1">
                        <button onClick={() => setActiveTab('active')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'active' ? 'bg-emerald-600/20 text-emerald-400 shadow-md' : 'text-slate-400 hover:text-white'}`}>Active Devices</button>
                        <button onClick={() => setActiveTab('history')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-blue-600/20 text-blue-400 shadow-md' : 'text-slate-400 hover:text-white'}`}>Ownership History</button>
                        <button onClick={() => setActiveTab('register')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'register' ? 'bg-amber-600/20 text-amber-400 shadow-md border-amber-500/30 border' : 'text-amber-500/70 hover:text-amber-400 border border-transparent'}`}>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            Register Device
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-20 text-slate-500">
                        <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                            <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        </div>
                        <p className="animate-pulse">Decrypting vault contents...</p>
                    </div>
                ) : activeTab === 'active' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in zoom-in-95 duration-300">
                        {devices.length === 0 ? (
                            <div className="col-span-full border border-dashed border-slate-700 bg-slate-900/30 rounded-3xl p-16 text-center">
                                <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-10 h-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg></div>
                                <h3 className="text-xl font-bold text-white mb-2">No Active Assets</h3>
                                <p className="text-slate-400 font-medium">There are no devices cryptographically bound to your identity right now.</p>
                            </div>
                        ) : (
                            devices.map((device: any) => {
                                const activeCert = device.certificates && device.certificates.length > 0 ? device.certificates[0] : null;

                                return (
                                    <div key={device.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden group hover:border-slate-700 transition-colors">
                                        <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl transition-colors ${device.status === 'CLEAN' ? 'bg-emerald-500/5 group-hover:bg-emerald-500/10' : 'bg-red-500/10 group-hover:bg-red-500/20'}`}></div>

                                        <div className="flex justify-between items-start mb-6 relative">
                                            <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${device.status === 'CLEAN' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                                                {device.status}
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] text-slate-500 font-bold uppercase">Trust Score</div>
                                                <div className={`text-lg font-black leading-none ${device.riskScore >= 80 ? 'text-emerald-400' : device.riskScore >= 50 ? 'text-amber-400' : 'text-red-500'}`}>{device.riskScore}</div>
                                            </div>
                                        </div>

                                        <div className="flex gap-4 items-center mb-6 relative">
                                            <div className="w-16 h-16 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden flex-shrink-0">
                                                {device.devicePhotos && device.devicePhotos.length > 0 ? (
                                                    <img src={device.devicePhotos[0]} alt={device.model} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-xl font-bold text-white mb-1 truncate">{device.brand} {device.model}</h3>
                                                <p className="text-sm font-mono text-slate-400 tracking-widest truncate">{device.imei}</p>
                                            </div>
                                        </div>

                                        <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800/80 relative">
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Digital Ownership Certificate (DDOC)</p>
                                            {activeCert && activeCert.isActive ? (
                                                <div className="flex gap-3 items-center">
                                                    <div className="w-10 h-10 rounded-lg bg-emerald-400/[0.08] flex items-center justify-center">
                                                        <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    </div>
                                                    <div className="overflow-hidden">
                                                        <div className="text-xs text-white font-semibold truncate leading-tight">ACTIVE REGISTRATION</div>
                                                        <div className="text-[10px] text-slate-500 font-mono truncate">{activeCert.qrHash.substring(0, 20)}...</div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex gap-3 items-center">
                                                    <div className="w-10 h-10 rounded-lg bg-red-400/[0.08] flex items-center justify-center">
                                                        <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                                    </div>
                                                    <div className="overflow-hidden">
                                                        <div className="text-xs text-red-400 font-semibold truncate leading-tight">REVOKED & LOCKED</div>
                                                        <div className="text-[10px] text-slate-500">Device frozen on network.</div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-6 flex flex-col gap-3 relative z-10">
                                            <button onClick={() => fetchPassport(device.imei)} className="block w-full text-center bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white text-sm font-bold py-3 rounded-xl transition-all border border-blue-500/20">
                                                View Security Ledger
                                            </button>

                                            {device.status === 'CLEAN' ? (
                                                <>
                                                    {activeCert && activeCert.isActive && (
                                                        <button
                                                            onClick={() => downloadCertificate(device)}
                                                            disabled={isGeneratingPdf === device.id}
                                                            className={`block w-full text-center text-sm font-bold py-3 rounded-xl transition-all border ${isGeneratingPdf === device.id ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/30 cursor-wait' : 'bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white border-emerald-500/20'}`}
                                                        >
                                                            {isGeneratingPdf === device.id ? 'Generating Security PDF...' : 'Download Official Certificate'}
                                                        </button>
                                                    )}

                                                    <a href={`/consumer/transfer?deviceId=${device.id}`} className="block w-full text-center bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold py-3 rounded-xl transition-colors border border-slate-700/50">
                                                        Transfer Asset
                                                    </a>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <button onClick={() => { setReportTargetDevice(device); setIsReportOpen(true); }} className="flex items-center justify-center gap-1 w-full bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-white border border-amber-500/20 text-xs font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-amber-500/20 uppercase tracking-wide">
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                            Report Loss
                                                        </button>
                                                        <button onClick={() => emergencyFreeze(device.id)} className="flex items-center justify-center gap-1 w-full bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 text-xs font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-red-500/20 uppercase tracking-wide">
                                                            1-Click Freeze
                                                        </button>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="space-y-3">
                                                    <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center text-sm text-slate-400 cursor-not-allowed">
                                                        Actions Locked due to {device.status} status.
                                                    </div>

                                                    {((device.isLocationShared) || (device.incidents && device.incidents.length > 0 && device.incidents[0].locationSharedWithOwner)) && (
                                                        <div className="p-4 rounded-xl bg-purple-900/20 border border-purple-500/30 relative overflow-hidden">
                                                            <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/10 rounded-full blur-xl animate-pulse"></div>
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                                <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">Law Enforcement Active Tracking</span>
                                                            </div>
                                                            <p className="text-[10px] text-slate-300 mb-2">Police have authorized visibility on the latest ping for your device.</p>
                                                            <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 font-mono text-xs text-emerald-400 flex items-center gap-2">
                                                                <span className="relative flex h-2 w-2">
                                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                                                </span>
                                                                {device.lastKnownLocation || 'Awaiting exact coordinates...'}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                ) : activeTab === 'history' ? (
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                        {pastDevices.length === 0 ? (
                            <div className="p-16 text-center border-b border-slate-800">
                                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-10 h-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                                <h3 className="text-xl font-bold text-white mb-2">No Ownership History</h3>
                                <p className="text-slate-400 max-w-sm mx-auto">You have not completed any outgoing transfers or sold any devices.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-950 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500 font-bold">
                                            <th className="p-5">Transfer Date</th>
                                            <th className="p-5">Device Make</th>
                                            <th className="p-5">IMEI Number</th>
                                            <th className="p-5">Transferred To</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800 flex-1">
                                        {pastDevices.map((device, idx) => (
                                            <tr key={`${device.id}-${idx}`} className="hover:bg-slate-800/30 transition-colors group">
                                                <td className="p-5 text-slate-400 font-medium">{new Date(device.transferDetails?.date).toLocaleDateString()}</td>
                                                <td className="p-5">
                                                    <p className="font-bold text-white mb-0.5">{device.brand} {device.model}</p>
                                                    <p className="text-xs text-slate-500">Record Permanent</p>
                                                </td>
                                                <td className="p-5 font-mono text-slate-300 tracking-widest">{device.imei}</td>
                                                <td className="p-5">
                                                    <span className="text-slate-300">{device.transferDetails?.buyer?.email || 'Unknown'}</span>
                                                    {device.transferDetails?.buyer?.companyName && (
                                                        <span className="block text-xs text-blue-400 mt-1">{device.transferDetails.buyer.companyName}</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                ) : activeTab === 'register' ? (
                    <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-10 animate-in fade-in slide-in-from-bottom-8 duration-500">
                        <div className="mb-8 border-b border-slate-800 pb-6">
                            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                                </div>
                                Direct Asset Registration
                            </h2>
                            <p className="text-slate-400 text-sm mt-3">Register a legally self-owned device to acquire an immutable certificate of ownership. Physical documentation (receipts/carton) is strictly recommended to prove legitimate purchase before generating a verifiable DDOC.</p>
                        </div>

                        <form onSubmit={submitRegistration} className="space-y-6">
                            {regError && <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm font-semibold">{regError}</div>}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-300 mb-2">Device Brand *</label>
                                    <input type="text" value={registrationForm.brand} onChange={e => setRegistrationForm({ ...registrationForm, brand: e.target.value })} required placeholder="E.g. Apple, Samsung" className="w-full bg-slate-950/50 border border-slate-700/80 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-amber-500 transition-colors shadow-inner" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-300 mb-2">Model Name *</label>
                                    <input type="text" value={registrationForm.model} onChange={e => setRegistrationForm({ ...registrationForm, model: e.target.value })} required placeholder="E.g. iPhone 15 Pro Max" className="w-full bg-slate-950/50 border border-slate-700/80 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-amber-500 transition-colors shadow-inner" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-300 mb-2">IMEI (Serial #1) *</label>
                                    <input type="text" value={registrationForm.imei} onChange={e => setRegistrationForm({ ...registrationForm, imei: e.target.value })} required maxLength={15} placeholder="15-digit code (*#06#)" className="w-full bg-slate-950/50 border border-slate-700/80 rounded-xl px-4 py-3.5 text-white font-mono focus:outline-none focus:border-amber-500 transition-colors shadow-inner" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-300 mb-2">Hardware Serial No (Opt)</label>
                                    <input type="text" value={registrationForm.serialNumber} onChange={e => setRegistrationForm({ ...registrationForm, serialNumber: e.target.value })} placeholder="Found in Settings/About" className="w-full bg-slate-950/50 border border-slate-700/80 rounded-xl px-4 py-3.5 text-white font-mono focus:outline-none focus:border-amber-500 transition-colors shadow-inner" />
                                </div>
                            </div>

                            <div className="p-5 bg-blue-950/20 border border-blue-900/30 rounded-2xl space-y-5">
                                <h3 className="text-sm font-bold text-blue-400 flex items-center gap-2 uppercase tracking-widest">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04M12 2.944V21m0-18.056L3.382 7.056M12 2.944l8.618 4.112M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    Hardware DNA Registry (Forensics)
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">Screen Serial</label>
                                        <input
                                            type="text"
                                            value={registrationForm.screenSerialNumber}
                                            onChange={e => setRegistrationForm({ ...registrationForm, screenSerialNumber: e.target.value })}
                                            placeholder="Part ID: SCR-XXXX"
                                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-all text-xs font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">Battery Serial</label>
                                        <input
                                            type="text"
                                            value={registrationForm.batterySerialNumber}
                                            onChange={e => setRegistrationForm({ ...registrationForm, batterySerialNumber: e.target.value })}
                                            placeholder="Part ID: BAT-XXXX"
                                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-all text-xs font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">Motherboard ID</label>
                                        <input
                                            type="text"
                                            value={registrationForm.motherboardSerialNumber}
                                            onChange={e => setRegistrationForm({ ...registrationForm, motherboardSerialNumber: e.target.value })}
                                            placeholder="Part ID: MOB-XXXX"
                                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-all text-xs font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">Camera Module</label>
                                        <input
                                            type="text"
                                            value={registrationForm.cameraSerialNumber}
                                            onChange={e => setRegistrationForm({ ...registrationForm, cameraSerialNumber: e.target.value })}
                                            placeholder="Part ID: CAM-XXXX"
                                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-all text-xs font-mono"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-5 bg-emerald-950/20 border border-emerald-900/30 rounded-2xl space-y-5">
                                <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    Asset Identification & Verification
                                </h3>

                                <div>
                                    <label className="block text-xs font-bold text-slate-300 mb-2">Device Photos (Visual Identity — Max 3) *</label>
                                    <input type="file" accept="image/*" multiple onChange={(e) => setDeviceFiles(Array.from(e.target.files || []).slice(0, 3))} required className="w-full bg-slate-900/50 border border-slate-700 border-dashed rounded-xl px-4 py-3 text-slate-400 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-500/10 file:text-blue-400 hover:file:bg-blue-500/20 transition-colors cursor-pointer" />
                                    <p className="text-[10px] text-slate-500 mt-2">Upload Front, Back, and Side views for forensic ID.</p>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-300 mb-2">Purchase Receipt / Invoice (Optional)</label>
                                    <input type="file" accept="image/*,application/pdf" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} className="w-full bg-slate-900/50 border border-slate-700 border-dashed rounded-xl px-4 py-3 text-slate-400 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-500/10 file:text-emerald-400 hover:file:bg-emerald-500/20 transition-colors cursor-pointer" />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-300 mb-2">Device Carton / Box Photo (Optional)</label>
                                    <input type="file" accept="image/*" onChange={(e) => setCartonFile(e.target.files?.[0] || null)} className="w-full bg-slate-900/50 border border-slate-700 border-dashed rounded-xl px-4 py-3 text-slate-400 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-amber-500/10 file:text-amber-500 hover:file:bg-amber-500/20 transition-colors cursor-pointer" />
                                    <p className="text-[10px] text-slate-500 mt-2">Clear photo showing IMEI printed on the box.</p>
                                </div>
                            </div>

                            <button type="submit" disabled={isRegistering} className="w-full mt-6 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold py-4 rounded-xl transition-all shadow-lg hover:shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-3">
                                {isRegistering ? (
                                    <><svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Securing Device on Blockchain...</>
                                ) : (
                                    <>Verify & Generate Certificates</>
                                )}
                            </button>
                        </form>
                    </div>
                ) : null}

                {/* Device Passport Modal */}
                {isPassportOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl max-h-[85vh] overflow-hidden flex flex-col">
                            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-white leading-tight">Device Immutable Passport</h2>
                                        <p className="text-xs text-slate-500 uppercase tracking-widest font-mono mt-1">Chain-of-Custody Ledger</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsPassportOpen(false)} className="text-slate-400 hover:text-white p-2">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <div className="flex bg-slate-950/40 border-b border-slate-800 p-1 gap-1">
                                <button onClick={() => setPassportTab('chain')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-all ${passportTab === 'chain' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500 hover:text-slate-300'}`}>Chain of Custody</button>
                                <button onClick={() => setPassportTab('service')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-all ${passportTab === 'service' ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-500 hover:text-slate-300'}`}>Service History</button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {passportLoading ? (
                                    <div className="text-center py-10 text-slate-500 italic">Accessing Ledger Nodes...</div>
                                ) : passportTab === 'chain' ? (
                                    selectedPassport && selectedPassport.length > 0 ? (
                                        <div className="relative pl-8 border-l-2 border-slate-800 space-y-8">
                                            {selectedPassport.map((entry, idx) => (
                                                <div key={entry.id} className="relative">
                                                    <div className={`absolute -left-[41px] top-0 w-5 h-5 rounded-full border-4 border-slate-900 ${entry.type === 'REGISTRATION' ? 'bg-emerald-500' :
                                                        entry.type === 'TRANSFER' ? 'bg-blue-500' :
                                                            entry.type === 'STATUS_CHANGE' ? 'bg-amber-500' : 'bg-slate-400'
                                                        }`}></div>
                                                    <div className="text-[10px] text-slate-500 font-mono mb-1">{new Date(entry.createdAt).toLocaleString()}</div>
                                                    <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-xl">
                                                        <div className="text-xs font-bold text-slate-300 uppercase tracking-wide mb-1 flex items-center gap-2">
                                                            {entry.type}
                                                            <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                                                            <span className="text-slate-500 lowercase font-normal">by {entry.actor?.companyName || entry.actor?.email || 'System'}</span>
                                                        </div>
                                                        <p className="text-sm text-white font-medium">{entry.description}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-center py-10 text-slate-500">No transaction logs found for this device.</p>
                                    )
                                ) : (
                                    selectedMaintenance && selectedMaintenance.length > 0 ? (
                                        <div className="space-y-6">
                                            {selectedMaintenance.map((record) => (
                                                <div key={record.id} className="bg-slate-800/40 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                                                    <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-emerald-500/[0.03]">
                                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">Verified Service</span>
                                                        <span className="text-[10px] font-mono text-slate-500">{new Date(record.serviceDate).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="p-5">
                                                        <h4 className="text-white font-bold mb-1">{record.serviceType?.replace('_', ' ')}</h4>
                                                        <p className="text-sm text-slate-400 mb-4">{record.description}</p>

                                                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800/50">
                                                            <div>
                                                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Provider</p>
                                                                <p className="text-xs text-white font-semibold truncate">{record.vendor.companyName || record.vendor.fullName}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Tier / Trust</p>
                                                                <p className={`text-xs font-bold ${record.vendor.vendorTier <= 2 ? 'text-emerald-400' : 'text-blue-400'}`}>
                                                                    {record.vendor.vendorTier === 1 ? '🥇 Master Certified' : record.vendor.vendorTier === 2 ? '🥈 Preferred' : '🥉 Authorized'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        {record.partsReplaced && (
                                                            <div className="mt-4 p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                                                                <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Parts Catalogued</p>
                                                                <p className="text-xs text-slate-300 italic">{record.partsReplaced}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-16">
                                            <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                                                <svg className="w-8 h-8 text-emerald-500/40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                            </div>
                                            <h4 className="text-white font-bold mb-2">No Service Records</h4>
                                            <p className="text-xs text-slate-500 px-10">This device has no maintenance history logged by authorized service centers.</p>
                                        </div>
                                    )
                                )}
                            </div>

                            <div className="p-6 bg-slate-950/50 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-500 italic">
                                <span>Verified by PTS National Registry Core v4.0</span>
                                <span className="flex items-center gap-1 text-emerald-500 font-bold tracking-tighter uppercase tabular-nums">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                    Immutable Sync
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Report Incident Modal */}
                {isReportOpen && reportTargetDevice && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col relative">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-amber-500"></div>
                            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-red-600/20 text-red-500 flex items-center justify-center border border-red-500/30">
                                        <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-white leading-tight">File Official Police Report</h2>
                                        <p className="text-xs text-slate-400">Flag device on National Database</p>
                                    </div>
                                </div>
                                <button onClick={() => { setIsReportOpen(false); setReportTargetDevice(null); }} className="text-slate-400 hover:text-white p-2">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <form onSubmit={submitIncidentReport} className="p-6 space-y-4">
                                {reportError && <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm">{reportError}</div>}

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Target Device</label>
                                    <div className="p-3 bg-slate-950/50 rounded-lg border border-slate-800 font-mono text-sm text-slate-400">{reportTargetDevice.brand} {reportTargetDevice.model} (IMEI: {reportTargetDevice.imei})</div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Incident Type</label>
                                        <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500">
                                            <option value="STOLEN">Stolen / Snatching</option>
                                            <option value="LOST">Lost</option>
                                            <option value="FRAUD">Fraudulent Sale</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Police Report No. (Opt.)</label>
                                        <input type="text" value={policeReportNo} onChange={(e) => setPoliceReportNo(e.target.value)} placeholder="e.g. CR/2026/01A" className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Location of Incident</label>
                                    <input type="text" value={reportLocation} onChange={(e) => setReportLocation(e.target.value)} placeholder="E.g., Bus Stop, Main Street, Lagos" required className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500" />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
                                    <textarea value={reportDescription} onChange={(e) => setReportDescription(e.target.value)} placeholder="Briefly describe what happened..." required rows={3} className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 resize-none"></textarea>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5 text-amber-500">Evidence Upload (CCTV / Photos)</label>
                                    <input type="file" accept="image/*,video/mp4,application/pdf" onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)} className="w-full bg-slate-950/50 border border-slate-700/50 border-dashed rounded-xl px-4 py-3 text-slate-400 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-amber-500/10 file:text-amber-500 hover:file:bg-amber-500/20 transition-colors cursor-pointer" />
                                    <p className="text-[10px] text-slate-500 mt-2">Max limit 20MB. Accepted files: MP4 footage, JPG/PNG scenes.</p>
                                </div>

                                <button type="submit" disabled={isSubmittingReport} className="w-full mt-4 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold py-3.5 px-4 rounded-xl transition-all disabled:opacity-50">
                                    {isSubmittingReport && <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                                    {isSubmittingReport ? 'Uploading Evidence & Locking Device...' : 'Submit Official Report & Flag Network'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </main>

            {/* Invisible PDF Template Container */}
            <div style={{ position: 'fixed', top: '0', left: '200%', pointerEvents: 'none' }}>
                {certificateData && (
                    <div ref={certificateRef} style={{ width: '794px', height: '1123px' }} className="bg-white text-slate-900 relative p-14 font-serif flex flex-col justify-between overflow-hidden shadow-2xl">

                        {/* Premium Border Design */}
                        <div className="absolute inset-4 border-[1px] border-slate-300 pointer-events-none"></div>
                        <div className="absolute inset-8 border-[4px] border-double border-slate-800 pointer-events-none"></div>

                        {/* Corner Ornaments */}
                        <div className="absolute top-8 left-8 w-16 h-16 border-t-4 border-l-4 border-slate-800"></div>
                        <div className="absolute top-8 right-8 w-16 h-16 border-t-4 border-r-4 border-slate-800"></div>
                        <div className="absolute bottom-8 left-8 w-16 h-16 border-b-4 border-l-4 border-slate-800"></div>
                        <div className="absolute bottom-8 right-8 w-16 h-16 border-b-4 border-r-4 border-slate-800"></div>

                        {/* Background GUI & Security Pattern */}
                        <div className="absolute inset-0 z-0 opacity-[0.03] flex items-center justify-center pointer-events-none overflow-hidden">
                            <div className="w-[120%] h-[120%] border-[150px] border-emerald-900 rounded-full rotate-45 scale-150"></div>
                        </div>
                        <div className="absolute inset-0 z-0 opacity-[0.02] flex flex-col justify-between items-center py-20 pointer-events-none">
                            {Array.from({ length: 20 }).map((_, i) => (
                                <p key={i} className="text-3xl font-mono uppercase tracking-[2.5em] whitespace-nowrap -rotate-[25deg] transform">PTS REGISTRY • SECURED ASSET • VERIFIED</p>
                            ))}
                        </div>

                        {/* Certificate Content */}
                        <div className="relative z-10 h-full flex flex-col p-16">

                            {/* Header Section */}
                            <div className="text-center mb-12">
                                <div className="inline-flex flex-col items-center mb-8">
                                    <div className="w-24 h-24 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-2xl ring-4 ring-offset-4 ring-slate-800 mb-6 relative">
                                        <span className="text-4xl font-black font-sans tracking-tighter">PTS</span>
                                        <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white shadow-lg">
                                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.9L10 1.154l7.834 3.746v6.5c0 4.81-3.342 9.303-7.834 10.51a11.95 11.95 0 01-7.834-10.51v-6.5zm7.834 11.332a.75.75 0 01-.75-.75V8a.75.75 0 011.5 0v7.482a.75.75 0 01-.75.75z" clipRule="evenodd" /></svg>
                                        </div>
                                    </div>
                                    <h1 className="text-6xl font-black tracking-tight text-slate-900 serif border-y-2 border-slate-900 py-4 px-10">
                                        CERTIFICATE OF OWNERSHIP
                                    </h1>
                                    <p className="text-sm text-slate-500 uppercase tracking-[0.4em] mt-6 font-black font-sans">National Digital Asset Registry Terminal</p>
                                </div>
                            </div>

                            {/* Declaration */}
                            <div className="flex-1 text-center mt-6">
                                <p className="text-2xl text-slate-500 mb-6 italic leading-relaxed">This constitutes public and legal certification that</p>

                                <div className="mb-12">
                                    <h2 className="text-4xl font-black text-slate-900 px-12 py-3 border-b-2 border-slate-200 inline-block uppercase tracking-tight">
                                        {certificateData.owner}
                                    </h2>
                                    <p className="text-xs font-bold text-slate-400 mt-3 tracking-widest uppercase italic">Designated Registered Device Owner</p>
                                </div>

                                <p className="text-xl text-slate-500 mb-10 italic">retains documented title and legal possession of the following asset:</p>

                                {/* Specification Box */}
                                <div className="bg-slate-50/50 border border-slate-200 rounded-3xl p-10 mx-6 text-left shadow-md relative">
                                    <div className="absolute top-0 right-10 -translate-y-1/2 bg-white px-4 py-1 border border-slate-200 rounded-full text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase">Hardware Manifest</div>

                                    <div className="grid grid-cols-2 gap-y-8 gap-x-12">
                                        <div>
                                            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black mb-1.5">Manufacturer / Brand</p>
                                            <p className="text-2xl font-black text-slate-900">{certificateData.brand}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black mb-1.5">Hardware Model</p>
                                            <p className="text-2xl font-black text-slate-900">{certificateData.model}</p>
                                        </div>
                                        <div className="col-span-2 pt-6 border-t border-slate-200">
                                            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black mb-2">IMEI Identity Number (Int'l Standard)</p>
                                            <div className="flex items-center gap-4">
                                                <p className="text-4xl font-mono font-black tracking-[0.25em] text-slate-900 bg-white border border-slate-300 py-3 px-6 rounded-xl shadow-sm">
                                                    {certificateData.imei}
                                                </p>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black mb-1.5">Hardware Serial No.</p>
                                            <p className="text-lg font-mono font-bold text-slate-600">{certificateData.serial}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black mb-1.5">Registry Enrolment Timestamp</p>
                                            <p className="text-lg font-black text-slate-800 uppercase italic">{certificateData.date}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Verification Footer Section */}
                            <div className="mt-16 bg-slate-900 text-white rounded-[2.5rem] p-10 flex items-center justify-between shadow-2xl border-b-[8px] border-emerald-600">
                                <div className="flex-1 pr-12">
                                    <p className="text-[10px] text-emerald-400 uppercase tracking-[0.3em] font-black mb-3">Cryptographic Blockchain Hash (SHA-256)</p>
                                    <p className="text-xs font-mono text-slate-300 break-all bg-black/40 p-4 rounded-xl border border-slate-700 leading-relaxed shadow-inner font-bold tracking-tight">
                                        {certificateData.hash}
                                    </p>
                                    <div className="mt-6 flex items-start gap-4">
                                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 border border-emerald-500/30">
                                            <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                        </div>
                                        <p className="text-[11px] text-slate-400 italic leading-relaxed">
                                            This certificate is cryptographically anchored to the National PTS Registry. Any unauthorized resale or reported loss of this hardware will instantly invalidate this document. Security status: <span className="text-emerald-400 font-black">ACTIVE / NOMINAL</span>.
                                        </p>
                                    </div>
                                </div>
                                <div className="ml-4 w-36 h-36 bg-white rounded-2xl p-3 flex-shrink-0 flex items-center justify-center shadow-xl ring-4 ring-slate-800 ring-offset-2 ring-offset-slate-900">
                                    <img
                                        src={certificateData.qrCode}
                                        alt="Verification QR"
                                        className="w-full h-full"
                                        crossOrigin="anonymous"
                                    />
                                </div>
                            </div>

                            {/* Signatures */}
                            <div className="flex justify-between items-end mt-12 px-12 pb-4">
                                <div>
                                    <div className="w-56 border-b-4 border-slate-900 mb-3 opacity-80"></div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Registry Seal of Execution</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">PTS Digital Authority</p>
                                    <p className="text-[10px] text-slate-400 font-bold tracking-widest italic uppercase mt-1">Issued via Terminal v4.0.1</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
}
