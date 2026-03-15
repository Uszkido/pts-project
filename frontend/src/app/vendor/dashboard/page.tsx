'use client';
import { useState, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type VendorProfile = {
    id: string;
    email: string;
    companyName: string;
    vendorTier: number;
};

type DashboardMetrics = {
    totalInventory: number;
    totalSales: number;
    trustScore: number;
};

export default function Dashboard() {
    // Registration Form State
    const [imei, setImei] = useState('');
    const [brand, setBrand] = useState('');
    const [model, setModel] = useState('');
    const [serial, setSerial] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');
    const [isDirectSale, setIsDirectSale] = useState(false);
    const [devicePhotos, setDevicePhotos] = useState<File[]>([]);
    const [isRegistering, setIsRegistering] = useState(false);

    // Hardware DNA Serial Numbers
    const [screenSerial, setScreenSerial] = useState('');
    const [batterySerial, setBatterySerial] = useState('');
    const [motherboardSerial, setMotherboardSerial] = useState('');
    const [cameraSerial, setCameraSerial] = useState('');

    // UI State
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<'register' | 'inventory' | 'sales' | 'messages' | 'maintenance' | 'report'>('inventory');
    const [loading, setLoading] = useState(true);

    // PDF Receipt State
    const [isGeneratingReceipt, setIsGeneratingReceipt] = useState<string | null>(null);
    const [receiptData, setReceiptData] = useState<any>(null);
    const receiptRef = useRef<HTMLDivElement>(null);

    // Maintenance State
    const [searchImei, setSearchImei] = useState('');
    const [foundDevice, setFoundDevice] = useState<any | null>(null);
    const [maintenanceHistory, setMaintenanceHistory] = useState<any[]>([]);
    const [serviceType, setServiceType] = useState('GENERAL_REPAIR');
    const [repairDesc, setRepairDesc] = useState('');
    const [parts, setParts] = useState('');
    const [repairCost, setRepairCost] = useState('');
    const [isLoggingRepair, setIsLoggingRepair] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);

    // Suspicious Reporting State
    const [suspiciousImei, setSuspiciousImei] = useState('');
    const [suspectEmail, setSuspectEmail] = useState('');
    const [suspiciousDesc, setSuspiciousDesc] = useState('');
    const [isReportingSuspicious, setIsReportingSuspicious] = useState(false);

    // Dashboard Data
    const [profile, setProfile] = useState<VendorProfile | null>(null);
    const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
    const [inventory, setInventory] = useState<any[]>([]);
    const [sales, setSales] = useState<any[]>([]);
    const [messages, setMessages] = useState<any[]>([]);
    const [pendingTransfers, setPendingTransfers] = useState<any[]>([]);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const headers = { 'Authorization': `Bearer ${localStorage.getItem('pts_token')}` };

            const [dashRes, msgRes] = await Promise.all([
                fetch(`${apiUrl}/vendors/dashboard`, { headers }),
                fetch(`${apiUrl}/vendors/messages`, { headers })
            ]);

            const data = await dashRes.json();
            if (!dashRes.ok) throw new Error(data.error || 'Failed to fetch dashboard data');

            const msgData = await msgRes.json();
            setProfile(data.profile);
            setMetrics(data.metrics);
            setInventory(data.inventory);
            setSales(data.sales);
            setMessages(msgData.messages || []);
            setPendingTransfers(data.pendingTransfers || []);
        } catch (err: any) {
            setError(err.message);
            if (err.message.includes('401') || err.message.includes('403')) {
                window.location.href = '/vendor/login';
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const token = localStorage.getItem('pts_token');
        if (!token) {
            window.location.href = '/vendor/login';
            return;
        }
        fetchDashboardData();
    }, []);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(''); setError('');
        setIsRegistering(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            let devicePhotoUrls: string[] = [];
            if (devicePhotos.length > 0) {
                const formData = new FormData();
                devicePhotos.forEach(file => formData.append('files', file));

                const uploadRes = await fetch(`${apiUrl}/upload/multi`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('pts_token')}` },
                    body: formData
                });
                const uploadData = await uploadRes.json();
                if (!uploadRes.ok) throw new Error(uploadData.error || 'Failed to upload photos');
                devicePhotoUrls = uploadData.urls;
            }

            const res = await fetch(`${apiUrl}/devices`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('pts_token')}`
                },
                body: JSON.stringify({
                    imei,
                    brand,
                    model,
                    serialNumber: serial,
                    devicePhotos: devicePhotoUrls,
                    screenSerialNumber: screenSerial,
                    batterySerialNumber: batterySerial,
                    motherboardSerialNumber: motherboardSerial,
                    cameraSerialNumber: cameraSerial
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setMessage(`Device registered securely. IMEI: ${data.device.imei}`);
            setImei(''); setBrand(''); setModel(''); setSerial(''); setDevicePhotos([]);
            setScreenSerial(''); setBatterySerial(''); setMotherboardSerial(''); setCameraSerial('');

            // If direct sale, initiate transfer
            if (isDirectSale && customerEmail) {
                const price = prompt("Enter the selling price for this device (₦) (or leave empty): ");
                await initiateSale(data.device.id, customerEmail, price || '0');
            } else {
                fetchDashboardData(); // Refresh inventory
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsRegistering(false);
        }
    };

    const handleSubmitSuspiciousReport = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsReportingSuspicious(true);
        setMessage('');
        setError('');
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const res = await fetch(`${apiUrl}/vendors/suspicious-alert`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('pts_token')}`
                },
                body: JSON.stringify({
                    imei: suspiciousImei,
                    sellerEmail: suspectEmail,
                    description: suspiciousDesc
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setMessage('Suspicious activity successfully exported to law enforcement.');
            setSuspiciousImei('');
            setSuspectEmail('');
            setSuspiciousDesc('');
            setActiveTab('inventory');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsReportingSuspicious(false);
        }
    };

    const initiateSale = async (deviceId: string, buyerEmail: string, price: string) => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const res = await fetch(`${apiUrl}/transfers/initiate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('pts_token')}`
                },
                body: JSON.stringify({ deviceId, buyerEmail, price })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setMessage(`TRANSFER INITIATED. Mandatory Handover Code: ${data.handoverCode}. Give this code to the customer to complete the 2FA transfer.`);
        } catch (err: any) {
            setError(`Failed to initiate sale: ${err.message}`);
        } finally {
            fetchDashboardData(); // Refresh inventory and sales lists
        }
    };

    const runTransferPrompt = (deviceId: string) => {
        const buyerEmail = prompt("Enter the customer's PTS registered email to transfer ownership: ");
        if (buyerEmail) {
            const price = prompt("Enter the selling price for this device (₦) (or leave empty): ");
            initiateSale(deviceId, buyerEmail, price || '0');
        }
    };

    const handleReportDevice = async (imei: string, status: 'STOLEN' | 'LOST') => {
        if (!confirm(`Are you sure you want to report this device as ${status}? This will lock the device.`)) return;
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const res = await fetch(`${apiUrl}/devices/${imei}/report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('pts_token')}`
                },
                body: JSON.stringify({ status })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setMessage(`Device marked as ${status}`);
            fetchDashboardData();
        } catch (err: any) {
            setError(`Failed to report device: ${err.message}`);
        }
    };

    const acceptTransfer = async (transferId: string) => {
        const handoverCode = prompt("Enter the 6-digit Handover Code provided by the seller to verify device 2FA handover:");
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

            setMessage('Transfer Verified! Device is now cryptographically bound to your vendor portfolio.');
            fetchDashboardData();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleSearchDevice = async () => {
        if (searchImei.length < 15) return;
        setSearchLoading(true);
        setError('');
        setFoundDevice(null);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const res = await fetch(`${apiUrl}/passports/${searchImei}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('pts_token')}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Device not found in registry');
            setFoundDevice(data.device);
            setMaintenanceHistory(data.maintenance || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSearchLoading(false);
        }
    };

    const printReceipt = async (sale: any) => {
        setIsGeneratingReceipt(sale.id);
        const receiptData = {
            id: sale.id.split('-')[0].toUpperCase(),
            date: new Date(sale.transferDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
            vendor: profile?.companyName,
            vendorEmail: profile?.email,
            device: {
                brand: sale.device.brand,
                model: sale.device.model,
                imei: sale.device.imei,
            },
            buyer: sale.buyer.email,
            verificationUrl: `https://pts-registry.vercel.app/verify/${sale.device.imei}`
        };
        setReceiptData(receiptData);

        // Small delay to allow React to render the invisible template
        setTimeout(async () => {
            if (receiptRef.current) {
                try {
                    // Pre-load images for html2canvas to ensure they capture
                    const images = receiptRef.current.querySelectorAll('img');
                    await Promise.all(Array.from(images).map(img => {
                        if (img.complete) return Promise.resolve();
                        return new Promise(resolve => {
                            img.onload = resolve;
                            img.onerror = resolve;
                        });
                    }));

                    const canvas = await html2canvas(receiptRef.current, {
                        scale: 3,
                        useCORS: true,
                        logging: false,
                        backgroundColor: '#ffffff',
                        windowWidth: 794,
                        windowHeight: 1123
                    });
                    const imgData = canvas.toDataURL('image/png', 1.0);
                    const pdf = new jsPDF('p', 'mm', 'a4');
                    const pdfWidth = pdf.internal.pageSize.getWidth();
                    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

                    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
                    pdf.save(`PTS_RECEIPT_${sale.device.imei}.pdf`);
                } catch (err) {
                    console.error('Failed to generate Receipt PDF:', err);
                    alert('Digital signature verify failed. Protocol error (Rendering).');
                }
            }
            setIsGeneratingReceipt(null);
            setReceiptData(null);
        }, 1200);
    };

    const handleLogRepair = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!foundDevice) return;
        setIsLoggingRepair(true);
        setMessage(''); setError('');
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const res = await fetch(`${apiUrl}/maintenance/log`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('pts_token')}`
                },
                body: JSON.stringify({
                    imei: foundDevice.imei,
                    serviceType,
                    description: repairDesc,
                    partsReplaced: parts,
                    cost: repairCost
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setMessage(`Service record cryptographically signed and added to IMEI: ${foundDevice.imei}`);
            setFoundDevice(null); setSearchImei(''); setRepairDesc(''); setParts(''); setRepairCost('');
            setActiveTab('inventory');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoggingRepair(false);
        }
    };

    if (loading) {
        return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white"><div className="animate-pulse">Loading Vendor Profile...</div></div>;
    }

    return (
        <div className="min-h-screen bg-slate-950 font-sans text-slate-200">
            <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-xl">
                <div className="text-white font-bold flex items-center gap-3">
                    <span className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">PTS</span>
                    <div className="flex flex-col">
                        <span className="leading-tight truncate max-w-[150px] sm:max-w-none">{profile?.companyName || 'Vendor Profile'}</span>
                        <span className="text-[10px] text-blue-400 uppercase tracking-widest font-bold flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                            Tier {profile?.vendorTier} Verified Retailer
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <a href="/vendor/scanner" className="text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors hidden sm:block">Pre-Purchase Scanner</a>
                    <button onClick={() => { localStorage.removeItem('pts_token'); window.location.href = '/vendor/login'; }} className="text-sm font-medium text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 px-4 py-2 rounded-lg transition-colors border border-slate-700">Sign Out</button>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 mt-4">
                {/* Top Metrics Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform"><svg className="w-20 h-20 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11 4a1 1 0 10-2 0v4a1 1 0 102 0V7zm-3 1a1 1 0 10-2 0v3a1 1 0 102 0V8zM8 9a1 1 0 00-2 0v2a1 1 0 102 0V9z" clipRule="evenodd" /></svg></div>
                        <p className="text-sm font-bold text-slate-500 mb-1 tracking-wider uppercase">Active Inventory</p>
                        <h3 className="text-4xl font-black text-white">{metrics?.totalInventory} <span className="text-lg font-medium text-slate-500">devices</span></h3>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform"><svg className="w-20 h-20 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg></div>
                        <p className="text-sm font-bold text-slate-500 mb-1 tracking-wider uppercase">Units Sold</p>
                        <h3 className="text-4xl font-black text-emerald-400">{metrics?.totalSales} <span className="text-lg font-medium text-emerald-600/50">historical</span></h3>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-slate-500 mb-1 tracking-wider uppercase">Public Trust Index</p>
                            <h3 className="text-4xl font-black text-white">{metrics?.trustScore}<span className="text-xl font-bold text-slate-600">/100</span></h3>
                            <p className="text-xs font-semibold text-blue-400 mt-1">Excellent Standing</p>
                        </div>
                        <div className="w-16 h-16 rounded-full border-4 border-slate-800 flex items-center justify-center shrink-0" style={{ background: `conic-gradient(from 0deg, #3b82f6 ${(metrics?.trustScore || 0)}%, transparent 0)` }}>
                            <div className="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center">
                                <span className="font-bold text-xs">TIER {profile?.vendorTier}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Dashboard Navigation */}
                <div className="flex border-b border-slate-800 mb-8 overflow-x-auto hide-scrollbar">
                    <button onClick={() => setActiveTab('inventory')} className={`pb-4 px-6 text-sm font-bold tracking-wide break-keep whitespace-nowrap transition-colors border-b-2 ${activeTab === 'inventory' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>My Store Inventory</button>
                    <button onClick={() => setActiveTab('sales')} className={`pb-4 px-6 text-sm font-bold tracking-wide break-keep whitespace-nowrap transition-colors border-b-2 ${activeTab === 'sales' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Sales Ledger</button>
                    <button onClick={() => setActiveTab('messages')} className={`pb-4 px-6 text-sm font-bold tracking-wide break-keep whitespace-nowrap transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'messages' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                        <div className="relative">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                            {messages.length > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-slate-900"></span>}
                        </div>
                        Signals & Intel
                    </button>
                    <button onClick={() => setActiveTab('maintenance')} className={`pb-4 px-6 text-sm font-bold tracking-wide break-keep whitespace-nowrap transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'maintenance' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        Service & Repair
                    </button>
                    <button onClick={() => setActiveTab('register')} className={`pb-4 px-6 text-sm font-bold tracking-wide break-keep whitespace-nowrap transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'register' ? 'border-blue-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg> Add Inventory
                    </button>
                    <button onClick={() => setActiveTab('report')} className={`pb-4 px-6 text-sm font-bold tracking-wide break-keep whitespace-nowrap transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'report' ? 'border-red-500 text-red-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> Report Threat
                    </button>
                </div>

                {message && <p className="mb-6 p-4 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-3 font-medium animate-in fade-in slide-in-from-top-2"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> {message}</p>}
                {error && <p className="mb-6 p-4 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-3 font-medium animate-in fade-in slide-in-from-top-2"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> {error}</p>}

                {/* Tab Content: Inventory */}
                {activeTab === 'inventory' && (
                    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
                        {/* Pending Transfers Alert */}
                        {pendingTransfers.length > 0 && (
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                                    <svg className="w-24 h-24 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11 4a1 1 0 10-2 0v4a1 1 0 102 0V7zm-3 1a1 1 0 10-2 0v3a1 1 0 102 0V8zM8 9a1 1 0 00-2 0v2a1 1 0 102 0V9z" clipRule="evenodd" /></svg>
                                </div>
                                <h2 className="text-xl font-bold text-amber-500 mb-4 flex items-center gap-2"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg> Incoming Vendor-to-Vendor Transfers</h2>
                                <div className="space-y-4 relative z-10">
                                    {pendingTransfers.map((tx: any) => (
                                        <div key={tx.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-900/80 p-5 rounded-xl border border-slate-700/50 hover:border-amber-500/50 transition-colors">
                                            <div>
                                                <p className="font-semibold text-white text-lg">{tx.device.brand} {tx.device.model}</p>
                                                <p className="text-sm text-slate-400">From: {tx.seller.companyName || tx.seller.email} • IMEI: {tx.device.imei}</p>
                                            </div>
                                            <button onClick={() => acceptTransfer(tx.id)} className="mt-4 sm:mt-0 bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 px-6 rounded-xl transition-colors shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2">
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                Accept Transfer
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
                            {inventory.length === 0 ? (
                                <div className="p-16 text-center border-b border-slate-800">
                                    <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-10 h-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg></div>
                                    <h3 className="text-xl font-bold text-white mb-2">No Active Inventory</h3>
                                    <p className="text-slate-400 mb-6 max-w-sm mx-auto">You currently have no devices registered in your store's possession.</p>
                                    <button onClick={() => setActiveTab('register')} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg">Register First Device</button>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-950 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500 font-bold">
                                                <th className="p-5">Device Make</th>
                                                <th className="p-5">IMEI Number</th>
                                                <th className="p-5">Status</th>
                                                <th className="p-5">Risk</th>
                                                <th className="p-5">Market Value</th>
                                                <th className="p-5 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800 flex-1">
                                            {inventory.map(device => (
                                                <tr key={device.id} className="hover:bg-slate-800/30 transition-colors group">
                                                    <td className="p-5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex-shrink-0 shadow-inner group-hover:border-emerald-500/30 transition-colors">
                                                                {device.devicePhotos && device.devicePhotos.length > 0 ? (
                                                                    <img src={device.devicePhotos[0]} alt={device.model} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-slate-700">
                                                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-white">{device.brand}</p>
                                                                <p className="text-sm text-slate-400">{device.model}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-5 font-mono text-slate-300 tracking-widest">{device.imei}</td>
                                                    <td className="p-5">
                                                        <span className={`inline-flex px-2 py-1 rounded-md text-xs font-bold ${device.status === 'CLEAN' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                                            {device.status}
                                                        </span>
                                                        {device.incidents && device.incidents.length > 0 && device.incidents[0].locationSharedWithOwner && (
                                                            <div className="mt-1 flex items-center gap-1.5 animate-pulse">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                                                                <span className="text-[10px] font-black text-purple-400 uppercase tracking-tighter">Live Shared</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-5 font-bold text-slate-300">{device.riskScore}</td>
                                                    <td className="p-5">
                                                        <div className="text-sm font-black text-white">
                                                            ₦{device.estimatedValue?.toLocaleString()}
                                                            <span className="ml-1 text-[10px] text-slate-500 font-normal uppercase tracking-tighter">NGN</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-5 text-right transition-all">
                                                        <div className="flex justify-end gap-2">
                                                            <button onClick={() => runTransferPrompt(device.id)} className="bg-blue-600 hover:bg-blue-500 text-xs text-white font-bold py-2 px-4 rounded-lg shadow">Sell / Transfer</button>
                                                            {device.status === 'CLEAN' && (
                                                                <button onClick={() => handleReportDevice(device.imei, 'STOLEN')} className="bg-red-500 hover:bg-red-600 text-xs text-white font-bold py-2 px-4 rounded-lg shadow">Report</button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Tab Content: Sales History */}
                {activeTab === 'sales' && (
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                        {sales.length === 0 ? (
                            <div className="p-16 text-center">
                                <h3 className="text-xl font-bold text-white mb-2">No Sales History</h3>
                                <p className="text-slate-400">You haven't completed any device transfers yet.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-950 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500 font-bold">
                                            <th className="p-5">Date</th>
                                            <th className="p-5">Device Sold</th>
                                            <th className="p-5">Buyer Identity</th>
                                            <th className="p-5 text-right">Official Documents</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800 flex-1">
                                        {sales.map((sale: any) => (
                                            <tr key={sale.id} className="hover:bg-slate-800/30 transition-colors group">
                                                <td className="p-5 text-sm font-medium text-slate-400 font-mono italic uppercase tracking-tighter">{new Date(sale.transferDate).toLocaleDateString()}</td>
                                                <td className="p-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 overflow-hidden flex-shrink-0 shadow-inner">
                                                            {sale.device.devicePhotos && sale.device.devicePhotos.length > 0 ? (
                                                                <img src={sale.device.devicePhotos[0]} alt={sale.device.model} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-slate-700">
                                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-white mb-0.5">{sale.device.brand} {sale.device.model}</p>
                                                            <p className="text-xs font-mono text-slate-500 tracking-widest leading-none">{sale.device.imei}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-5 font-bold text-slate-300 truncate max-w-[150px]">{sale.buyer.email}</td>
                                                <td className="p-5 text-right">
                                                    <button
                                                        onClick={() => printReceipt(sale)}
                                                        disabled={isGeneratingReceipt === sale.id}
                                                        className="inline-flex items-center gap-2 text-blue-400 hover:text-white text-xs font-black bg-blue-500/10 hover:bg-blue-600 px-4 py-2 rounded-xl border border-blue-500/20 transition-all uppercase tracking-widest disabled:opacity-50"
                                                    >
                                                        {isGeneratingReceipt === sale.id ? (
                                                            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                        ) : (
                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                        )}
                                                        {isGeneratingReceipt === sale.id ? 'Exporting...' : 'Print Receipt'}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Tab Content: Maintenance Logging */}
                {activeTab === 'maintenance' && (
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-xl animate-in fade-in zoom-in-95 duration-300">
                        <div className="mb-10 text-center max-w-2xl mx-auto">
                            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                                <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </div>
                            <h2 className="text-2xl font-black text-white uppercase tracking-tight">Verified Service Center</h2>
                            <p className="text-slate-400 mt-2">Search for a device in the national registry to log a signed maintenance or repair record.</p>
                        </div>

                        {!foundDevice ? (
                            <div className="max-w-xl mx-auto pb-10">
                                <label className="block text-xs font-black text-slate-500 mb-3 uppercase tracking-[0.2em]">Target Device IMEI</label>
                                <div className="flex gap-3">
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            value={searchImei}
                                            onChange={e => setSearchImei(e.target.value.replace(/\D/g, '').slice(0, 15))}
                                            placeholder="Enter 15-digit IMEI..."
                                            className="w-full bg-slate-950/50 border border-slate-700/50 rounded-2xl px-5 py-4 text-white font-mono tracking-widest focus:outline-none focus:border-emerald-500 transition-all shadow-inner"
                                        />
                                        {searchLoading && <div className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full"></div>}
                                    </div>
                                    <button
                                        onClick={handleSearchDevice}
                                        disabled={searchImei.length < 15 || searchLoading}
                                        className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black px-8 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 uppercase tracking-widest text-xs"
                                    >
                                        Verify
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleLogRepair} className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 p-8 bg-slate-950/40 rounded-[2.5rem] border border-slate-800 shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                                    <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.9L10 1.154l7.834 3.746v6.5c0 4.81-3.342 9.303-7.834 10.51a11.95 11.95 0 01-7.834-10.51v-6.5zm7.834 11.332a.75.75 0 01-.75-.75V8a.75.75 0 011.5 0v7.482a.75.75 0 01-.75.75z" clipRule="evenodd" /></svg>
                                </div>

                                {/* Found Device Info */}
                                <div className="md:col-span-1 space-y-6">
                                    <div className="p-6 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl">
                                        <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-4">Device Identified</p>
                                        <div className="flex items-center gap-4 mb-6">
                                            <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden flex-shrink-0">
                                                {foundDevice.devicePhotos && foundDevice.devicePhotos.length > 0 ? (
                                                    <img src={foundDevice.devicePhotos[0]} alt="Device" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-slate-600"><svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg></div>
                                                )}
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-white leading-tight">{foundDevice.brand}</h3>
                                                <p className="text-xs text-slate-400 font-medium">{foundDevice.model}</p>
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <div>
                                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-0.5">Registry Status</p>
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded ${foundDevice.status === 'CLEAN' ? 'orange-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                                    {foundDevice.status} DEVICE
                                                </span>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-0.5">IMEI Identity</p>
                                                <p className="text-xs font-mono text-slate-300 tracking-tighter">{foundDevice.imei}</p>
                                            </div>
                                        </div>
                                        <button type="button" onClick={() => setFoundDevice(null)} className="w-full mt-6 text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-colors py-2 border-t border-slate-800">Switch Device</button>
                                    </div>

                                    {maintenanceHistory.length > 0 && (
                                        <div className="p-6 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-y-auto max-h-[300px] hide-scrollbar">
                                            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                Repair History ({maintenanceHistory.length})
                                            </p>
                                            <div className="space-y-4">
                                                {maintenanceHistory.map((record: any) => (
                                                    <div key={record.id} className="border-l-2 border-blue-500/50 pl-3">
                                                        <p className="text-xs font-bold text-white leading-tight mb-1">{record.serviceType?.replace('_', ' ')}</p>
                                                        <p className="text-[10px] text-slate-400 line-clamp-2">{record.description}</p>
                                                        {record.partsReplaced && <p className="text-[10px] text-slate-500 mt-1"><span className="font-bold text-slate-600">Parts:</span> {record.partsReplaced}</p>}
                                                        <p className="text-[9px] text-slate-600 mt-1 font-mono">{new Date(record.serviceDate).toLocaleDateString()}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Repair Form */}
                                <div className="md:col-span-2 space-y-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div className="sm:col-span-2">
                                            <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">Type of Service</label>
                                            <select
                                                value={serviceType}
                                                onChange={e => setServiceType(e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-all font-bold text-sm"
                                            >
                                                <option value="GENERAL_REPAIR">General Hardware Repair</option>
                                                <option value="SCREEN_REPLACEMENT">Screen / Display Panel</option>
                                                <option value="BATTERY_CHANGE">Battery Replacement</option>
                                                <option value="SOFTWARE_RESTORE">Software Restore / Update</option>
                                                <option value="MOTHERBOARD_REPAIR">Logical Board / CPU Repair</option>
                                                <option value="CAMERA_REPAIR">Optical System / Camera</option>
                                                <option value="CLEANUP">Diagnostic & Deep Clean</option>
                                            </select>
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">Service Description</label>
                                            <textarea
                                                value={repairDesc}
                                                onChange={e => setRepairDesc(e.target.value)}
                                                required
                                                placeholder="Explain work performed, diagnostic results, etc."
                                                rows={3}
                                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-all text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">Parts Catalogued</label>
                                            <input
                                                type="text"
                                                value={parts}
                                                onChange={e => setParts(e.target.value)}
                                                placeholder="e.g. OEM Screen v4.2"
                                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-all text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">Recorded Cost (Opt)</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₦</span>
                                                <input
                                                    type="number"
                                                    value={repairCost}
                                                    onChange={e => setRepairCost(e.target.value)}
                                                    placeholder="0.00"
                                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-all text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="pt-6 border-t border-slate-800 flex justify-end">
                                        <button
                                            type="submit"
                                            disabled={isLoggingRepair || !repairDesc}
                                            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black py-4 px-10 rounded-2xl transition-all shadow-xl shadow-emerald-500/20 uppercase tracking-widest text-xs flex items-center gap-3"
                                        >
                                            {isLoggingRepair ? (
                                                <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div> Signing Ledger...</>
                                            ) : (
                                                <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> Log Official Service</>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        )}
                    </div>
                )}

                {/* Tab Content: Messages / Signals */}
                {activeTab === 'messages' && (
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                        <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold text-white uppercase tracking-tight">Security Signals & Alerts</h2>
                                <p className="text-slate-400 text-[10px] mt-1 uppercase tracking-widest font-mono font-bold">Encrypted Communication Uplink</p>
                            </div>
                            <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full">
                                <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
                                <span className="text-[10px] font-black text-purple-400 uppercase">Secure Link Active</span>
                            </div>
                        </div>
                        {messages.length === 0 ? (
                            <div className="p-20 text-center">
                                <svg className="w-16 h-16 text-slate-700 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                <h3 className="text-lg font-bold text-slate-400 uppercase tracking-widest">No Active Signals</h3>
                                <p className="text-slate-600 text-sm mt-1">Authorities have not transmitted any alerts to your vendor ID yet.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-800">
                                {messages.map((msg, i) => (
                                    <div key={i} className="p-6 hover:bg-slate-800/30 transition-all group relative border-l-4 border-l-transparent hover:border-l-purple-500">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shadow-inner ${msg.sender.role === 'ADMIN' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'bg-red-600/20 text-red-400 border border-red-500/30'}`}>
                                                    {msg.sender.role === 'ADMIN' ? 'SYS' : 'LE'}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-white group-hover:text-purple-400 transition-colors uppercase tracking-tight">{msg.subject}</h4>
                                                    <p className="text-[10px] text-slate-500 font-mono font-bold">{new Date(msg.createdAt).toLocaleString()}</p>
                                                </div>
                                            </div>
                                            <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest bg-slate-950 px-2 py-1 rounded-md border border-slate-800">UPLINK_ID: {msg.id.slice(-8)}</span>
                                        </div>
                                        <div className="pl-13 ml-[52px]">
                                            <p className="text-sm text-slate-300 leading-relaxed font-medium">
                                                {msg.body}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Tab Content: Register Device (Original UI slightly improved) */}
                {activeTab === 'register' && (
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-xl animate-in fade-in zoom-in-95 duration-300">
                        <div className="mb-8">
                            <h2 className="text-xl font-bold text-white">Add Device to National DB</h2>
                            <p className="text-slate-400 text-sm mt-1">Cryptographically bind clean devices to your vendor ID before putting them on display.</p>
                        </div>
                        <form onSubmit={handleRegister} className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="sm:col-span-2 relative group">
                                    <label className="block text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wide">15-Digit IMEI Number <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                        <input type="text" value={imei} onChange={e => setImei(e.target.value.replace(/\D/g, '').slice(0, 15))} required placeholder="e.g. 359123456789012" className="w-full bg-slate-950/50 border border-slate-700/50 hover:border-slate-600 rounded-xl pl-12 pr-4 py-3 text-white font-mono tracking-wider focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" />
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-slate-800">
                                    <h3 className="text-sm font-black text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04M12 2.944V21m0-18.056L3.382 7.056M12 2.944l8.618 4.112M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        Hardware DNA Registry (Forensics)
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">Screen Serial No.</label>
                                            <input
                                                type="text"
                                                value={screenSerial}
                                                onChange={e => setScreenSerial(e.target.value)}
                                                placeholder="Part ID: SCR-XXXX"
                                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all text-sm font-mono"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">Battery Serial No.</label>
                                            <input
                                                type="text"
                                                value={batterySerial}
                                                onChange={e => setBatterySerial(e.target.value)}
                                                placeholder="Part ID: BAT-XXXX"
                                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all text-sm font-mono"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">Logic Board (Motherboard)</label>
                                            <input
                                                type="text"
                                                value={motherboardSerial}
                                                onChange={e => setMotherboardSerial(e.target.value)}
                                                placeholder="Part ID: MOB-XXXX"
                                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all text-sm font-mono"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">Camera Module</label>
                                            <input
                                                type="text"
                                                value={cameraSerial}
                                                onChange={e => setCameraSerial(e.target.value)}
                                                placeholder="Part ID: CAM-XXXX"
                                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all text-sm font-mono"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wide">Device Brand <span className="text-red-500">*</span></label>
                                    <input type="text" value={brand} onChange={e => setBrand(e.target.value)} required placeholder="e.g. Apple" className="w-full bg-slate-950/50 border border-slate-700/50 hover:border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wide">Device Model <span className="text-red-500">*</span></label>
                                    <input type="text" value={model} onChange={e => setModel(e.target.value)} required placeholder="e.g. iPhone 14 Pro" className="w-full bg-slate-950/50 border border-slate-700/50 hover:border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wide">Hardware Serial No (Opt)</label>
                                    <input type="text" value={serial} onChange={e => setSerial(e.target.value)} placeholder="Found in Settings/About" className="w-full bg-slate-950/50 border border-slate-700/50 hover:border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" />
                                </div>
                                <div className="sm:col-span-2 p-4 bg-blue-950/20 rounded-2xl border border-blue-900/30">
                                    <label className="block text-sm font-semibold text-blue-400 mb-2 uppercase tracking-wide flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                        Device Photo Upload (Optional)
                                    </label>
                                    <input type="file" multiple accept="image/*" onChange={(e) => setDevicePhotos(Array.from(e.target.files || []))} className="w-full text-slate-400 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-600/20 file:text-blue-400 hover:file:bg-blue-600/30 transition-colors cursor-pointer" />
                                </div>
                            </div>
                            <div className="pt-4 border-t border-slate-800 flex justify-end">
                                <button type="submit" disabled={imei.length < 15 || isRegistering} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg flex items-center gap-2 disabled:opacity-50">
                                    {isRegistering ? (
                                        <><svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Securing to DB...</>
                                    ) : (
                                        <><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg> Secure to Vendor Inventory</>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Tab Content: Report Suspicious */}
                {activeTab === 'report' && (
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-xl animate-in fade-in zoom-in-95 duration-300 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                            <svg className="w-32 h-32 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        </div>
                        <div className="mb-8 relative z-10">
                            <h2 className="text-xl font-bold text-red-500 uppercase tracking-tight flex items-center gap-2">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                Log Suspicious Suspect/Device
                            </h2>
                            <p className="text-slate-400 text-sm mt-1">If a walk-in attempts to sell you a device that seems stolen or suspicious, securely alert authorities without confronting them directly.</p>
                        </div>
                        <form onSubmit={handleSubmitSuspiciousReport} className="space-y-6 relative z-10">
                            <div className="grid grid-cols-1 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wide">Target IMEI <span className="text-red-500">*</span></label>
                                    <input type="text" value={suspiciousImei} onChange={e => setSuspiciousImei(e.target.value.replace(/\D/g, '').slice(0, 15))} required placeholder="15-digit IMEI of the suspect device" className="w-full bg-slate-950/50 border border-slate-700/50 hover:border-slate-600 rounded-xl px-4 py-3 text-white font-mono tracking-wider focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wide">Suspect Email (If Known)</label>
                                    <input type="email" value={suspectEmail} onChange={e => setSuspectEmail(e.target.value)} placeholder="Email of the individual trying to sell the device" className="w-full bg-slate-950/50 border border-slate-700/50 hover:border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wide">Incident Description <span className="text-red-500">*</span></label>
                                    <textarea value={suspiciousDesc} onChange={e => setSuspiciousDesc(e.target.value)} required placeholder="Provide physical description, behavior, or any evidence..." rows={4} className="w-full bg-slate-950/50 border border-slate-700/50 hover:border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all text-sm"></textarea>
                                </div>
                            </div>
                            <div className="pt-4 border-t border-slate-800 flex justify-end">
                                <button type="submit" disabled={suspiciousImei.length < 15 || isReportingSuspicious} className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg flex items-center gap-2 disabled:opacity-50 uppercase tracking-widest text-xs">
                                    {isReportingSuspicious ? (
                                        <><svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> TRANSMITTING...</>
                                    ) : (
                                        <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> SEND SECURE ALERT</>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </main>

            {/* Hidden High-Fidelity Sales Receipt Template for PDF Generation */}
            <div style={{ position: 'fixed', top: '0', left: '200%', pointerEvents: 'none' }}>
                {receiptData && (
                    <div ref={receiptRef} style={{ width: '800px', padding: '60px' }} className="bg-white text-slate-900 font-sans relative flex flex-col min-h-[1000px]">
                        {/* Header Section */}
                        <div className="flex justify-between items-start border-b-4 border-slate-900 pb-10 mb-10">
                            <div>
                                <h1 className="text-4xl font-black tracking-tighter text-slate-900 italic uppercase leading-none">Official Sales Receipt</h1>
                                <p className="text-sm font-mono font-bold text-blue-600 mt-2 tracking-widest uppercase">Transaction Reference: {receiptData.id}</p>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-black text-slate-900 tracking-tighter leading-none mb-1">PTS NATIONAL REGISTRY</div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Authorized Vendor Network • Phase 4</p>
                            </div>
                        </div>

                        {/* Transaction Partner Info */}
                        <div className="grid grid-cols-2 gap-12 mb-12">
                            <div>
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Authorized Vendor</p>
                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                                    <p className="text-xl font-black text-slate-900 uppercase tracking-tight mb-1">{receiptData.vendor}</p>
                                    <p className="text-sm font-bold text-slate-500 italic uppercase">Verified PTS Retailer</p>
                                    <p className="text-xs font-mono text-slate-400 mt-4">{receiptData.vendorEmail}</p>
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Authenticated Buyer</p>
                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 h-full flex flex-col justify-center">
                                    <p className="text-lg font-black text-slate-900 truncate uppercase mt-auto">{receiptData.buyer}</p>
                                    <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-auto mt-1 italic">Identity-Bound Registrant</p>
                                </div>
                            </div>
                        </div>

                        {/* Asset Specification Section */}
                        <div className="mb-12">
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Asset Details & Manifest</p>
                            <div className="bg-slate-950 text-white p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl relative overflow-hidden">
                                {/* Diagonal Accent */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 -rotate-45 translate-x-16 -translate-y-16"></div>

                                <div className="flex gap-10 items-center">
                                    <div className="w-40 h-40 bg-white/5 rounded-3xl border border-white/10 flex items-center justify-center shrink-0">
                                        <svg className="w-16 h-16 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                    </div>
                                    <div className="flex-1 space-y-6">
                                        <div className="grid grid-cols-2 gap-6">
                                            <div>
                                                <p className="text-[8px] text-slate-500 uppercase font-black mb-1 tracking-widest">Brand / Category</p>
                                                <p className="text-2xl font-black tracking-tight leading-none uppercase">{receiptData.device.brand}</p>
                                            </div>
                                            <div>
                                                <p className="text-[8px] text-slate-500 uppercase font-black mb-1 tracking-widest">Model / Revision</p>
                                                <p className="text-2xl font-black tracking-tight leading-none uppercase">{receiptData.device.model}</p>
                                            </div>
                                        </div>
                                        <div className="pt-6 border-t border-white/10">
                                            <p className="text-[8px] text-slate-500 uppercase font-black mb-1 tracking-widest">Registry Identity (IMEI)</p>
                                            <p className="text-xl font-mono font-bold tracking-[0.2em]">{receiptData.device.imei}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Core Verification Hash Section */}
                        <div className="mt-auto pt-12 border-t border-slate-200">
                            <div className="flex justify-between items-end">
                                <div className="flex gap-8 items-center">
                                    <div className="w-24 h-24 bg-slate-900 p-2 rounded-2xl flex items-center justify-center shadow-lg">
                                        {/* Placeholder QR for receipt verification */}
                                        <div className="w-full h-full bg-slate-800 rounded-xl flex items-center justify-center text-[7px] text-slate-500 text-center uppercase tracking-tighter font-black leading-none italic">PTS<br />SECURE<br />TRANS<br />HASH</div>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none mb-2 underline">Ownership Certification</p>
                                        <p className="text-[9px] text-slate-400 italic max-w-sm leading-relaxed">
                                            This document serves as an official proof of sale. The asset has been cryptographically transferred from the authorized vendor to the specified buyer within the National Property Tracking System. Data integrity is guaranteed via 256-bit hash verification at {receiptData.verificationUrl}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-mono font-black text-slate-900 uppercase leading-none mb-1">Authenticated {receiptData.date}</p>
                                    <p className="text-[8px] text-slate-400 uppercase tracking-widest font-black italic">National Ver: 4.8.1-REC</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
