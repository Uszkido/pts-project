"use client";

import { useState, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { generateCapSign } from '@/lib/capsign';
import LiveView from '@/components/LiveView';
import MapComponent from '@/components/MapComponent';
import MeshScanner from '@/components/MeshScanner';
import DynamicGeoFenceMap from '@/components/Map/DynamicGeoFenceMap';
import { APP_CONFIG } from '@/lib/pts.config';

export default function PoliceDashboard() {
    const [devices, setDevices] = useState<any[]>([]);
    const [reports, setReports] = useState<any[]>([]);
    const [alerts, setAlerts] = useState<any[]>([]);
    const [intel, setIntel] = useState<any[]>([]);
    const [metrics, setMetrics] = useState<any>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Forensic Dossier Generation State
    const [isGeneratingDossier, setIsGeneratingDossier] = useState<string | null>(null);
    const [dossierData, setDossierData] = useState<any>(null);
    const dossierRef = useRef<HTMLDivElement>(null);
    const [filter, setFilter] = useState('STOLEN,LOST'); // Default to incident devices only

    // Search
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSearch, setShowSearch] = useState(false);

    // Suspects
    const [suspects, setSuspects] = useState<any[]>([]);
    const [isAddSuspectOpen, setIsAddSuspectOpen] = useState(false);
    const [suspectForm, setSuspectForm] = useState({ fullName: '', alias: '', nationalId: '', phoneNumber: '', description: '', knownAddresses: '', dangerLevel: 'UNKNOWN' });
    const [isSubmittingSuspect, setIsSubmittingSuspect] = useState(false);

    // UI Tabs
    const [activeTab, setActiveTab] = useState<'registry' | 'incidents' | 'alerts' | 'intel' | 'suspects' | 'messages' | 'warrants' | 'geofence'>('registry');

    // Geo-Fence State
    const [activeFences, setActiveFences] = useState<any[]>([]);
    const [isSavingFence, setIsSavingFence] = useState(false);

    // Messages
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState({ subject: '', body: '' });

    // Live Tracking
    const [liveTrackingImei, setLiveTrackingImei] = useState<string | null>(null);

    // Guardian Mesh Scanner
    const [isMeshScannerOpen, setIsMeshScannerOpen] = useState(false);

    const handleBrick = async (imei: string, reason: string) => {
        if (!window.confirm(`⚠️ WARNING: You are about to BRICK this device (${imei}) permanentely. This will disable all hardware functionality via the National Kill-Switch API. Proceed?`)) return;

        try {
            const { api } = await import('@/lib/api');
            await api.post(`/police/devices/${imei}/brick`, { reason });
            setStatusMessage({ type: 'success', text: `Kill-Switch Activated for ${imei}` });
            fetchData();
        } catch (err: any) {
            setStatusMessage({ type: 'error', text: err.message });
        }
    };

    const handleUnbrick = async (imei: string) => {
        try {
            const { api } = await import('@/lib/api');
            await api.post(`/police/devices/${imei}/unbrick`, {});
            setStatusMessage({ type: 'success', text: `Kill-Switch Deactivated for ${imei}` });
            fetchData();
        } catch (err: any) {
            setStatusMessage({ type: 'error', text: err.message });
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const { api } = await import('@/lib/api');

            // Fetch metrics
            const metricsData = await api.get('/police/dashboard-metrics');
            setMetrics(metricsData);

            // Fetch devices
            const devicesUrl = filter
                ? `/police/devices?status=${filter}`
                : '/police/devices?status=STOLEN,LOST';
            const devicesData = await api.get(devicesUrl);
            setDevices(devicesData.devices || []);

            const [incidentsData, alertsData, messagesData, suspectsData, intelData] = await Promise.all([
                api.get('/police/incidents'),
                api.get('/police/vendor-alerts'),
                api.get('/police/messages'),
                api.get('/police/suspects'),
                api.get('/police/intel-feed')
            ]);

            setReports(incidentsData.reports || []);
            setAlerts(alertsData.alerts || []);
            setMessages(messagesData.messages || []);
            setSuspects(suspectsData.suspects || []);
            setIntel(intelData.feed || []);

        } catch (err: any) {
            setError(err.message);
            if (err.message.includes('Unauthorized') || err.message.includes('Forbidden')) {
                localStorage.removeItem('pts_token');
                window.location.href = '/police/login';
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        if (searchQuery.length < 2) return;
        setIsSearching(true);
        try {
            const { api } = await import('@/lib/api');
            const data = await api.get(`/police/search?q=${encodeURIComponent(searchQuery)}`);
            setSearchResults(data.devices || []);
            setShowSearch(true);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsSearching(false);
        }
    };

    const exportDossier = async (imei: string) => {
        setIsGeneratingDossier(imei);
        try {
            const { api } = await import('@/lib/api');
            const data = await api.get(`/police/export-evidence/${imei}`);

            const d = data.dossier;
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const W = pdf.internal.pageSize.getWidth();
            const H = pdf.internal.pageSize.getHeight();

            // Background
            pdf.setFillColor(2, 8, 23);
            pdf.rect(0, 0, W, H, 'F');

            // Red top bar (Police)
            pdf.setFillColor(220, 38, 38);
            pdf.rect(0, 0, W, 8, 'F');
            pdf.rect(0, H - 8, W, 8, 'F');
            pdf.rect(0, 0, 4, H, 'F');

            // Header
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'bold');
            pdf.text('POLICE TRACKING SYSTEM — LAW ENFORCEMENT DIVISION', W / 2, 18, { align: 'center' });
            pdf.setFontSize(20);
            pdf.setTextColor(220, 38, 38);
            pdf.text('FORENSIC ASSET DOSSIER', W / 2, 30, { align: 'center' });

            pdf.setFontSize(7);
            pdf.setTextColor(239, 68, 68);
            pdf.setFont('helvetica', 'bold');
            pdf.text(`REPORT ID: ${d.reportId}   |   CLASSIFICATION: LAW ENFORCEMENT RESTRICTED`, W / 2, 37, { align: 'center' });

            pdf.setDrawColor(220, 38, 38);
            pdf.setLineWidth(0.4);
            pdf.line(14, 41, W - 14, 41);

            // Meta section
            pdf.setFontSize(7);
            pdf.setTextColor(100, 116, 139);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`Generated: ${new Date(d.generatedAt).toLocaleString()}   |   Officer: ${d.generatedBy}`, 14, 48);

            // Asset Overview Box
            pdf.setFontSize(8);
            pdf.setTextColor(220, 38, 38);
            pdf.setFont('helvetica', 'bold');
            pdf.text('§1 ASSET PROFILE', 14, 56);

            pdf.setFillColor(15, 23, 42);
            pdf.setDrawColor(30, 41, 59);
            pdf.roundedRect(14, 59, W - 28, 44, 2, 2, 'FD');

            const sig = await generateCapSign({ imei: d.asset.imei, timestamp: Date.now(), type: 'DOSSIER' });

            const assetFields = [
                ['DEVICE', `${d.asset.brand} ${d.asset.model}`],
                ['IMEI', d.asset.imei],
                ['SERIAL', d.asset.serial || 'N/A'],
                ['STATUS', d.asset.status],
                ['RISK SCORE', `${d.asset.riskScore}/100`],
                ['CAP-SIGNATURE', sig],
            ];
            let col1Y = 68;
            assetFields.forEach(([label, value]) => {
                pdf.setFontSize(6); pdf.setTextColor(100, 116, 139); pdf.setFont('helvetica', 'bold');
                pdf.text(label, 20, col1Y);
                pdf.setFontSize(label === 'CAP-SIGNATURE' ? 6 : 8);
                pdf.setTextColor(label === 'CAP-SIGNATURE' ? 220 : 255, label === 'CAP-SIGNATURE' ? 38 : 255, label === 'CAP-SIGNATURE' ? 38 : 255);
                pdf.setFont('helvetica', label === 'CAP-SIGNATURE' ? 'bold' : 'normal');
                pdf.text(String(value), 20, col1Y + 3.5);
                col1Y += label === 'CAP-SIGNATURE' ? 9 : 10;
            });

            // Ownership
            pdf.setFontSize(8); pdf.setTextColor(220, 38, 38); pdf.setFont('helvetica', 'bold');
            pdf.text('§2 OWNERSHIP CHAIN', 14, 110);
            pdf.setFillColor(15, 23, 42); pdf.setDrawColor(30, 41, 59);
            pdf.roundedRect(14, 113, W - 28, 22, 2, 2, 'FD');
            pdf.setFontSize(7); pdf.setTextColor(100, 116, 139); pdf.setFont('helvetica', 'normal');
            pdf.text(`Current Owner: `, 20, 121);
            pdf.setTextColor(255, 255, 255);
            pdf.text(d.ownership.current, 50, 121);
            pdf.setTextColor(100, 116, 139);
            pdf.text(`Transfer History: ${d.ownership.chain.length === 0 ? 'No recorded transfers' : d.ownership.chain.map((c: any) => `${c.from} → ${c.to}`).join('; ')}`, 20, 129);

            // Incidents
            pdf.setFontSize(8); pdf.setTextColor(220, 38, 38); pdf.setFont('helvetica', 'bold');
            pdf.text('§3 INCIDENT LOG', 14, 143);
            if (d.incidents.length === 0) {
                pdf.setFontSize(7); pdf.setTextColor(71, 85, 105); pdf.setFont('helvetica', 'italic');
                pdf.text('No criminal incidents recorded against this device.', 20, 150);
            } else {
                let incY = 148;
                d.incidents.slice(0, 4).forEach((inc: any) => {
                    pdf.setFillColor(40, 10, 10); pdf.setDrawColor(60, 20, 20);
                    pdf.roundedRect(14, incY - 4, W - 28, 10, 1, 1, 'FD');
                    pdf.setFontSize(6); pdf.setTextColor(239, 68, 68); pdf.setFont('helvetica', 'bold');
                    pdf.text(`[${inc.type}]`, 18, incY + 1);
                    pdf.setTextColor(200, 200, 200); pdf.setFont('helvetica', 'normal');
                    const desc = inc.desc?.substring(0, 90) || 'N/A';
                    pdf.text(desc, 38, incY + 1);
                    pdf.setTextColor(71, 85, 105);
                    pdf.text(new Date(inc.date).toLocaleDateString(), W - 20, incY + 1, { align: 'right' });
                    incY += 13;
                });
            }

            // Ledger
            const ledgerStartY = d.incidents.length === 0 ? 160 : Math.min(148 + (d.incidents.slice(0, 4).length * 13) + 6, 195);
            pdf.setFontSize(8); pdf.setTextColor(220, 38, 38); pdf.setFont('helvetica', 'bold');
            pdf.text('§4 TRANSACTION LEDGER', 14, ledgerStartY);
            let ledgerY = ledgerStartY + 5;
            if (d.ledger.length === 0) {
                pdf.setFontSize(7); pdf.setTextColor(71, 85, 105); pdf.setFont('helvetica', 'italic');
                pdf.text('No ledger entries recorded.', 20, ledgerY + 2);
            } else {
                d.ledger.slice(0, 5).forEach((entry: any) => {
                    if (ledgerY > H - 30) return;
                    pdf.setFontSize(6); pdf.setTextColor(100, 116, 139); pdf.setFont('helvetica', 'normal');
                    pdf.text(`• [${entry.type}] ${entry.details?.substring(0, 80) || ''}`, 18, ledgerY);
                    ledgerY += 6;
                });
            }

            // Footer
            pdf.setFontSize(6); pdf.setTextColor(71, 85, 105);
            pdf.text('This document is classified law enforcement intelligence. Unauthorized disclosure is a criminal offence.', W / 2, H - 14, { align: 'center' });
            pdf.setTextColor(100, 116, 139);
            pdf.text('© VEXEL INNOVATIONS 2026 — PTS FORENSIC DIVISION', W / 2, H - 10, { align: 'center' });

            pdf.save(`PTS_FORENSIC_DOSSIER_${imei}.pdf`);
            setStatusMessage({ type: 'success', text: 'Forensic dossier PDF generated and downloaded.' });

        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsGeneratingDossier(null);
            setDossierData(null);
        }
    };

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { api } = await import('@/lib/api');
            await api.post('/police/messages', { ...newMessage, receiverRole: 'ADMIN' });
            setNewMessage({ subject: '', body: '' });
            fetchData();
            alert('Intelligence dispatched to System Administrator.');
        } catch (err: any) { alert(err.message); }
    };

    useEffect(() => {
        if (!localStorage.getItem('pts_token')) {
            window.location.href = '/police/login';
            return;
        }
        fetchData();
    }, [filter]);

    const updateStatus = async (imei: string, newStatus: string) => {
        // Optimistically update the device in the list for immediate feedback
        setDevices(prev => prev.map(d => d.imei === imei ? { ...d, status: newStatus } : d));
        const actionLabel = newStatus === 'INVESTIGATING' ? 'Marked as INVESTIGATING' : newStatus === 'CLEAN' ? 'Cleared — Device restored to CLEAN status' : `Status changed to ${newStatus}`;
        setStatusMessage({ type: 'success', text: `✓ ${actionLabel} for IMEI: ${imei}` });
        setTimeout(() => setStatusMessage(null), 4000);
        try {
            const { api } = await import('@/lib/api');
            await api.put(`/police/devices/${imei}/status`, { status: newStatus });
            // Refresh in background to sync with server
            fetchData();
        } catch (err: any) {
            setStatusMessage({ type: 'error', text: `✗ Failed: ${err.message}` });
            setTimeout(() => setStatusMessage(null), 5000);
            // Revert optimistic update
            fetchData();
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 font-sans text-slate-200 selection:bg-red-500/30">
            <nav className="border-b border-rose-900/50 bg-slate-900/80 backdrop-blur-md px-6 py-4 flex justify-between items-center sticky top-0 z-50">
                <div className="text-white font-bold flex items-center gap-3">
                    <span className="w-9 h-9 rounded-lg bg-red-600 flex items-center justify-center shadow-lg shadow-red-500/20">PTS</span>
                    <div className="flex flex-col">
                        <span className="leading-tight">Law Enforcement</span>
                        <span className="text-[10px] text-red-400 uppercase tracking-widest font-semibold flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-400"></div> Classified Access</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <a href="/police/intelligence" className="text-sm font-semibold text-red-400 hover:text-red-300 transition-colors hidden sm:block">Intelligence Portal</a>
                    <button onClick={() => { localStorage.removeItem('pts_token'); window.location.href = '/police/login'; }} className="text-sm font-medium text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 px-4 py-2 rounded-lg transition-colors border border-slate-700">Terminate Session</button>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto p-4 sm:p-6 mt-6 sm:mt-10">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-white tracking-tight">Command Center</h1>
                        <p className="text-slate-400 text-sm mt-1">National Device Registry and Threat Monitoring</p>
                    </div>
                    <div className="ml-auto hidden sm:block">
                        <button onClick={() => setIsMeshScannerOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)] border border-emerald-400/50 text-white text-[10px] font-black uppercase tracking-widest px-4 py-3 rounded-xl transition-all flex items-center gap-2">
                            <svg className="w-5 h-5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" /></svg>
                            Guardian Radar <span className="text-[8px] bg-slate-950/30 px-1.5 py-0.5 rounded ml-1">BETA</span>
                        </button>
                    </div>
                </div>

                {error && <p className="mb-6 p-4 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 font-medium">{error}</p>}

                {/* Device Search Bar */}
                <div className="mb-8 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
                    <div className="flex gap-3">
                        <div className="relative flex-1">
                            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                placeholder="Search devices by IMEI, brand, model, owner email..."
                                className="w-full bg-slate-950/80 border border-slate-700/50 rounded-xl pl-12 pr-4 py-3.5 text-white focus:outline-none focus:border-red-600 transition-all placeholder:text-slate-600"
                            />
                        </div>
                        <button onClick={handleSearch} disabled={isSearching || searchQuery.length < 2} className="bg-red-600 hover:bg-red-500 text-white font-bold px-8 rounded-xl transition-all disabled:opacity-50 flex items-center gap-2">
                            {isSearching ? 'Scanning...' : 'Search'}
                        </button>
                    </div>

                    {/* Search Results Dropdown */}
                    {showSearch && (
                        <div className="mt-4 border-t border-slate-800 pt-4">
                            <div className="flex justify-between items-center mb-3">
                                <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Search Results ({searchResults.length})</p>
                                <button onClick={() => { setShowSearch(false); setSearchResults([]); setSearchQuery(''); }} className="text-xs text-slate-500 hover:text-white">Clear</button>
                            </div>
                            {searchResults.length === 0 ? (
                                <p className="text-sm text-slate-500 py-4 text-center">No devices found matching "{searchQuery}"</p>
                            ) : (
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {searchResults.map((device: any) => (
                                        <div key={device.id} onClick={() => { setLiveTrackingImei(device.imei); setShowSearch(false); setActiveTab('registry'); }} className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/50 border border-slate-800 hover:border-red-900/50 transition-colors group cursor-pointer">
                                            <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 overflow-hidden flex-shrink-0">
                                                {device.devicePhotos && device.devicePhotos.length > 0 ? (
                                                    <img src={device.devicePhotos[0]} alt={device.model} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-slate-700">
                                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-white group-hover:text-red-400 transition-colors truncate">{device.brand} {device.model}</p>
                                                <p className="text-xs font-mono text-slate-500 tracking-widest truncate">{device.imei}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${device.status === 'CLEAN' ? 'bg-emerald-500/10 text-emerald-400' : device.status === 'STOLEN' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>{device.status}</span>
                                                {(device.status === 'STOLEN' || device.status === 'LOST' || device.status === 'INVESTIGATING') && (
                                                    <button
                                                        onClick={() => { setLiveTrackingImei(device.imei); setShowSearch(false); }}
                                                        className="flex items-center gap-1.5 text-[9px] font-black text-red-400 hover:text-white bg-red-500/10 hover:bg-red-600 px-2.5 py-1.5 rounded-lg border border-red-500/20 hover:border-transparent transition-all uppercase tracking-wide"
                                                    >
                                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                        Track
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Top Metrics Row */}
                {metrics && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors"></div>
                            <h3 className="text-slate-400 font-semibold text-sm mb-1 uppercase tracking-wider">Total Devices</h3>
                            <div className="text-3xl font-black text-white">{metrics.totalDevices}</div>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors"></div>
                            <h3 className="text-slate-400 font-semibold text-sm mb-1 uppercase tracking-wider">Clean / Verified</h3>
                            <div className="text-3xl font-black text-emerald-500">{metrics.cleanDevices}</div>
                        </div>
                        <div className="bg-slate-900 border border-red-900/30 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl group-hover:bg-red-500/20 transition-colors"></div>
                            <h3 className="text-slate-400 font-semibold text-sm mb-1 uppercase tracking-wider">Stolen Assets</h3>
                            <div className="text-3xl font-black text-red-500">{metrics.stolenDevices}</div>
                            {metrics.stolenDevices > 0 && <span className="absolute bottom-5 right-5 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span>}
                        </div>
                        <div className="bg-slate-900 border border-amber-900/30 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-colors"></div>
                            <h3 className="text-slate-400 font-semibold text-sm mb-1 uppercase tracking-wider">Active Investigations</h3>
                            <div className="text-3xl font-black text-amber-500">{metrics.investigatingDevices}</div>
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex border-b border-slate-800 mb-6 bg-slate-900/50 p-2 rounded-xl inline-flex">
                    <button onClick={() => setActiveTab('registry')} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'registry' ? 'bg-red-900/30 text-red-300 shadow-lg border border-red-800/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        Stolen / Lost Devices
                        <span className="ml-1 bg-red-500/20 text-red-400 text-[9px] font-black px-1.5 py-0.5 rounded-full border border-red-500/20">{devices.length}</span>
                    </button>
                    <button onClick={() => setActiveTab('incidents')} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'incidents' ? 'bg-slate-800 text-red-400 shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        Incident Reports {metrics?.openIncidents > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">{metrics.openIncidents}</span>}
                    </button>
                    <button onClick={() => setActiveTab('alerts')} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'alerts' ? 'bg-slate-800 text-amber-400 shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                        Vendor Alerts {metrics?.openAlerts > 0 && <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">{metrics.openAlerts}</span>}
                    </button>
                    <button onClick={() => setActiveTab('intel')} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'intel' ? 'bg-slate-800 text-emerald-400 shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        Intel Feed {intel.length > 0 && <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">Live</span>}
                    </button>
                    <button onClick={() => setActiveTab('suspects')} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'suspects' ? 'bg-slate-800 text-purple-400 shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        Suspect Registry ({suspects.length})
                    </button>
                    <button onClick={() => setActiveTab('messages')} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'messages' ? 'bg-slate-800 text-blue-400 shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                        Admin Comms
                    </button>
                    <button onClick={() => setActiveTab('warrants')} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'warrants' ? 'bg-amber-900/30 text-amber-400 shadow-lg border border-amber-800/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        Active Warrants
                    </button>
                    <button onClick={async () => {
                        setActiveTab('geofence');
                        try {
                            const { api } = await import('@/lib/api');
                            const data = await api.get('/devices/geofence');
                            setActiveFences(data.customPerimeters || []);
                        } catch (err) { }
                    }} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'geofence' ? 'bg-cyan-900/30 text-cyan-400 shadow-lg border border-cyan-800/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        🛰 Geo-Fence Deployer
                    </button>
                </div>

                {/* Tab Contents */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in duration-300 min-h-[400px]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center p-20 text-slate-500">
                            <div className="w-12 h-12 border-4 border-red-500/20 border-t-red-500 rounded-full animate-spin mb-4"></div>
                            Decrypting secure channel...
                        </div>
                    ) : activeTab === 'registry' ? (
                        <>
                            {/* Strategic Surveillance Map */}
                            <div className="h-80 w-full relative group">
                                <div className="absolute top-4 left-4 z-[20] bg-slate-950/80 backdrop-blur-md border border-red-500/30 px-3 py-1.5 rounded-lg flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                                    <span className="text-[10px] font-black text-white uppercase tracking-widest">National Surveillance Layer</span>
                                </div>
                                <MapComponent
                                    zoom={6}
                                    markers={devices.map(d => {
                                        const coords = d.lastKnownLocation && d.lastKnownLocation.includes(',') ? d.lastKnownLocation.split(',').map((s: string) => parseFloat(s.trim())) : null;
                                        if (coords && coords.length === 2 && !isNaN(coords[0])) {
                                            return {
                                                lat: coords[0],
                                                lng: coords[1],
                                                label: `${d.brand} ${d.model} (${d.status})`,
                                                color: d.status === 'STOLEN' ? 'red' : 'amber'
                                            };
                                        }
                                        return null;
                                    }).filter(Boolean) as any}
                                    className="h-full w-full"
                                />
                                <div className="absolute inset-0 pointer-events-none border-b border-slate-800 shadow-[inset_0_-40px_40px_rgba(2,6,23,0.8)]"></div>
                            </div>

                            <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                                    <p className="text-xs font-bold text-red-400 uppercase tracking-widest">Active Incident Devices — Restricted Access Feed</p>
                                </div>
                                <select value={filter} onChange={(e) => setFilter(e.target.value)} className="bg-slate-950 border border-slate-700 text-white text-sm rounded-lg focus:ring-red-500 focus:border-red-500 block p-2 outline-none shadow-inner">
                                    <option value="STOLEN,LOST">STOLEN + LOST</option>
                                    <option value="STOLEN">STOLEN Only</option>
                                    <option value="LOST">LOST Only</option>
                                    <option value="INVESTIGATING">INVESTIGATING</option>
                                </select>
                            </div>
                            {/* Status Action Banner */}
                            {statusMessage && (
                                <div className={`mx-4 mt-4 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-3 border animate-in fade-in slide-in-from-top-2 duration-300 ${statusMessage.type === 'success'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                                    }`}>
                                    <span className="text-lg">{statusMessage.type === 'success' ? '✓' : '✗'}</span>
                                    <span>{statusMessage.text}</span>
                                    <button onClick={() => setStatusMessage(null)} className="ml-auto text-slate-500 hover:text-white transition-colors">✕</button>
                                </div>
                            )}
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left text-slate-400">
                                    <thead className="text-xs text-slate-300 uppercase bg-slate-950/50 border-b border-slate-800">
                                        <tr>
                                            <th className="px-6 py-4 font-semibold tracking-wider">IMEI Serial</th>
                                            <th className="px-6 py-4 font-semibold tracking-wider">Device</th>
                                            <th className="px-6 py-4 font-semibold tracking-wider">Registered Owner</th>
                                            <th className="px-6 py-4 font-semibold tracking-wider">Last Location</th>
                                            <th className="px-6 py-4 font-semibold tracking-wider">Status</th>
                                            <th className="px-6 py-4 font-semibold tracking-wider text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {devices.length === 0 ? (
                                            <tr><td colSpan={6} className="px-6 py-16 text-center">
                                                <div className="flex flex-col items-center gap-3">
                                                    <svg className="w-12 h-12 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    <p className="text-slate-500 font-semibold">No active stolen or lost device reports.</p>
                                                    <p className="text-slate-600 text-xs">The national registry is clear for this filter.</p>
                                                </div>
                                            </td></tr>
                                        ) : devices.map((device: any) => (
                                            <tr key={device.id} className="hover:bg-red-900/10 transition-colors border-l-2 border-l-transparent hover:border-l-red-500">
                                                <td className="px-6 py-4 font-mono font-bold text-white tracking-widest">{device.imei}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 overflow-hidden flex-shrink-0">
                                                            {device.devicePhotos && device.devicePhotos.length > 0 ? (
                                                                <img src={device.devicePhotos[0]} alt={device.model} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-slate-600">
                                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-white">{device.brand} {device.model}</div>
                                                            <div className="text-xs text-slate-500 mt-0.5">SN: {device.serialNumber || 'N/A'}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-white font-medium">{device.registeredOwner.companyName || 'Private Citizen'}</div>
                                                    <div className="text-xs text-slate-500">{device.registeredOwner.email}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {device.lastKnownLocation ? (
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0"></div>
                                                                <span className="text-emerald-400 text-xs font-mono font-bold">{device.lastKnownLocation}</span>
                                                            </div>
                                                            {device.lastObservationDate && (
                                                                <div className="flex items-center gap-1.5 opacity-60">
                                                                    <svg className="w-3 h-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" /></svg>
                                                                    <span className="text-[10px] text-blue-300 font-bold uppercase">Mesh Sig: {device.lastBluetoothSig || device.lastWifiSig || 'Guardian Node'}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-600 text-xs font-mono">No ping yet</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-2">
                                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-center ${device.status === 'STOLEN' ? 'bg-red-500/10 text-red-500 border border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]' :
                                                            device.status === 'LOST' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30' :
                                                                device.status === 'INVESTIGATING' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30 animate-pulse' :
                                                                    'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                                            }`}>
                                                            {device.status}
                                                        </span>
                                                        {device.isBricked && (
                                                            <span className="px-2.5 py-1 rounded-full bg-black text-red-600 border border-red-900/50 text-[9px] font-black uppercase tracking-tighter text-center">
                                                                ⚠️ HARDWARE BRICKED ⚠️
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => setLiveTrackingImei(device.imei)}
                                                            className="flex items-center gap-1.5 text-[10px] font-black text-red-400 hover:text-white bg-red-500/10 hover:bg-red-600 px-3 py-1.5 rounded-lg border border-red-500/20 hover:border-transparent transition-all uppercase tracking-wide shadow-lg hover:shadow-red-500/20"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                            Track Live
                                                        </button>
                                                        <button
                                                            onClick={() => exportDossier(device.imei)}
                                                            disabled={isGeneratingDossier === device.imei}
                                                            className={`flex items-center gap-1.5 text-[10px] font-black hover:text-white px-3 py-1.5 rounded-lg border transition-all uppercase tracking-wide ${isGeneratingDossier === device.imei ? 'bg-blue-600/30 text-blue-300 border-blue-500/30 cursor-wait' : 'bg-blue-500/10 text-blue-400 hover:bg-blue-600 border-blue-500/20 hover:border-transparent'}`}
                                                        >
                                                            {isGeneratingDossier === device.imei ? (
                                                                <svg className="animate-spin h-3.5 w-3.5 text-blue-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                            ) : (
                                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                                            )}
                                                            {isGeneratingDossier === device.imei ? 'Compiling...' : 'Dossier'}
                                                        </button>
                                                        {device.status === 'STOLEN' && !device.isBricked && (
                                                            <button
                                                                onClick={() => handleBrick(device.imei, 'Theft Reported')}
                                                                className="text-[10px] font-black text-red-600 hover:text-white bg-red-600/10 hover:bg-black px-2.5 py-1.5 rounded-lg border border-red-600/30 hover:border-red-600 transition-all uppercase tracking-tighter shadow-inner"
                                                            >
                                                                Kill-Switch
                                                            </button>
                                                        )}
                                                        {device.isBricked && (
                                                            <button
                                                                onClick={() => handleUnbrick(device.imei)}
                                                                className="text-[10px] font-black text-emerald-500 hover:text-white bg-emerald-500/10 hover:bg-emerald-600 px-2.5 py-1.5 rounded-lg border border-emerald-500/30 transition-all uppercase tracking-tighter font-mono"
                                                            >
                                                                Restore HW
                                                            </button>
                                                        )}
                                                        {device.status !== 'INVESTIGATING' && (
                                                            <button onClick={() => updateStatus(device.imei, 'INVESTIGATING')} className="text-[10px] font-bold text-amber-500 hover:text-amber-400 transition-colors uppercase tracking-wide">Investigate</button>
                                                        )}
                                                        {device.status !== 'CLEAN' && (
                                                            <button onClick={() => updateStatus(device.imei, 'CLEAN')} className="text-[10px] font-bold text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-wide">Clear</button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    ) : activeTab === 'incidents' ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-slate-400">
                                <thead className="text-xs text-slate-300 uppercase bg-slate-950/50 border-b border-slate-800">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold tracking-wider">Report Date</th>
                                        <th className="px-6 py-4 font-semibold tracking-wider">Reported By</th>
                                        <th className="px-6 py-4 font-semibold tracking-wider">Device Details</th>
                                        <th className="px-6 py-4 font-semibold tracking-wider">Narrative</th>
                                        <th className="px-6 py-4 font-semibold tracking-wider">Status</th>
                                        <th className="px-6 py-4 font-semibold tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {reports.length === 0 ? (
                                        <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No active incident reports.</td></tr>
                                    ) : reports.map((report: any) => (
                                        <tr key={report.id} className="hover:bg-slate-800/30 transition-colors border-l-2 border-l-transparent hover:border-l-red-500">
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-300">{new Date(report.createdAt).toLocaleString()}</td>
                                            <td className="px-6 py-4 font-medium text-white">{report.reporter.email}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 overflow-hidden flex-shrink-0 shadow-inner">
                                                        {report.device.devicePhotos && report.device.devicePhotos.length > 0 ? (
                                                            <img src={report.device.devicePhotos[0]} alt={report.device.model} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-slate-700">
                                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-white">{report.device.brand} {report.device.model}</div>
                                                        <div className="text-xs text-slate-500 font-mono mt-1">{report.device.imei}</div>
                                                    </div>
                                                </div>
                                                {report.device.lastKnownLocation && (
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                                                        <span className="text-[10px] text-emerald-400 font-bold">TRACKED: {report.device.lastKnownLocation}</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 max-w-sm">
                                                <p className="text-sm text-slate-300 line-clamp-2">{report.description}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${report.status === 'OPEN' ? 'bg-red-500/10 text-red-500 border border-red-500/30' : 'bg-slate-800 text-slate-400'}`}>
                                                    {report.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right space-x-2">
                                                {!report.locationSharedWithOwner ? (
                                                    <button onClick={() => shareLocation(report.id)} className="text-[10px] font-bold text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg border border-blue-500/20 transition-colors uppercase tracking-wide">
                                                        Share Location
                                                    </button>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 uppercase tracking-wide">Shared ✓</span>
                                                )}
                                                {report.status !== 'CLEARED' && (
                                                    <button onClick={() => clearIncident(report.id)} className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg border border-emerald-500/20 transition-colors uppercase tracking-wide">
                                                        Clear
                                                    </button>
                                                )}
                                                {report.status !== 'CLEAN' && (
                                                    <button onClick={() => setLiveTrackingImei(report.device.imei)} className="text-[10px] font-bold text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-lg border border-red-500/20 transition-colors uppercase tracking-wide">
                                                        Track Live
                                                    </button>
                                                )}
                                                <button onClick={() => exportDossier(report.device.imei)} className="text-[10px] font-bold text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg border border-blue-500/20 transition-colors uppercase tracking-wide">
                                                    Dossier
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : activeTab === 'intel' ? (
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="text-xl font-black text-white uppercase tracking-tight">AI Intelligence Feed</h3>
                                    <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-bold">Scanning for anomalies & behavioral threats</p>
                                </div>
                                <div className="flex gap-2">
                                    <span className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-tighter">Engine V2 (ML-Lite)</span>
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {intel.length === 0 ? (
                                    <div className="col-span-full py-20 text-center text-slate-500 font-mono text-sm">&gt; NO CRITICAL ANOMALIES DETECTED IN LAST 24H.</div>
                                ) : intel.map((item: any) => (
                                    <div key={item.id} className="bg-slate-950 border border-slate-800 rounded-3xl p-6 hover:border-red-900/50 transition-all group relative overflow-hidden shadow-2xl">
                                        <div className={`absolute top-0 right-0 w-24 h-24 opacity-10 blur-3xl rounded-full ${item.score < 40 ? 'bg-red-500' : 'bg-amber-500'}`}></div>

                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h4 className="text-white font-bold text-lg leading-none">{item.brand} {item.model}</h4>
                                                <p className="text-[10px] text-slate-500 font-mono mt-1.5 uppercase tracking-widest">{item.imei}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[9px] font-black text-slate-600 uppercase mb-1">Risk Pts</p>
                                                <span className={`text-2xl font-black leading-none ${item.score < 40 ? 'text-red-500' : 'text-amber-500'}`}>{item.score}</span>
                                            </div>
                                        </div>

                                        <div className="space-y-4 mb-6">
                                            <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-2xl">
                                                <p className="text-[9px] font-black text-red-400 uppercase tracking-widest mb-1">Detection Logic</p>
                                                <p className="text-sm font-bold text-slate-300">{item.reason === 'LOW_TRUST_INDEX' ? '⚠️ High-Risk Behavioral Profile' : '🚨 Reported Incident Activity'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Last Seen Proximity</p>
                                                <p className="text-sm text-slate-400 font-medium">{item.lastSeen}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Heuristic Signal</p>
                                                <p className="text-xs text-slate-500 italic line-clamp-2">"{item.latestEvent}"</p>
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <button onClick={() => setLiveTrackingImei(item.imei)} className="flex-1 bg-red-600 hover:bg-red-500 text-white text-[10px] font-black py-3 rounded-xl uppercase tracking-widest transition-all">Intercept</button>
                                            <button onClick={() => exportDossier(item.imei)} className="px-4 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 transition-all flex items-center justify-center">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : activeTab === 'alerts' ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-slate-400">
                                <thead className="text-xs text-slate-300 uppercase bg-slate-950/50 border-b border-slate-800">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold tracking-wider">Alert Date</th>
                                        <th className="px-6 py-4 font-semibold tracking-wider">Reporting Vendor</th>
                                        <th className="px-6 py-4 font-semibold tracking-wider">Scanned Device</th>
                                        <th className="px-6 py-4 font-semibold tracking-wider">Vendor Note</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {alerts.length === 0 ? (
                                        <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">No suspicious vendor alerts.</td></tr>
                                    ) : alerts.map((alert: any) => (
                                        <tr key={alert.id} className="hover:bg-slate-800/30 transition-colors border-l-2 border-l-transparent hover:border-l-amber-500">
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-300">{new Date(alert.createdAt).toLocaleString()}</td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-white">{alert.vendor.companyName}</div>
                                                <div className="text-xs text-slate-500">{alert.vendor.email}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 overflow-hidden flex-shrink-0">
                                                        {alert.device.devicePhotos && alert.device.devicePhotos.length > 0 ? (
                                                            <img src={alert.device.devicePhotos[0]} alt={alert.device.model} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-slate-700">
                                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-white">{alert.device.brand} {alert.device.model}</div>
                                                        <div className="text-xs text-slate-500 font-mono mt-1">{alert.device.imei}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 max-w-sm">
                                                <p className="text-sm text-slate-300 line-clamp-2">{alert.notes || 'No additional notes provided.'}</p>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : activeTab === 'suspects' ? (
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-white">Known Suspects & Thieves</h3>
                                <button onClick={() => setIsAddSuspectOpen(true)} className="bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                    Add Suspect
                                </button>
                            </div>
                            {suspects.length === 0 ? (
                                <div className="text-center py-10 text-slate-500">No suspects recorded yet.</div>
                            ) : (
                                <div className="grid gap-4">
                                    {suspects.map((s: any) => (
                                        <div key={s.id} className="bg-slate-950/50 border border-slate-800 rounded-2xl p-5 hover:border-purple-900/50 transition-colors">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className="text-lg font-bold text-white">{s.fullName || 'Unknown'}</h4>
                                                    {s.alias && <p className="text-sm text-purple-400 font-bold italic">a.k.a "{s.alias}"</p>}
                                                </div>
                                                <div className="flex flex-col items-end gap-2">
                                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${s.status === 'GUILTY' ? 'bg-red-500/20 text-red-500 border border-red-500/30' :
                                                        s.status === 'NOT_GUILTY' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                                            s.status === 'CLEARED' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                                                'bg-slate-800 text-slate-400 border border-slate-700'
                                                        }`}>{s.status || 'ACTIVE'}</span>
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tight ${s.dangerLevel === 'EXTREME' ? 'bg-red-600/20 text-red-600' :
                                                        s.dangerLevel === 'HIGH' ? 'bg-orange-500/20 text-orange-500' :
                                                            'bg-slate-800 text-slate-500'
                                                        }`}>{s.dangerLevel} Level</span>
                                                </div>
                                            </div>
                                            <div className="mt-3 flex justify-between items-center">
                                                <div className="grid grid-cols-2 gap-4 text-sm">
                                                    {s.nationalId && <div><span className="text-slate-500 text-xs font-bold">NIN:</span> <span className="text-slate-300 font-mono">{s.nationalId}</span></div>}
                                                    {s.phoneNumber && <div><span className="text-slate-500 text-xs font-bold">Phone:</span> <span className="text-slate-300">{s.phoneNumber}</span></div>}
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => updateSuspectStatus(s.id, 'GUILTY')} className="text-[9px] font-black text-red-500 hover:text-red-400 bg-red-500/5 px-2 py-1 rounded border border-red-500/10">GUILTY</button>
                                                    <button onClick={() => updateSuspectStatus(s.id, 'NOT_GUILTY')} className="text-[9px] font-black text-emerald-500 hover:text-emerald-400 bg-emerald-500/5 px-2 py-1 rounded border border-emerald-500/10">NOT GUILTY</button>
                                                    <button onClick={() => updateSuspectStatus(s.id, 'CLEARED')} className="text-[9px] font-black text-blue-500 hover:text-blue-400 bg-blue-500/5 px-2 py-1 rounded border border-blue-500/10">CLEAR</button>
                                                </div>
                                            </div>
                                            {s.description && <p className="mt-2 text-sm text-slate-400 italic border-l-2 border-purple-500/30 pl-3">{s.description}</p>}
                                            {s.incidents && s.incidents.length > 0 && (
                                                <div className="mt-3 pt-3 border-t border-slate-800">
                                                    <p className="text-[10px] text-red-400 uppercase tracking-widest font-bold mb-1">Linked Incidents ({s.incidents.length})</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {s.incidents.map((inc: any) => (
                                                            <span key={inc.id} className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded-md">{inc.device?.brand} {inc.device?.model} — {inc.device?.imei}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : activeTab === 'messages' ? (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
                            <div className="lg:col-span-1 bg-slate-950/50 border border-slate-800 rounded-2xl p-6 shadow-md h-fit">
                                <h3 className="text-lg font-bold text-white mb-4">Secure Comms to Admin</h3>
                                <form onSubmit={sendMessage} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 mb-1">Subject Clearance *</label>
                                        <input type="text" value={newMessage.subject} onChange={e => setNewMessage({ ...newMessage, subject: e.target.value })} required className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500" placeholder="e.g. Clearance request for IMEI..." />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 mb-1">Intelligence Body *</label>
                                        <textarea value={newMessage.body} onChange={e => setNewMessage({ ...newMessage, body: e.target.value })} required rows={4} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500" placeholder="Type message to System Administrator..." />
                                    </div>
                                    <button type="submit" className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-red-500/20">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg> Transmit
                                    </button>
                                </form>
                            </div>
                            <div className="lg:col-span-2 bg-slate-950/50 border border-slate-800 rounded-2xl p-6 shadow-md min-h-[500px]">
                                <h3 className="text-lg font-bold text-white mb-6">Classified Communications Thread</h3>
                                <div className="space-y-4">
                                    {messages.map(msg => (
                                        <div key={msg.id} className={`p-4 rounded-xl border ${msg.sender?.role === 'POLICE' ? 'bg-red-500/5 border-red-500/20 ml-12' : 'bg-slate-800 border-slate-700 mr-12'}`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${msg.sender?.role === 'POLICE' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-500'}`}>{msg.sender?.role}</span>
                                                    <span className="text-sm font-bold text-white">{msg.sender?.fullName || msg.sender?.email}</span>
                                                </div>
                                                <span className="text-xs text-slate-500 font-medium">{new Date(msg.createdAt).toLocaleString()}</span>
                                            </div>
                                            <p className="text-sm font-bold text-slate-300 mb-1">{msg.subject}</p>
                                            <p className="text-sm text-slate-400 whitespace-pre-wrap">{msg.body}</p>
                                        </div>
                                    ))}
                                    {messages.length === 0 && <div className="text-center py-20 text-slate-500 font-mono text-sm max-w-sm mx-auto">&gt; NO ENCRYPTED MESSAGES IN THREAD.<br />&gt; AWAITING TRANSMISSION...</div>}
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'geofence' ? (
                        <div className="p-6 space-y-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 rounded-xl bg-cyan-600/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30 text-xl">🛰</div>
                                <div>
                                    <h2 className="text-xl font-black text-white">Interpol Geo-Fence Deployer</h2>
                                    <p className="text-sm text-slate-400">Draw custom containment perimeters. Any stolen device crossing a boundary triggers an instant INTERPOL_BREACH alert.</p>
                                </div>
                                <div className="ml-auto flex items-center gap-2 bg-slate-950/50 border border-cyan-800/30 rounded-xl p-3">
                                    <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></div>
                                    <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest">{activeFences.length} Active Perimeter{activeFences.length !== 1 ? 's' : ''}</span>
                                </div>
                            </div>

                            <DynamicGeoFenceMap
                                activeFences={activeFences}
                                onSavePolygon={async (name, coordinates) => {
                                    setIsSavingFence(true);
                                    try {
                                        const { api } = await import('@/lib/api');
                                        const data = await api.post('/devices/geofence', { name, geometryJson: coordinates });
                                        setActiveFences(prev => [...prev, { id: data.fence.id, name: data.fence.name, polygon: coordinates }]);
                                        alert(`✅ Tactical perimeter "${name}" deployed successfully!`);
                                    } catch (e: any) {
                                        alert(`❌ Fence deployment failed: ${e.message}`);
                                    } finally {
                                        setIsSavingFence(false);
                                    }
                                }}
                            />

                            {activeFences.length > 0 && (
                                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                                    <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-widest">Active Perimeters</h3>
                                    <div className="space-y-2">
                                        {activeFences.map((f: any) => (
                                            <div key={f.id} className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
                                                    <span className="text-sm font-bold text-white">{f.name}</span>
                                                    <span className="text-xs text-slate-500 font-mono">{f.polygon?.length || 0} points</span>
                                                </div>
                                                <span className="text-[10px] font-black text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded-full border border-cyan-500/20 uppercase">ACTIVE</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>
            </main>

            {/* Add Suspect Modal */}
            {isAddSuspectOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500"></div>
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-500 flex items-center justify-center border border-purple-500/30">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">Register Suspect</h2>
                                    <p className="text-xs text-slate-400">Add to National Suspect Database</p>
                                </div>
                            </div>
                            <button onClick={() => setIsAddSuspectOpen(false)} className="text-slate-400 hover:text-white p-2">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <form onSubmit={createSuspect} className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name</label>
                                    <input type="text" value={suspectForm.fullName} onChange={e => setSuspectForm({ ...suspectForm, fullName: e.target.value })} placeholder="Legal name" required className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Alias / Street Name</label>
                                    <input type="text" value={suspectForm.alias} onChange={e => setSuspectForm({ ...suspectForm, alias: e.target.value })} placeholder="e.g. Two-Phones" className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">National ID (NIN)</label>
                                    <input type="text" value={suspectForm.nationalId} onChange={e => setSuspectForm({ ...suspectForm, nationalId: e.target.value })} placeholder="ID Number" className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Phone Number</label>
                                    <input type="text" value={suspectForm.phoneNumber} onChange={e => setSuspectForm({ ...suspectForm, phoneNumber: e.target.value })} placeholder="+234..." className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Known Addresses / Areas</label>
                                <input type="text" value={suspectForm.knownAddresses} onChange={e => setSuspectForm({ ...suspectForm, knownAddresses: e.target.value })} placeholder="e.g. Computer Village, Ikeja" className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Description / Intel</label>
                                <textarea value={suspectForm.description} onChange={e => setSuspectForm({ ...suspectForm, description: e.target.value })} placeholder="Physical description, known associates, MO..." rows={3} className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 resize-none"></textarea>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Danger Level</label>
                                <select value={suspectForm.dangerLevel} onChange={e => setSuspectForm({ ...suspectForm, dangerLevel: e.target.value })} className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500">
                                    <option value="UNKNOWN">Unknown</option>
                                    <option value="LOW">Low — Petty Theft</option>
                                    <option value="MEDIUM">Medium — Repeat Offender</option>
                                    <option value="HIGH">High — Armed / Violent</option>
                                    <option value="EXTREME">Extreme — Syndicate / Ring Leader</option>
                                </select>
                            </div>
                            <button type="submit" disabled={isSubmittingSuspect} className="w-full mt-2 bg-purple-600 hover:bg-purple-500 text-white font-bold py-3.5 px-4 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                                {isSubmittingSuspect && <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                                {isSubmittingSuspect ? 'Creating Record...' : 'Register Suspect in National Database'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
            {liveTrackingImei && <LiveView imei={liveTrackingImei} onClose={() => setLiveTrackingImei(null)} />}

            {/* Hidden High-Fidelity Forensic Dossier Template for PDF Generation */}
            <div style={{ position: 'fixed', top: '0', left: '200%', pointerEvents: 'none' }}>
                {dossierData && (
                    <div ref={dossierRef} style={{ width: '842px', minHeight: '1191px' }} className="bg-white text-slate-900 p-12 font-sans relative flex flex-col overflow-hidden">
                        {/* Dossier Header & Branding */}
                        <div className="border-b-[6px] border-red-600 pb-8 mb-8 flex justify-between items-start">
                            <div>
                                <h1 className="text-4xl font-black tracking-tighter text-slate-900 uppercase italic mb-1">Forensic Asset Dossier</h1>
                                <p className="text-xs font-mono font-bold text-red-600 bg-red-600/10 px-2 py-1 inline-block rounded tracking-widest">{dossierData.reportId}</p>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-black text-slate-900 tracking-tightest">PTS LAW ENFORCEMENT</div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">National Device Registry • Phase 4</p>
                            </div>
                        </div>

                        {/* Metadata Header */}
                        <div className="grid grid-cols-3 gap-6 mb-10 bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <div>
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Generated Date</p>
                                <p className="text-sm font-bold text-slate-800">{new Date(dossierData.generatedAt).toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Authorizing Official</p>
                                <p className="text-sm font-bold text-slate-800 truncate">{dossierData.generatedBy}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Security Clearance</p>
                                <p className="text-sm font-bold text-red-600">CONFIDENTIAL / RESTRICTED</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-5 gap-8 flex-1">
                            {/* Left Panel: Subject Data */}
                            <div className="col-span-2 space-y-8">
                                <section>
                                    <h3 className="text-xs font-black text-slate-900 border-b-2 border-slate-900 pb-2 mb-4 uppercase tracking-widest">Asset Manifest</h3>
                                    <div className="space-y-4">
                                        <div className="w-full aspect-square bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden shadow-inner flex items-center justify-center">
                                            {dossierData.asset.photos && dossierData.asset.photos.length > 0 ? (
                                                <img src={dossierData.asset.photos[0]} alt="Primary Evidence" className="w-full h-full object-cover" />
                                            ) : (
                                                <svg className="w-20 h-20 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                            )}
                                        </div>
                                        <div className="bg-slate-950 text-white p-5 rounded-2xl space-y-3 font-mono">
                                            <div>
                                                <p className="text-[8px] text-slate-500 uppercase font-black mb-0.5">Brand / Model</p>
                                                <p className="text-sm font-bold">{dossierData.asset.brand} {dossierData.asset.model}</p>
                                            </div>
                                            <div>
                                                <p className="text-[8px] text-slate-500 uppercase font-black mb-0.5">IMEI Identity</p>
                                                <p className="text-sm font-bold tracking-widest">{dossierData.asset.imei}</p>
                                            </div>
                                            <div>
                                                <p className="text-[8px] text-slate-500 uppercase font-black mb-0.5">Serial Identity</p>
                                                <p className="text-sm font-bold">{dossierData.asset.serial || 'NOT_LOGGED'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-xs font-black text-slate-900 border-b-2 border-slate-900 pb-2 mb-4 uppercase tracking-widest">Active Status</h3>
                                    <div className="p-4 rounded-xl border-2 border-red-600 bg-red-600/[0.03]">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[10px] text-slate-500 uppercase font-bold">Network Status</span>
                                            <span className="text-xs font-black text-red-600 uppercase tracking-wider">{dossierData.asset.status}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] text-slate-500 uppercase font-bold">Risk Index</span>
                                            <span className="text-xs font-black text-slate-900">{dossierData.asset.riskScore}/100</span>
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-xs font-black text-slate-900 border-b-2 border-slate-900 pb-2 mb-4 uppercase tracking-widest">Current Custodian</h3>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                        <p className="text-sm font-bold text-slate-900 mb-1">{dossierData.ownership.current}</p>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase italic">Verified Legal Registrant</p>
                                    </div>
                                </section>
                            </div>

                            {/* Right Panel: Timeline & Logs */}
                            <div className="col-span-3 space-y-8">
                                <section>
                                    <h3 className="text-xs font-black text-slate-900 border-b-2 border-slate-900 pb-2 mb-4 uppercase tracking-widest">Ownership Chain-of-Custody</h3>
                                    <div className="space-y-4">
                                        {dossierData.ownership.chain.map((link: any, idx: number) => (
                                            <div key={idx} className="flex gap-4 items-start bg-slate-50 p-4 rounded-xl border border-slate-200">
                                                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-[10px] shrink-0">{idx + 1}</div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-800">Transfer from {link.from} to {link.to}</p>
                                                    <p className="text-[10px] text-slate-500 mt-1 font-mono uppercase font-bold">{new Date(link.date).toLocaleDateString()} • TS-VERIFIED</p>
                                                </div>
                                            </div>
                                        ))}
                                        {dossierData.ownership.chain.length === 0 && <p className="text-xs text-slate-400 italic">No historical ownership transfers recorded in PTS Ledger.</p>}
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-xs font-black text-slate-900 border-b-2 border-slate-900 pb-2 mb-4 uppercase tracking-widest">Forensic Transaction Ledger</h3>
                                    <div className="bg-slate-950 text-slate-300 p-6 rounded-2xl space-y-6 font-mono border-t-[4px] border-emerald-500">
                                        {dossierData.ledger.slice(0, 8).map((entry: any, idx: number) => (
                                            <div key={idx} className="flex gap-4">
                                                <div className="text-[10px] font-black text-slate-600 shrink-0 border-r border-slate-800 pr-3 w-16 leading-tight">
                                                    {new Date(entry.date).toLocaleDateString()}<br />
                                                    {new Date(entry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black uppercase text-emerald-400 leading-none mb-1">{entry.type}</p>
                                                    <p className="text-[11px] font-bold text-slate-200 mb-1 leading-tight">{entry.details}</p>
                                                    <p className="text-[9px] text-slate-600 font-black italic">SGN: {entry.actor}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-xs font-black text-slate-900 border-b-2 border-slate-900 pb-2 mb-4 uppercase tracking-widest">Service & Technical Log</h3>
                                    <div className="space-y-3">
                                        {dossierData.maintenance.map((m: any, idx: number) => (
                                            <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-200 rounded-lg">
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-800 uppercase leading-none mb-1">{m.type}</p>
                                                    <p className="text-[10px] text-slate-500 font-bold">{m.provider}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] font-mono text-slate-900 font-black">{new Date(m.date).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                        ))}
                                        {dossierData.maintenance.length === 0 && <p className="text-xs text-slate-400 italic">No technical service history available for this asset.</p>}
                                    </div>
                                </section>
                            </div>
                        </div>

                        {/* Dossier Footer */}
                        <div className="mt-auto pt-10 border-t border-slate-200 flex justify-between items-end">
                            <div className="flex gap-6 items-center">
                                <div className="w-20 h-20 bg-slate-900 p-2 rounded-lg flex items-center justify-center">
                                    {/* Placeholder QR for dossier verification */}
                                    <div className="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[8px] text-slate-500 text-center uppercase tracking-tightest leading-none">PTS<br />FORENSIC<br />SEAL</div>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none mb-2 underline">Confidentiality Notice</p>
                                    <p className="text-[9px] text-slate-400 italic max-w-xs leading-relaxed">
                                        This document is an immutable record from the National Property Tracking System. Unauthorized use or dissemination is punishable under Cybersecurity Act 2026. Data integrity is guaranteed via cryptographical hash verification.
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-mono font-black text-slate-900 uppercase">DIGITAL SIGNATURE VERIFIED</p>
                                <p className="text-[8px] text-slate-400 uppercase tracking-widest font-bold">Core v4.0.1-FORENSIC</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Guardian Mesh Scanner Modal */}
            {isMeshScannerOpen && (
                <MeshScanner
                    observerId="POL-CMD-HQ"
                    onClose={() => setIsMeshScannerOpen(false)}
                />
            )}
        </div>
    );
}
