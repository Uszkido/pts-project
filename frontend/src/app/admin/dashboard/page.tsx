"use client";

import { useState, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { generateCapSign } from '@/lib/capsign';
import LiveView from '@/components/LiveView';
import MapComponent from '@/components/MapComponent';
import IntelligenceView from '@/components/IntelligenceView';
import {
    LayoutDashboard,
    Users as UsersIcon,
    Smartphone,
    AlertTriangle,
    FileText,
    MessageSquare,
    UserX,
    Key,
    Brain,
    FileUp
} from 'lucide-react';

export default function AdminDashboard() {
    const [stats, setStats] = useState<any>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [devices, setDevices] = useState<any[]>([]);
    const [incidents, setIncidents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'vendors' | 'devices' | 'incidents' | 'documents' | 'messages' | 'suspects' | 'auth-requests' | 'intelligence' | 'bulk-load' | 'telecom-eir' | 'warrants'>('overview');
    const [roleFilter, setRoleFilter] = useState('');

    // New feature states
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<{ users: any[], devices: any[] } | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [mapData, setMapData] = useState<{ vendors: any[], pings: any[] }>({ vendors: [], pings: [] });

    const [documents, setDocuments] = useState<{ userDocuments: any[], deviceDocuments: any[] }>({ userDocuments: [], deviceDocuments: [] });
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState({ subject: '', body: '' });

    // Create Account Modal
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newUser, setNewUser] = useState({ email: '', password: '', role: 'CONSUMER', fullName: '', companyName: '', nationalId: '' });

    // User Details & Edit Modal
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [editUserForm, setEditUserForm] = useState({ email: '', fullName: '', companyName: '', nationalId: '' });
    const [resetPassword, setResetPassword] = useState('');
    const [isResettingPassword, setIsResettingPassword] = useState(false);

    // Suspects state
    const [suspects, setSuspects] = useState<any[]>([]);

    // Password Resets
    const [authRequests, setAuthRequests] = useState<any[]>([]);

    // Live Tracking
    const [liveTrackingImei, setLiveTrackingImei] = useState<string | null>(null);

    // Forensic Dossier states
    const [isGeneratingDossier, setIsGeneratingDossier] = useState<string | null>(null);
    const [dossierData, setDossierData] = useState<any>(null);
    const dossierRef = useRef<HTMLDivElement>(null);

    // Device Details Modal
    const [selectedDevice, setSelectedDevice] = useState<any>(null);
    const [isDeviceDetailsModalOpen, setIsDeviceDetailsModalOpen] = useState(false);
    const [deviceLoading, setDeviceLoading] = useState(false);

    // Inline Risk Score Editing
    const [editingRiskId, setEditingRiskId] = useState<string | null>(null);
    const [editingRiskValue, setEditingRiskValue] = useState<number>(0);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
    const headers = { 'Authorization': `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('pts_token') : ''}` };

    const fetchData = async () => {
        setLoading(true);
        try {
            // High-performance parallel synchronization
            const [dashRes, usersRes, devicesRes, incidentsRes, docsRes, msgsRes, suspectRes, authRes] = await Promise.all([
                fetch(`${apiUrl}/admin/dashboard`, { headers }),
                fetch(`${apiUrl}/admin/users`, { headers }),
                fetch(`${apiUrl}/admin/devices`, { headers }),
                fetch(`${apiUrl}/admin/incidents`, { headers }),
                fetch(`${apiUrl}/admin/documents`, { headers }),
                fetch(`${apiUrl}/admin/messages`, { headers }),
                fetch(`${apiUrl}/admin/suspects`, { headers }),
                fetch(`${apiUrl}/admin/password-reset-requests`, { headers }),
                fetch(`${apiUrl}/admin/map-data`, { headers })
            ]);

            // Handle cascading errors with precision
            if (dashRes.status === 401 || dashRes.status === 403) {
                window.location.href = '/admin/login';
                return;
            }

            const [dashData, usersData, devicesData, incidentsData, docsData, msgsData, suspectsData, authData, mData] = await Promise.all([
                dashRes.ok ? dashRes.json() : Promise.resolve(null),
                usersRes.ok ? usersRes.json() : Promise.resolve({ users: [] }),
                devicesRes.ok ? devicesRes.json() : Promise.resolve({ devices: [] }),
                incidentsRes.ok ? incidentsRes.json() : Promise.resolve({ incidents: [] }),
                docsRes.ok ? docsRes.json() : Promise.resolve({ userDocuments: [], deviceDocuments: [] }),
                msgsRes.ok ? msgsRes.json() : Promise.resolve({ messages: [] }),
                suspectRes.ok ? suspectRes.json() : Promise.resolve({ suspects: [] }),
                authRes.ok ? authRes.json() : Promise.resolve({ requests: [] }),
                fetch(`${apiUrl}/admin/map-data`, { headers }).then(r => r.ok ? r.json() : { vendors: [], pings: [] })
            ]);

            // Fail-safe State Population
            if (dashData) setStats(dashData);
            setUsers(usersData.users || []);
            setDevices(devicesData.devices || []);
            setIncidents(incidentsData.incidents || []);
            setDocuments(docsData || { userDocuments: [], deviceDocuments: [] });
            setMessages(msgsData.messages || []);
            setSuspects(suspectsData.suspects || []);
            setAuthRequests(authData.requests || []);
            setMapData(mData || { vendors: [], pings: [] });

            // Specific error warning if non-critical routes fail
            if (!docsRes.ok) console.warn('Administrative Intelligence document registry failed to sync.');

        } catch (err: any) {
            console.error('Telemetric Sync Failure:', err);
            setError(`Critical failure in Command Center synchronization: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!localStorage.getItem('pts_token')) {
            window.location.href = '/admin/login';
            return;
        }
        fetchData();
    }, []);

    useEffect(() => {
        if (searchQuery.length < 2) {
            setSearchResults(null);
            return;
        }
        const delayDebounceFn = setTimeout(async () => {
            setIsSearching(true);
            try {
                const res = await fetch(`${apiUrl}/admin/search?q=${encodeURIComponent(searchQuery)}`, { headers });
                if (res.ok) {
                    const data = await res.json();
                    setSearchResults(data.results);
                }
            } catch (error) { console.error('Search error', error); }
            finally { setIsSearching(false); }
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const [messageTarget, setMessageTarget] = useState('ROLE');
    const [receiverRole, setReceiverRole] = useState('ALL');
    const [receiverEmail, setReceiverEmail] = useState('');

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            let payload: any = { ...newMessage };
            if (messageTarget === 'ROLE') {
                payload.receiverRole = receiverRole;
            } else {
                const userObj = users.find(u => u.email === receiverEmail);
                if (!userObj) throw new Error('User not found by that email');
                payload.receiverId = userObj.id;
            }

            const res = await fetch(`${apiUrl}/admin/messages`, {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Failed to send message');
            setNewMessage({ subject: '', body: '' });
            fetchData();
            alert('Message dispatched successfully');
        } catch (err: any) { alert(err.message); }
    };

    const updateVendorStatus = async (userId: string, vendorStatus: string) => {
        try {
            const res = await fetch(`${apiUrl}/admin/users/${userId}/vendor-status`, {
                method: 'PUT',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ vendorStatus })
            });
            if (!res.ok) throw new Error('Failed to update vendor status');
            fetchData();
        } catch (err: any) { alert(err.message); }
    };

    const updateUserRole = async (userId: string, role: string) => {
        try {
            const res = await fetch(`${apiUrl}/admin/users/${userId}/role`, {
                method: 'PUT',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ role })
            });
            if (!res.ok) throw new Error('Failed to update role');
            fetchData();
        } catch (err: any) { alert(err.message); }
    };

    const deleteUser = async (userId: string) => {
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
        try {
            const res = await fetch(`${apiUrl}/admin/users/${userId}`, {
                method: 'DELETE', headers
            });
            if (!res.ok) throw new Error('Failed to delete user');
            fetchData();
        } catch (err: any) { alert(err.message); }
    };

    const updateUserStatus = async (userId: string, status: string) => {
        if (!confirm(`Are you sure you want to ${status === 'SUSPENDED' ? 'suspend' : 'activate'} this user?`)) return;
        try {
            const res = await fetch(`${apiUrl}/admin/users/${userId}/status`, {
                method: 'PUT',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            alert(data.message);
            fetchData();
        } catch (err: any) { alert(err.message); }
    };

    const createUser = async () => {
        try {
            const res = await fetch(`${apiUrl}/admin/users`, {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify(newUser)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            alert(data.message);
            setIsCreateOpen(false);
            setNewUser({ email: '', password: '', role: 'CONSUMER', fullName: '', companyName: '', nationalId: '' });
            fetchData();
        } catch (err: any) { alert(err.message); }
    };

    const fetchUserDetails = async (userId: string) => {
        try {
            const res = await fetch(`${apiUrl}/admin/users/${userId}/details`, { headers });
            if (!res.ok) throw new Error('Failed to fetch user details');
            const data = await res.json();
            setSelectedUser(data.user);
            setEditUserForm({
                email: data.user.email || '',
                fullName: data.user.fullName || '',
                companyName: data.user.companyName || '',
                nationalId: data.user.nationalId || ''
            });
            setEditMode(false);
            setIsResettingPassword(false);
            setResetPassword('');
            setIsDetailsModalOpen(true);
        } catch (err: any) { alert(err.message); }
    };

    const fetchDeviceDetails = async (deviceId: string) => {
        setDeviceLoading(true);
        try {
            const res = await fetch(`${apiUrl}/admin/devices/${deviceId}/details`, { headers });
            if (!res.ok) throw new Error('Failed to fetch device details');
            const data = await res.json();
            setSelectedDevice(data.device);
            setIsDeviceDetailsModalOpen(true);
        } catch (err: any) { alert(err.message); }
        finally { setDeviceLoading(false); }
    };

    const saveUserDetails = async () => {
        try {
            const res = await fetch(`${apiUrl}/admin/users/${selectedUser.id}/details`, {
                method: 'PUT',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify(editUserForm)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            alert(data.message);
            setEditMode(false);
            fetchUserDetails(selectedUser.id);
            fetchData();
        } catch (err: any) { alert(err.message); }
    };

    const handleResetPassword = async () => {
        try {
            const res = await fetch(`${apiUrl}/admin/users/${selectedUser.id}/password`, {
                method: 'PUT',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ newPassword: resetPassword })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            alert(data.message);
            setIsResettingPassword(false);
            setResetPassword('');
        } catch (err: any) { alert(err.message); }
    };

    const updateDeviceStatus = async (deviceId: string, status: string) => {
        try {
            const res = await fetch(`${apiUrl}/admin/devices/${deviceId}/status`, {
                method: 'PUT',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            if (!res.ok) throw new Error('Failed to update device status');
            fetchData();
        } catch (err: any) { alert(err.message); }
    };

    const exportDossier = async (imei: string) => {
        setIsGeneratingDossier(imei);
        try {
            const res = await fetch(`${apiUrl}/police/export-evidence/${imei}`, { headers });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch forensic data');

            const d = data.dossier;
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const W = pdf.internal.pageSize.getWidth();
            const H = pdf.internal.pageSize.getHeight();

            pdf.setFillColor(2, 8, 23);
            pdf.rect(0, 0, W, H, 'F');
            pdf.setFillColor(220, 38, 38);
            pdf.rect(0, 0, W, 8, 'F');
            pdf.rect(0, H - 8, W, 8, 'F');
            pdf.rect(0, 0, 4, H, 'F');

            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(9); pdf.setFont('helvetica', 'bold');
            pdf.text('POLICE TRACKING SYSTEM — ADMIN DIVISION', W / 2, 18, { align: 'center' });
            pdf.setFontSize(20); pdf.setTextColor(220, 38, 38);
            pdf.text('FORENSIC ASSET DOSSIER', W / 2, 30, { align: 'center' });
            pdf.setFontSize(7); pdf.setTextColor(239, 68, 68); pdf.setFont('helvetica', 'bold');
            pdf.text(`REPORT ID: ${d.reportId}   |   CLASSIFICATION: ADMIN RESTRICTED`, W / 2, 37, { align: 'center' });
            pdf.setDrawColor(220, 38, 38); pdf.setLineWidth(0.4);
            pdf.line(14, 41, W - 14, 41);

            pdf.setFontSize(7); pdf.setTextColor(100, 116, 139); pdf.setFont('helvetica', 'normal');
            pdf.text(`Generated: ${new Date(d.generatedAt).toLocaleString()}   |   Admin: ${d.generatedBy}`, 14, 48);

            pdf.setFontSize(8); pdf.setTextColor(220, 38, 38); pdf.setFont('helvetica', 'bold');
            pdf.text('§1 ASSET PROFILE', 14, 56);
            pdf.setFillColor(15, 23, 42); pdf.setDrawColor(30, 41, 59);
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
            let aY = 68;
            assetFields.forEach(([label, value]) => {
                pdf.setFontSize(6); pdf.setTextColor(100, 116, 139); pdf.setFont('helvetica', 'bold');
                pdf.text(label, 20, aY);
                pdf.setFontSize(label === 'CAP-SIGNATURE' ? 6 : 8);
                pdf.setTextColor(label === 'CAP-SIGNATURE' ? 220 : 255, label === 'CAP-SIGNATURE' ? 38 : 255, label === 'CAP-SIGNATURE' ? 38 : 255);
                pdf.setFont('helvetica', label === 'CAP-SIGNATURE' ? 'bold' : 'normal');
                pdf.text(String(value), 20, aY + 4);
                aY += label === 'CAP-SIGNATURE' ? 9 : 11;
            });

            pdf.setFontSize(8); pdf.setTextColor(220, 38, 38); pdf.setFont('helvetica', 'bold');
            pdf.text('§2 OWNERSHIP CHAIN', 14, 110);
            pdf.setFillColor(15, 23, 42); pdf.setDrawColor(30, 41, 59);
            pdf.roundedRect(14, 113, W - 28, 22, 2, 2, 'FD');
            pdf.setFontSize(7); pdf.setTextColor(100, 116, 139); pdf.setFont('helvetica', 'normal');
            pdf.text('Current Owner: ', 20, 121);
            pdf.setTextColor(255, 255, 255);
            pdf.text(d.ownership.current, 50, 121);
            pdf.setTextColor(100, 116, 139);
            pdf.text(`Transfers: ${d.ownership.chain.length === 0 ? 'None recorded' : d.ownership.chain.map((c: any) => `${c.from} → ${c.to}`).join('; ')}`, 20, 129);

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
                    pdf.text((inc.desc || 'N/A').substring(0, 90), 38, incY + 1);
                    pdf.setTextColor(71, 85, 105);
                    pdf.text(new Date(inc.date).toLocaleDateString(), W - 20, incY + 1, { align: 'right' });
                    incY += 13;
                });
            }

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
                    pdf.text(`• [${entry.type}] ${(entry.details || '').substring(0, 80)}`, 18, ledgerY);
                    ledgerY += 6;
                });
            }

            pdf.setFontSize(6); pdf.setTextColor(71, 85, 105);
            pdf.text('ADMIN COPY — PTS NATIONAL TRACKING SYSTEM', W / 2, H - 14, { align: 'center' });
            pdf.setTextColor(100, 116, 139);
            pdf.text('© VEXEL INNOVATIONS 2026 — PTS ADMIN DIVISION', W / 2, H - 10, { align: 'center' });

            pdf.save(`PTS_FORENSIC_DOSSIER_${imei}.pdf`);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsGeneratingDossier(null);
            setDossierData(null);
        }
    };

    const updateDeviceRisk = async (deviceId: string, riskScore: number) => {
        setEditingRiskId(null);
        const score = Math.min(100, Math.max(0, Math.round(riskScore)));
        // Optimistically update the list
        setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, riskScore: score } : d));
        try {
            const res = await fetch(`${apiUrl}/admin/devices/${deviceId}/risk-score`, {
                method: 'PUT',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ riskScore: score })
            });
            if (!res.ok) throw new Error('Failed to update risk score');
        } catch (err: any) {
            alert(err.message);
            fetchData(); // revert on failure
        }
    };


    const transferDevice = async (deviceId: string) => {
        const email = prompt('Enter new owner email:');
        if (!email) return;
        try {
            const res = await fetch(`${apiUrl}/admin/devices/${deviceId}/owner`, {
                method: 'PUT',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ newOwnerEmail: email })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            alert(data.message);
            fetchData();
        } catch (err: any) { alert(err.message); }
    };

    const approveReset = async (requestId: string) => {
        if (!confirm('Approve this password reset? This will immediately update the user\'s password.')) return;
        try {
            const res = await fetch(`${apiUrl}/admin/password-reset-requests/${requestId}/approve`, {
                method: 'PUT', headers
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            alert(data.message);
            fetchData();
        } catch (err: any) { alert(err.message); }
    };

    const rejectReset = async (requestId: string) => {
        const notes = prompt('Reason for rejection (optional):');
        if (notes === null) return;
        try {
            const res = await fetch(`${apiUrl}/admin/password-reset-requests/${requestId}/reject`, {
                method: 'PUT',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            alert(data.message);
            fetchData();
        } catch (err: any) { alert(err.message); }
    };

    const deleteDevice = async (deviceId: string) => {
        if (!confirm('Delete this device permanently?')) return;
        try {
            const res = await fetch(`${apiUrl}/admin/devices/${deviceId}`, { method: 'DELETE', headers });
            if (!res.ok) throw new Error('Failed to delete device');
            fetchData();
        } catch (err: any) { alert(err.message); }
    };

    const deleteMessage = async (messageId: string) => {
        if (!confirm('Delete this message from the thread?')) return;
        try {
            const res = await fetch(`${apiUrl}/admin/messages/${messageId}`, { method: 'DELETE', headers });
            if (!res.ok) throw new Error('Failed to delete message');
            fetchData();
        } catch (err: any) { alert(err.message); }
    };

    const clearUserOtp = async (userId: string) => {
        if (!confirm('Permanently delete this user\'s OTP verification code?')) return;
        try {
            const res = await fetch(`${apiUrl}/admin/users/${userId}/otp`, { method: 'DELETE', headers });
            if (!res.ok) throw new Error('Failed to clear OTP');
            alert('OTP cleared successfully');
            fetchData();
        } catch (err: any) { alert(err.message); }
    };

    const manualVerifyUser = async (userId: string) => {
        if (!confirm('Manually verify this user and bypass OTP requirements?')) return;
        try {
            const res = await fetch(`${apiUrl}/admin/users/${userId}/verify-manually`, { method: 'PUT', headers });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            alert(data.message);
            fetchData();
        } catch (err: any) { alert(err.message); }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            if (file.name.endsWith('.json')) {
                handleBulkImport(content);
            } else if (file.name.endsWith('.csv')) {
                const rows = content.split('\n').filter(r => r.trim());
                if (rows.length < 2) return alert('CSV is empty or missing headers.');

                const headers = rows[0].split(',').map(h => h.trim().toLowerCase());
                const data = rows.slice(1).map(row => {
                    // Simple CSV split with quote support
                    const values = row.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || row.split(',').map(v => v.trim());
                    const obj: any = {};
                    headers.forEach((h, i) => {
                        if (values[i]) obj[h] = values[i];
                    });
                    return obj;
                });
                handleBulkImport(JSON.stringify(data));
            } else {
                alert('Unsupported file format. Please use .json or .csv');
            }
        };
        reader.readAsText(file);
    };

    const handleBulkImport = async (jsonString: string) => {
        try {
            const devices = JSON.parse(jsonString);
            const res = await fetch(`${apiUrl}/admin/devices/bulk-import`, {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ devices })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            alert(`Bulk Success: ${data.importedCount} devices imported, ${data.skippedCount} skipped.`);
            fetchData();
        } catch (err: any) { alert('Invalid format or upload failed: ' + err.message); }
    };

    const clearIncident = async (incidentId: string) => {
        if (!confirm('Mark this incident as cleared/resolved?')) return;
        try {
            const res = await fetch(`${apiUrl}/admin/incidents/${incidentId}/clear`, { method: 'PUT', headers });
            if (!res.ok) throw new Error('Failed to clear incident');
            fetchData();
        } catch (err: any) { alert(err.message); }
    };

    const updateSuspectStatus = async (suspectId: string, status: string) => {
        try {
            const res = await fetch(`${apiUrl}/admin/suspects/${suspectId}/status`, {
                method: 'PUT',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            if (!res.ok) throw new Error('Failed to update suspect status');
            fetchData();
        } catch (err: any) { alert(err.message); }
    };

    const filteredUsers = roleFilter ? users.filter(u => u.role === roleFilter) : users;
    const pendingVendors = users.filter(u => u.role === 'VENDOR' && u.vendorStatus === 'PENDING');

    const statusColor = (s: string) => s === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : s === 'PENDING' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : s === 'REJECTED' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-slate-700/50 text-slate-400 border-slate-600';
    const roleColor = (r: string) => r === 'ADMIN' ? 'text-amber-400' : r === 'POLICE' ? 'text-red-400' : r === 'VENDOR' ? 'text-blue-400' : r === 'CONSUMER' ? 'text-emerald-400' : 'text-slate-400';

    if (loading) return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <div className="text-center"><div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mx-auto mb-4"></div><p className="text-slate-400 font-medium">Loading Admin Console...</p></div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-950 font-sans text-slate-200">
            <nav className="border-b border-amber-900/30 bg-slate-900/80 backdrop-blur-md px-6 py-4 flex justify-between items-center sticky top-0 z-50">
                <div className="flex items-center gap-3 relative z-[100]">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-600 to-red-600 text-white flex items-center justify-center font-black text-sm shadow-lg">A</div>
                    <span className="text-xl font-bold text-white tracking-tight hidden sm:block">Admin Console</span>
                    <span className="text-[10px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 font-bold uppercase hidden sm:block">System Administrator</span>

                    {/* Global Search */}
                    <div className="relative ml-4 w-64 md:w-80">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            {isSearching ? <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div> : <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
                        </div>
                        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search users, email, IMEI..." className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors" />

                        {/* Search Results Dropdown */}
                        {searchResults && searchQuery.length >= 2 && (
                            <div className="absolute top-full mt-2 w-96 max-h-96 overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-2 left-0 sm:left-auto sm:right-0">
                                <div className="px-4 py-2 text-xs font-bold uppercase text-slate-500 tracking-wider">Users matched ({searchResults.users.length})</div>
                                {searchResults.users.map(u => (
                                    <div key={u.id} className="px-4 py-3 hover:bg-slate-800 cursor-pointer border-l-2 border-transparent hover:border-amber-500">
                                        <p className="font-bold text-white text-sm">{u.fullName || u.email}</p>
                                        <p className="text-xs text-slate-400">{u.role} {u.companyName ? `• ${u.companyName}` : ''}</p>
                                    </div>
                                ))}
                                <div className="px-4 py-2 text-xs font-bold uppercase text-slate-500 tracking-wider mt-2 border-t border-slate-800 pt-3">Devices matched ({searchResults.devices.length})</div>
                                {searchResults.devices.map(d => (
                                    <div key={d.id} className="px-4 py-3 hover:bg-slate-800 cursor-pointer border-l-2 border-transparent hover:border-emerald-500 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded bg-slate-800 border border-slate-700 overflow-hidden flex-shrink-0">
                                            {d.devicePhotos && d.devicePhotos.length > 0 ? (
                                                <img src={d.devicePhotos[0]} alt={d.model} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-600">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-bold text-white text-sm">{d.brand} {d.model}</p>
                                            <p className="text-xs font-mono text-slate-400 mt-0.5">IMEI: {d.imei} <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-slate-950 border border-slate-800">{d.status}</span></p>
                                        </div>
                                    </div>
                                ))}
                                {searchResults.users.length === 0 && searchResults.devices.length === 0 && (
                                    <div className="px-4 py-6 text-center text-slate-500 text-sm">No results found for "{searchQuery}"</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <a href="/" className="text-xs text-slate-500 hover:text-white transition-colors">Homepage</a>
                    <button onClick={() => { localStorage.removeItem('pts_token'); window.location.href = '/admin/login'; }} className="text-xs text-red-400 hover:text-white">Logout</button>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-6 py-8">
                {error && <p className="mb-6 p-4 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 font-medium">{error}</p>}

                {/* Stats Grid */}
                {stats && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                        {[
                            { label: 'Total Users', value: stats.stats.totalUsers, color: 'blue' },
                            { label: 'Total Devices', value: stats.stats.totalDevices, color: 'emerald' },
                            { label: 'Incidents', value: stats.stats.totalIncidents, color: 'red' },
                            { label: 'Suspects', value: stats.stats.totalSuspects, color: 'purple' },
                            { label: 'Pending Vendors', value: stats.stats.pendingVendors, color: 'amber' }
                        ].map(s => (
                            <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center">
                                <p className={`text-3xl font-black text-${s.color}-400`}>{s.value}</p>
                                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mt-1">{s.label}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Tab Navigation */}
                <div className="flex gap-2 mb-6 flex-wrap">
                    {(['overview', 'intelligence', 'vendors', 'users', 'devices', 'incidents', 'suspects', 'documents', 'messages', 'auth-requests', 'bulk-load', 'telecom-eir', 'warrants'] as const).map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all capitalize ${activeTab === tab ? 'bg-indigo-600/20 text-indigo-400 shadow-lg border border-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}>
                            {tab === 'vendors' ? `Vendors (${users.filter(u => u.role === 'VENDOR' && u.vendorStatus === 'PENDING').length} pending)` :
                                tab === 'auth-requests' ? `Auth Requests (${authRequests.filter(r => r.status === 'PENDING').length + users.filter(u => !u.isEmailConfirmed && u.emailVerificationOtp).length})` :
                                    tab === 'intelligence' ? 'AI Intelligence' :
                                        tab === 'bulk-load' ? 'Bulk Load' :
                                            tab === 'telecom-eir' ? 'Telecom EIR' :
                                                tab === 'warrants' ? 'Active Warrants' : tab}
                        </button>
                    ))}
                </div>

                {/* TAB: Overview */}
                {
                    activeTab === 'overview' && stats && (
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                                <h3 className="text-lg font-bold text-white mb-4">Users by Role</h3>
                                <div className="space-y-3">
                                    {stats.usersByRole.map((r: any) => (
                                        <div key={r.role} className="flex justify-between items-center">
                                            <span className={`font-bold ${roleColor(r.role)}`}>{r.role}</span>
                                            <span className="bg-slate-800 px-3 py-1 rounded-full text-sm font-bold text-white">{r.count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                                <h3 className="text-lg font-bold text-white mb-4">Devices by Status</h3>
                                <div className="space-y-3">
                                    {stats.devicesByStatus.map((d: any) => (
                                        <div key={d.status} className="flex justify-between items-center">
                                            <span className="text-slate-300 font-medium">{d.status}</span>
                                            <span className="bg-slate-800 px-3 py-1 rounded-full text-sm font-bold text-white">{d.count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                                    <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                                        National Assets Surveillance Map
                                    </h3>
                                    <span className="text-[10px] text-slate-500 font-mono">LIVE TELEMETRY FEED</span>
                                </div>
                                <div className="h-[500px] w-full relative">
                                    <MapComponent
                                        zoom={6}
                                        markers={[
                                            ...mapData.vendors.map(v => ({
                                                lat: v.shopLatitude,
                                                lng: v.shopLongitude,
                                                label: `VENDOR: ${v.companyName}`,
                                                color: "#10b981"
                                            })),
                                            ...mapData.pings.map(p => ({
                                                lat: p.latitude,
                                                lng: p.longitude,
                                                label: `PING: ${p.device.brand} ${p.device.model} (${p.device.status})`,
                                                color: "#ef4444"
                                            }))
                                        ]}
                                    />
                                    <div className="absolute bottom-4 left-4 bg-slate-950/80 backdrop-blur-md p-3 rounded-xl border border-slate-700 text-[10px] space-y-2 z-[40]">
                                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> <span className="text-slate-300">Authorized Vendors</span></div>
                                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500"></div> <span className="text-slate-300">Target Asset Pings</span></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* TAB: AI Intelligence */}
                {
                    activeTab === 'intelligence' && (
                        <IntelligenceView apiUrl={apiUrl} headers={headers} />
                    )
                }

                {/* TAB: Vendor Approvals */}
                {
                    activeTab === 'vendors' && (
                        <div className="space-y-4">
                            {users.filter(u => u.role === 'VENDOR').length === 0 ? (
                                <div className="text-center py-12 text-slate-500">No vendor accounts registered.</div>
                            ) : users.filter(u => u.role === 'VENDOR').map(vendor => (
                                <div key={vendor.id} className={`bg-slate-900 border rounded-2xl p-6 ${vendor.vendorStatus === 'PENDING' ? 'border-amber-500/30' : 'border-slate-800'}`}>
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h4 className="text-lg font-bold text-white">{vendor.companyName || vendor.email}</h4>
                                            <p className="text-sm text-slate-400">{vendor.email}</p>
                                            {!vendor.isEmailConfirmed && vendor.emailVerificationOtp && (
                                                <div className="mt-1 flex items-center gap-1.5">
                                                    <span className="text-[10px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/20 font-bold uppercase">Unconfirmed</span>
                                                    <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">OTP: {vendor.emailVerificationOtp}</span>
                                                </div>
                                            )}
                                            {vendor.fullName && <p className="text-xs text-slate-500">Contact: {vendor.fullName}</p>}
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${statusColor(vendor.vendorStatus)}`}>{vendor.vendorStatus}</span>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
                                        {vendor.businessAddress && <div><span className="text-slate-500 text-xs block">Business Address</span><span className="text-slate-300">{vendor.businessAddress}</span></div>}
                                        {vendor.businessRegNo && <div><span className="text-slate-500 text-xs block">CAC/Reg No</span><span className="text-slate-300 font-mono">{vendor.businessRegNo}</span></div>}
                                        {vendor.nationalId && <div><span className="text-slate-500 text-xs block">NIN</span><span className="text-slate-300 font-mono">{vendor.nationalId}</span></div>}
                                        <div><span className="text-slate-500 text-xs block">Devices</span><span className="text-slate-300">{vendor._count?.devices || 0}</span></div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {vendor.cacCertificateUrl && <a href={vendor.cacCertificateUrl} target="_blank" rel="noreferrer" className="text-xs bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-lg border border-blue-500/20 hover:bg-blue-500/20 transition-colors">View CAC Certificate</a>}
                                        {vendor.shopPhotoUrl && <a href={vendor.shopPhotoUrl} target="_blank" rel="noreferrer" className="text-xs bg-purple-500/10 text-purple-400 px-3 py-1.5 rounded-lg border border-purple-500/20 hover:bg-purple-500/20 transition-colors">View Shop Photo</a>}
                                        {vendor.shopLatitude && vendor.shopLongitude && <a href={`https://maps.google.com/?q=${vendor.shopLatitude},${vendor.shopLongitude}`} target="_blank" rel="noreferrer" className="text-xs bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">📍 View on Map</a>}
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-800">
                                        <button onClick={() => fetchUserDetails(vendor.id)} className="text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors">View Details</button>
                                        {vendor.vendorStatus !== 'APPROVED' && <button onClick={() => updateVendorStatus(vendor.id, 'APPROVED')} className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg transition-colors">✓ Approve</button>}
                                        {vendor.vendorStatus !== 'REJECTED' && <button onClick={() => updateVendorStatus(vendor.id, 'REJECTED')} className="text-xs font-bold bg-red-600/80 hover:bg-red-500 text-white px-4 py-2 rounded-lg transition-colors">✕ Reject</button>}
                                        <button onClick={() => deleteUser(vendor.id)} className="text-xs font-bold bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            Delete Vendor
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                }

                {/* TAB: Users */}
                {
                    activeTab === 'users' && (
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex gap-2">
                                    {['', 'ADMIN', 'VENDOR', 'CONSUMER', 'POLICE'].map(r => (
                                        <button key={r} onClick={() => setRoleFilter(r)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${roleFilter === r ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white'}`}>{r || 'All'}</button>
                                    ))}
                                </div>
                                <button onClick={() => setIsCreateOpen(true)} className="bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                    Create Account
                                </button>
                            </div>
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-slate-300 uppercase bg-slate-950/50 border-b border-slate-800">
                                        <tr>
                                            <th className="px-6 py-4">User</th>
                                            <th className="px-6 py-4">Role</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4">Devices</th>
                                            <th className="px-6 py-4">Joined</th>
                                            <th className="px-6 py-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {filteredUsers.map(user => (
                                            <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-white">{user.fullName || user.companyName || 'N/A'}</div>
                                                    <div className="text-xs text-slate-500">{user.email}</div>
                                                    {!user.isEmailConfirmed && user.emailVerificationOtp && (
                                                        <div className="mt-1 flex items-center gap-1.5">
                                                            <span className="text-[10px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/20 font-bold uppercase">Unconfirmed</span>
                                                            <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">OTP: {user.emailVerificationOtp}</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <select value={user.role} onChange={e => updateUserRole(user.id, e.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white">
                                                        {['ADMIN', 'VENDOR', 'CONSUMER', 'POLICE', 'INSURANCE', 'TELECOM'].map(r => <option key={r} value={r}>{r}</option>)}
                                                    </select>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-2">
                                                        <span className={`w-fit px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusColor(user.vendorStatus)}`}>{user.vendorStatus}</span>
                                                        <span className={`w-fit px-2 py-0.5 rounded-full text-[10px] font-bold border ${user.status === 'SUSPENDED' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>{user.status || 'ACTIVE'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-slate-300">{user._count?.devices || 0}</td>
                                                <td className="px-6 py-4 text-slate-500 text-xs">{new Date(user.createdAt).toLocaleDateString()}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex gap-2 justify-end">
                                                        <button onClick={() => fetchUserDetails(user.id)} className="text-blue-400 hover:text-blue-300 p-2" title="View Details">
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                        </button>
                                                        <button onClick={() => deleteUser(user.id)} className="text-red-500 hover:text-red-400 p-2" title="Permanently Delete User">
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )
                }

                {/* TAB: Devices */}
                {
                    activeTab === 'devices' && (
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-300 uppercase bg-slate-950/50 border-b border-slate-800">
                                    <tr>
                                        <th className="px-6 py-4">Device</th>
                                        <th className="px-6 py-4">IMEI</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Owner</th>
                                        <th className="px-6 py-4">Risk</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {devices.map(d => (
                                        <tr key={d.id} className="hover:bg-slate-800/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden flex-shrink-0">
                                                        {d.devicePhotos && d.devicePhotos.length > 0 ? (
                                                            <img src={d.devicePhotos[0]} alt={d.model} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="font-bold text-white whitespace-nowrap">{d.brand} {d.model}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-xs text-slate-400">{d.imei}</td>
                                            <td className="px-6 py-4">
                                                <select value={d.status} onChange={e => updateDeviceStatus(d.id, e.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white">
                                                    {['CLEAN', 'STOLEN', 'INVESTIGATING', 'RECOVERED', 'FROZEN', 'BLACKLISTED'].map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </td>
                                            <td className="px-6 py-4 text-xs text-slate-400">{d.registeredOwner?.email}</td>
                                            <td className="px-6 py-4">
                                                {editingRiskId === d.id ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            max={100}
                                                            value={editingRiskValue}
                                                            onChange={e => setEditingRiskValue(Number(e.target.value))}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') updateDeviceRisk(d.id, editingRiskValue);
                                                                if (e.key === 'Escape') setEditingRiskId(null);
                                                            }}
                                                            onBlur={() => updateDeviceRisk(d.id, editingRiskValue)}
                                                            autoFocus
                                                            className="w-16 bg-slate-950 border border-blue-500/50 rounded-lg px-2 py-1 text-sm text-white text-center focus:outline-none focus:border-blue-400"
                                                        />
                                                        <span className="text-slate-500 text-xs">/100</span>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => { setEditingRiskId(d.id); setEditingRiskValue(d.riskScore); }}
                                                        title="Click to edit risk score"
                                                        className={`font-bold text-sm px-3 py-1 rounded-lg border transition-all group ${d.riskScore >= 70 ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10' :
                                                            d.riskScore >= 40 ? 'text-amber-400 border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10' :
                                                                'text-red-500 border-red-500/20 bg-red-500/5 hover:bg-red-500/10'
                                                            }`}
                                                    >
                                                        {d.riskScore}
                                                        <span className="ml-1 text-[9px] text-slate-500 group-hover:text-white transition-colors">✎</span>
                                                    </button>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex gap-2 justify-end">
                                                    <button onClick={() => fetchDeviceDetails(d.id)} className="text-xs text-emerald-400 hover:text-emerald-300 font-bold">Details</button>
                                                    <button onClick={() => transferDevice(d.id)} className="text-xs text-blue-400 hover:text-blue-300 font-bold">Transfer</button>
                                                    <button onClick={() => setLiveTrackingImei(d.imei)} className="text-xs text-red-500 hover:text-red-400 font-bold">Track</button>
                                                    <button onClick={() => deleteDevice(d.id)} className="text-xs text-red-500 hover:text-red-400 font-bold">Delete</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                }

                {/* TAB: Incidents */}
                {
                    activeTab === 'incidents' && (
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-300 uppercase bg-slate-950/50 border-b border-slate-800">
                                    <tr>
                                        <th className="px-6 py-4">Date</th>
                                        <th className="px-6 py-4">Type</th>
                                        <th className="px-6 py-4">Device</th>
                                        <th className="px-6 py-4">Reporter</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {incidents.map(inc => (
                                        <tr key={inc.id} className="hover:bg-slate-800/30 transition-colors">
                                            <td className="px-6 py-4 text-xs text-slate-400">{new Date(inc.createdAt).toLocaleDateString()}</td>
                                            <td className="px-6 py-4"><span className="bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full text-[10px] font-bold">{inc.type}</span></td>
                                            <td className="px-6 py-4"><span className="font-bold text-white">{inc.device?.brand} {inc.device?.model}</span><span className="text-xs text-slate-500 font-mono ml-2">{inc.device?.imei}</span></td>
                                            <td className="px-6 py-4 text-xs text-slate-400">{inc.reporter?.email}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${inc.status === 'CLEARED' ? 'bg-emerald-500/10 text-emerald-500' : inc.status === 'OPEN' ? 'bg-red-500/10 text-red-500' : 'bg-slate-700 text-slate-400'}`}>
                                                    {inc.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex gap-2 justify-end">
                                                    {inc.status !== 'CLEARED' && (
                                                        <button onClick={() => clearIncident(inc.id)} className="text-xs text-emerald-500 hover:text-emerald-400 font-bold border border-emerald-500/20 px-2 py-1 rounded">Clear</button>
                                                    )}
                                                    {inc.device && (
                                                        <button onClick={() => setLiveTrackingImei(inc.device.imei)} className="text-xs text-red-500 hover:text-red-400 font-bold border border-red-500/20 px-2 py-1 rounded">Track</button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                }

                {/* TAB: Suspects */}
                {
                    activeTab === 'suspects' && (
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-300 uppercase bg-slate-950/50 border-b border-slate-800 font-black tracking-widest">
                                    <tr>
                                        <th className="px-6 py-4">Suspect Details</th>
                                        <th className="px-6 py-4">Verification</th>
                                        <th className="px-6 py-4">Status / Verdict</th>
                                        <th className="px-6 py-4">Danger Level</th>
                                        <th className="px-6 py-4 text-right">Adjudication</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {suspects.map(s => (
                                        <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-white text-base">{s.fullName}</div>
                                                <div className="text-xs text-slate-500 font-medium">{s.phoneNumber}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-white font-mono text-xs">{s.nationalId || 'No NIN'}</div>
                                                <div className="text-[10px] text-amber-500 font-bold italic truncate max-w-[150px]">"{s.alias || 'No Alias'}"</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${s.status === 'GUILTY' ? 'bg-red-500/10 text-red-500 border-red-500/30' :
                                                    s.status === 'NOT_GUILTY' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                                                        s.status === 'CLEARED' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                                                            'bg-slate-800/50 text-slate-400 border-slate-700'
                                                    }`}>
                                                    {s.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5">
                                                    <div className={`w-2 h-2 rounded-full ${s.dangerLevel === 'EXTREME' ? 'bg-red-600 animate-pulse' : s.dangerLevel === 'HIGH' ? 'bg-red-500' : s.dangerLevel === 'MEDIUM' ? 'bg-amber-500' : 'bg-slate-500'}`} />
                                                    <span className="text-[10px] font-bold text-slate-300">{s.dangerLevel}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-1">
                                                    <button onClick={() => updateSuspectStatus(s.id, 'GUILTY')} className="text-[9px] font-black bg-red-500/10 text-red-500 hover:bg-red-500/20 px-2 py-1 rounded border border-red-500/20 transition-all">GUILTY</button>
                                                    <button onClick={() => updateSuspectStatus(s.id, 'NOT_GUILTY')} className="text-[9px] font-black bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 px-2 py-1 rounded border border-emerald-500/20 transition-all">NOT GUILTY</button>
                                                    <button onClick={() => updateSuspectStatus(s.id, 'CLEARED')} className="text-[9px] font-black bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 px-2 py-1 rounded border border-blue-500/20 transition-all">CLEAR</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {suspects.length === 0 && <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-medium italic">No suspects in the national registry.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    )
                }

                {/* TAB: Documents */}
                {
                    activeTab === 'documents' && (
                        <div className="space-y-8">
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-6 shadow-xl">
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> User Documents</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {documents.userDocuments.map(u => (
                                        <div key={u.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl shadow-md">
                                            <div className="mb-3">
                                                <p className="font-bold text-white text-sm">{u.fullName || u.email}</p>
                                                <p className="text-xs font-medium text-slate-500">{u.role} {u.companyName && `• ${u.companyName}`}</p>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {u.cacCertificateUrl && <a href={u.cacCertificateUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded inline-flex items-center gap-1 hover:bg-amber-500/20">📄 CAC Cert</a>}
                                                {u.shopPhotoUrl && <a href={u.shopPhotoUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-1 rounded inline-flex items-center gap-1 hover:bg-blue-500/20">🖼️ Shop</a>}
                                                {u.facialDataUrl && <a href={u.facialDataUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-purple-400 bg-purple-500/10 px-2 py-1 rounded inline-flex items-center gap-1 hover:bg-purple-500/20">👤 Face</a>}
                                                {u.biodataUrl && <a href={u.biodataUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded inline-flex items-center gap-1 hover:bg-emerald-500/20">📋 Biodata</a>}
                                            </div>
                                        </div>
                                    ))}
                                    {documents.userDocuments.length === 0 && <p className="text-slate-500 text-sm italic">No user documents</p>}
                                </div>
                            </div>

                            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-6 shadow-xl">
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg> Device Documents</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {documents.deviceDocuments.map(d => (
                                        <div key={d.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl shadow-md flex gap-4">
                                            <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-800 overflow-hidden flex-shrink-0">
                                                {d.devicePhotos && d.devicePhotos.length > 0 ? (
                                                    <img src={d.devicePhotos[0]} alt={d.model} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-slate-700">
                                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="mb-3">
                                                    <p className="font-bold text-white text-sm truncate">{d.brand} {d.model}</p>
                                                    <p className="text-xs font-mono text-slate-400">IMEI: {d.imei}</p>
                                                    <p className="text-xs font-medium text-slate-500 mt-0.5 truncate">Owner: {d.registeredOwner?.fullName || d.registeredOwner?.email}</p>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {d.devicePhotos && d.devicePhotos.length > 0 && <a href={d.devicePhotos[0]} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-1 rounded inline-flex items-center gap-1 hover:bg-blue-500/20">📱 Photo</a>}
                                                    {d.purchaseReceiptUrl && <a href={d.purchaseReceiptUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded inline-flex items-center gap-1 hover:bg-emerald-500/20">🧾 Receipt</a>}
                                                    {d.cartonPhotoUrl && <a href={d.cartonPhotoUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded inline-flex items-center gap-1 hover:bg-amber-500/20">📦 Carton</a>}
                                                    <button onClick={() => exportDossier(d.imei)} disabled={isGeneratingDossier === d.imei} className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-1 rounded inline-flex items-center gap-1 hover:bg-red-500/20 disabled:opacity-50">
                                                        {isGeneratingDossier === d.imei ? '⌛' : '📜'} Forensic Dossier
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {documents.deviceDocuments.length === 0 && <p className="text-slate-500 text-sm italic">No device documents</p>}
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* TAB: Messages */}
                {
                    activeTab === 'messages' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl h-fit sticky top-24">
                                <h3 className="text-lg font-bold text-white mb-4">Send System Notice</h3>
                                <form onSubmit={sendMessage} className="space-y-4">
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                                            <input type="radio" checked={messageTarget === 'ROLE'} onChange={() => setMessageTarget('ROLE')} className="text-amber-500 focus:ring-amber-500 bg-slate-900 border-slate-700" />
                                            Target Role
                                        </label>
                                        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                                            <input type="radio" checked={messageTarget === 'USER'} onChange={() => setMessageTarget('USER')} className="text-amber-500 focus:ring-amber-500 bg-slate-900 border-slate-700" />
                                            Target User
                                        </label>
                                    </div>
                                    {messageTarget === 'ROLE' ? (
                                        <div>
                                            <label className="block text-xs font-medium text-slate-400 mb-1">Select Role Group</label>
                                            <select value={receiverRole} onChange={e => setReceiverRole(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500">
                                                <option value="ALL">Everyone (Global Broadcast)</option>
                                                <option value="POLICE">Law Enforcement Only</option>
                                                <option value="VENDOR">Vendors Only</option>
                                                <option value="CONSUMER">Consumers Only</option>
                                            </select>
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="block text-xs font-medium text-slate-400 mb-1">User Email *</label>
                                            <input type="email" value={receiverEmail} onChange={e => setReceiverEmail(e.target.value)} required placeholder="user@example.com" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500" />
                                            <datalist id="user-emails">
                                                {users.map(u => <option key={u.email} value={u.email} />)}
                                            </datalist>
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 mb-1">Subject *</label>
                                        <input type="text" value={newMessage.subject} onChange={e => setNewMessage({ ...newMessage, subject: e.target.value })} required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500" placeholder="System update..." />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 mb-1">Message *</label>
                                        <textarea value={newMessage.body} onChange={e => setNewMessage({ ...newMessage, body: e.target.value })} required rows={4} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500" placeholder="Type message to network..." />
                                    </div>
                                    <button type="submit" className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg> Dispatch
                                    </button>
                                </form>
                            </div>
                            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl min-h-[500px]">
                                <h3 className="text-lg font-bold text-white mb-6">Discussions Thread</h3>
                                <div className="space-y-4">
                                    {messages.map(msg => (
                                        <div key={msg.id} className={`p-4 rounded-xl border ${msg.sender?.role === 'ADMIN' ? 'bg-amber-500/5 border-amber-500/20 ml-12' : 'bg-blue-500/5 border-blue-500/20 mr-12'}`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${msg.sender?.role === 'ADMIN' ? 'bg-amber-500/20 text-amber-500' : 'bg-blue-500/20 text-blue-500'}`}>{msg.sender?.role}</span>
                                                    <span className="text-sm font-bold text-white">{msg.sender?.fullName || msg.sender?.email}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs text-slate-500 font-medium">{new Date(msg.createdAt).toLocaleString()}</span>
                                                    <button onClick={() => deleteMessage(msg.id)} className="text-slate-600 hover:text-red-500 transition-colors p-1" title="Delete message">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </div>
                                            </div>
                                            <p className="text-sm font-bold text-slate-300 mb-1">{msg.subject}</p>
                                            <p className="text-sm text-slate-400 whitespace-pre-wrap">{msg.body}</p>
                                        </div>
                                    ))}
                                    {messages.length === 0 && <div className="text-center py-20 text-slate-500">No messages in thread yet.</div>}
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* TAB: Auth Requests */}
                {/* TAB: Bulk Load */}
                {activeTab === 'bulk-load' && (
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 border border-indigo-500/30">
                                <Smartphone className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Bulk Telemetric Asset Ingestion</h3>
                                <p className="text-sm text-slate-400">Mass register devices directly into the National Sovereign Registry via JSON/CSV payload.</p>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <label className="block text-sm font-bold text-slate-300 uppercase tracking-widest">Data Input</label>
                                    <div className="relative">
                                        <input
                                            type="file"
                                            id="bulk-file-input"
                                            accept=".json,.csv"
                                            className="hidden"
                                            onChange={handleFileUpload}
                                        />
                                        <button
                                            onClick={() => document.getElementById('bulk-file-input')?.click()}
                                            className="flex items-center gap-2 text-[10px] font-black bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg border border-indigo-500/20 transition-all uppercase"
                                        >
                                            <FileUp className="w-3 h-3" /> Upload Document (.csv / .json)
                                        </button>
                                    </div>
                                </div>
                                <textarea
                                    id="bulk-payload"
                                    placeholder='Paste JSON here or upload a document...'
                                    rows={10}
                                    className="w-full bg-slate-950/80 border border-slate-700 rounded-2xl px-4 py-4 text-sm font-mono text-indigo-300 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                                />
                                <button
                                    onClick={() => handleBulkImport((document.getElementById('bulk-payload') as HTMLTextAreaElement).value)}
                                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                                >
                                    INITIALIZE BULK INJECTION
                                </button>
                            </div>

                            <div className="bg-slate-950/50 border border-slate-800/50 rounded-2xl p-6">
                                <h4 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Ingestion Protocols</h4>
                                <ul className="space-y-3 text-xs text-slate-400 leading-relaxed">
                                    <li className="flex gap-2"><span className="text-indigo-500">→</span> IMEIs must be 15 digits. Duplicates will be automatically suppressed.</li>
                                    <li className="flex gap-2"><span className="text-indigo-500">→</span> Payload limit: 50,000 assets per broadcast.</li>
                                    <li className="flex gap-2"><span className="text-indigo-500">→</span> Default status for new assets is set to <span className="text-emerald-500">CLEAN</span>.</li>
                                    <li className="flex gap-2"><span className="text-indigo-500">→</span> Risk scores default to base 100 for verified batch imports.</li>
                                </ul>

                                <div className="mt-8 pt-8 border-t border-slate-800">
                                    <p className="text-[10px] text-slate-600 uppercase font-black mb-2 tracking-widest">Example Structure</p>
                                    <pre className="text-[9px] bg-black/40 p-3 rounded-xl border border-slate-800 text-emerald-500/70 overflow-hidden">
                                        {`[
  {
    "imei": "358923098234901",
    "brand": "Apple",
    "model": "iPhone 15 Pro Max",
    "status": "CLEAN"
  }
]`}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'auth-requests' && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-300 uppercase bg-slate-950/50 border-b border-slate-800 font-black tracking-widest">
                                <tr>
                                    <th className="px-6 py-4">Request Date</th>
                                    <th className="px-6 py-4">User Email</th>
                                    <th className="px-6 py-4">Role</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">OTP</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {authRequests.length === 0 && users.filter(u => !u.isEmailConfirmed && u.emailVerificationOtp).length === 0 ? (
                                    <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">No password reset or registration requests found.</td></tr>
                                ) : (
                                    <>
                                        {/* New Account Registrations */}
                                        {users.filter(u => !u.isEmailConfirmed && u.emailVerificationOtp).map(user => (
                                            <tr key={`reg-${user.id}`} className="hover:bg-slate-800/30 transition-colors">
                                                <td className="px-6 py-4 text-xs text-slate-400">{new Date(user.createdAt).toLocaleString()}</td>
                                                <td className="px-6 py-4 font-bold text-white"><span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20 mr-2 uppercase">New Reg</span>{user.email}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${roleColor(user.role)}`}>
                                                        {user.role}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                                        PENDING OTP
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="font-mono text-amber-400 bg-amber-500/10 px-2 py-1 rounded text-sm tracking-widest font-bold border border-amber-500/20">{user.emailVerificationOtp}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex gap-2 justify-end">
                                                        <button onClick={() => manualVerifyUser(user.id)} className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded transition-colors uppercase">Verify Manually</button>
                                                        <button onClick={() => clearUserOtp(user.id)} className="text-[10px] font-bold text-red-400 hover:text-red-300 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded transition-colors uppercase">Delete OTP</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}

                                        {/* Password Resets */}
                                        {authRequests.map(req => (
                                            <tr key={req.id} className="hover:bg-slate-800/30 transition-colors">
                                                <td className="px-6 py-4 text-xs text-slate-400">{new Date(req.createdAt).toLocaleString()}</td>
                                                <td className="px-6 py-4 font-bold text-white">{req.user?.email}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${roleColor(req.user?.role)}`}>
                                                        {req.user?.role}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${req.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-500' : req.status === 'PENDING' ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'}`}>
                                                        {req.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {req.otp ? (
                                                        <span className="font-mono text-amber-400 bg-amber-500/10 px-2 py-1 rounded text-sm tracking-widest font-bold border border-amber-500/20">{req.otp}</span>
                                                    ) : (
                                                        <span className="text-slate-600 italic text-xs">N/A</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {req.status === 'PENDING' && (
                                                        <div className="flex gap-2 justify-end">
                                                            <button onClick={() => approveReset(req.id)} className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded transition-colors uppercase">Approve</button>
                                                            <button onClick={() => rejectReset(req.id)} className="text-[10px] font-bold text-red-400 hover:text-red-300 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded transition-colors uppercase">Reject</button>
                                                        </div>
                                                    )}
                                                    {req.adminNotes && <p className="text-[10px] text-slate-500 mt-1 italic">Note: {req.adminNotes}</p>}
                                                </td>
                                            </tr>
                                        ))}
                                    </>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Create Account Modal */}
                {
                    isCreateOpen && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
                            <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-emerald-500"></div>
                                <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                                    <h2 className="text-xl font-bold text-white">Create Account</h2>
                                    <button onClick={() => setIsCreateOpen(false)} className="text-slate-500 hover:text-white text-xl">✕</button>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 mb-1">Role *</label>
                                        <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm">
                                            {['ADMIN', 'VENDOR', 'CONSUMER', 'POLICE', 'INSURANCE', 'TELECOM'].map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 mb-1">Full Name *</label>
                                        <input type="text" value={newUser.fullName} onChange={e => setNewUser({ ...newUser, fullName: e.target.value })} placeholder="John Doe" className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 mb-1">Email *</label>
                                        <input type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} placeholder="user@pts.com" className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 mb-1">Password *</label>
                                        <input type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} placeholder="••••••••" className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500" />
                                    </div>
                                    {newUser.role === 'VENDOR' && (
                                        <div>
                                            <label className="block text-xs font-medium text-slate-400 mb-1">Company Name</label>
                                            <input type="text" value={newUser.companyName} onChange={e => setNewUser({ ...newUser, companyName: e.target.value })} placeholder="Business Ltd" className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500" />
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 mb-1">National ID (NIN)</label>
                                        <input type="text" value={newUser.nationalId} onChange={e => setNewUser({ ...newUser, nationalId: e.target.value })} placeholder="12345678901" className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500" />
                                    </div>
                                    <button onClick={createUser} className="w-full bg-gradient-to-r from-amber-600 to-emerald-600 hover:from-amber-500 hover:to-emerald-500 text-white font-bold py-3 rounded-xl transition-all mt-2">Create Account</button>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* User Details Modal */}
                {
                    isDetailsModalOpen && selectedUser && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm overflow-y-auto">
                            <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden relative my-8">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-amber-500"></div>
                                <div className="p-6 border-b border-slate-800 flex justify-between items-start sticky top-0 bg-slate-900 z-10">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-800 border-2 border-slate-700 flex-shrink-0 flex items-center justify-center relative">
                                            {(selectedUser.facialDataUrl || selectedUser.cacCertificateUrl) ? (
                                                <img src={selectedUser.facialDataUrl || selectedUser.cacCertificateUrl} alt="Avatar" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className={`text-2xl font-black ${selectedUser.role === 'ADMIN' ? 'text-amber-500' : selectedUser.role === 'VENDOR' ? 'text-blue-500' : 'text-emerald-500'}`}>
                                                    {selectedUser.role.charAt(0)}
                                                </span>
                                            )}
                                            {selectedUser.cacCertificateUrl && !selectedUser.facialDataUrl && (
                                                <div className="absolute bottom-0 inset-x-0 bg-slate-950/80 text-[8px] text-center text-slate-300 py-0.5 font-bold uppercase tracking-widest backdrop-blur-sm">CAC</div>
                                            )}
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-white mb-1">{selectedUser.fullName || selectedUser.email}</h2>
                                            <div className="flex items-center gap-2 text-xs">
                                                <span className={`px-2 py-0.5 rounded-full font-bold uppercase ${selectedUser.role === 'ADMIN' ? 'bg-amber-500/20 text-amber-500' : selectedUser.role === 'VENDOR' ? 'bg-blue-500/20 text-blue-500' : 'bg-emerald-500/20 text-emerald-500'}`}>{selectedUser.role}</span>
                                                {selectedUser.companyName && <span className="text-slate-400">@ {selectedUser.companyName}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={() => setIsDetailsModalOpen(false)} className="text-slate-500 hover:text-white text-xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-800 transition-colors">✕</button>
                                </div>

                                <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    {/* Left Column: Info & Edit Form */}
                                    <div className="lg:col-span-1 space-y-6">
                                        <div className="bg-slate-950 rounded-xl p-5 border border-slate-800">
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="font-bold text-white">Profile Details</h3>
                                                <button onClick={() => setEditMode(!editMode)} className="text-xs text-blue-400 hover:text-blue-300 font-bold">{editMode ? 'Cancel' : 'Edit'}</button>
                                            </div>

                                            {editMode ? (
                                                <div className="space-y-4">
                                                    <div>
                                                        <label className="text-xs text-slate-500 mb-1 block">Full Name</label>
                                                        <input type="text" value={editUserForm.fullName} onChange={e => setEditUserForm({ ...editUserForm, fullName: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500" />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-slate-500 mb-1 block">Email</label>
                                                        <input type="email" value={editUserForm.email} onChange={e => setEditUserForm({ ...editUserForm, email: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500" />
                                                    </div>
                                                    {selectedUser.role === 'VENDOR' && (
                                                        <div>
                                                            <label className="text-xs text-slate-500 mb-1 block">Company Name</label>
                                                            <input type="text" value={editUserForm.companyName} onChange={e => setEditUserForm({ ...editUserForm, companyName: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500" />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <label className="text-xs text-slate-500 mb-1 block">National ID</label>
                                                        <input type="text" value={editUserForm.nationalId} onChange={e => setEditUserForm({ ...editUserForm, nationalId: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500" />
                                                    </div>
                                                    <button onClick={saveUserDetails} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded transition-colors text-sm">Save Changes</button>
                                                </div>
                                            ) : (
                                                <div className="space-y-3 text-sm">
                                                    <div><span className="text-slate-500 block text-xs">Email</span><span className="text-white break-all">{selectedUser.email}</span></div>
                                                    <div><span className="text-slate-500 block text-xs">Role</span><span className="text-white">{selectedUser.role}</span></div>
                                                    <div><span className="text-slate-500 block text-xs">Status</span><span className={`font-bold ${selectedUser.status === 'SUSPENDED' ? 'text-red-400' : 'text-emerald-400'}`}>{selectedUser.status}</span></div>
                                                    {selectedUser.companyName && <div><span className="text-slate-500 block text-xs">Company Name</span><span className="text-white">{selectedUser.companyName}</span></div>}
                                                    {selectedUser.nationalId && <div><span className="text-slate-500 block text-xs">National ID</span><span className="text-white font-mono">{selectedUser.nationalId}</span></div>}
                                                    <div><span className="text-slate-500 block text-xs">Joined</span><span className="text-white">{new Date(selectedUser.createdAt).toLocaleDateString()}</span></div>

                                                    {/* Link out to view full size images if they exist */}
                                                    {(selectedUser.facialDataUrl || selectedUser.cacCertificateUrl) && (
                                                        <div className="pt-3 mt-3 border-t border-slate-800 flex flex-wrap gap-2">
                                                            {selectedUser.facialDataUrl && <a href={selectedUser.facialDataUrl} target="_blank" rel="noopener noreferrer" className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded transition-colors inline-block">View Full Selfie</a>}
                                                            {selectedUser.cacCertificateUrl && <a href={selectedUser.cacCertificateUrl} target="_blank" rel="noopener noreferrer" className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded transition-colors inline-block">View Full CAC Doc</a>}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="bg-slate-950 rounded-xl p-5 border border-slate-800">
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="font-bold text-white">Security</h3>
                                            </div>
                                            {!isResettingPassword ? (
                                                <button onClick={() => setIsResettingPassword(true)} className="w-full bg-amber-500/10 border border-amber-500/20 text-amber-500 hover:bg-amber-500/20 font-bold py-2 rounded transition-colors text-sm">Reset Password</button>
                                            ) : (
                                                <div className="space-y-3">
                                                    <input type="password" placeholder="New Password" value={resetPassword} onChange={e => setResetPassword(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500" />
                                                    <div className="flex gap-2">
                                                        <button onClick={handleResetPassword} disabled={!resetPassword || resetPassword.length < 6} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold py-2 rounded transition-colors text-sm">Confirm</button>
                                                        <button onClick={() => { setIsResettingPassword(false); setResetPassword(''); }} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 rounded transition-colors text-sm">Cancel</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right Column: Devices List */}
                                    <div className="lg:col-span-2 space-y-6">
                                        <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex flex-col h-full min-h-[400px]">
                                            <div className="p-4 border-b border-slate-800 bg-slate-900/50">
                                                <h3 className="font-bold text-white flex items-center justify-between">
                                                    Registered Devices
                                                    <span className="bg-slate-800 px-2 py-0.5 rounded text-xs text-slate-300">{selectedUser.devices?.length || 0}</span>
                                                </h3>
                                            </div>
                                            <div className="flex-1 overflow-y-auto max-h-[500px]">
                                                {(!selectedUser.devices || selectedUser.devices.length === 0) ? (
                                                    <div className="p-8 text-center text-slate-500 text-sm">No devices registered by this user.</div>
                                                ) : (
                                                    <table className="w-full text-sm text-left">
                                                        <thead className="text-xs text-slate-400 uppercase bg-slate-900/30 border-b border-slate-800 sticky top-0">
                                                            <tr>
                                                                <th className="px-4 py-3">Device</th>
                                                                <th className="px-4 py-3">IMEI</th>
                                                                <th className="px-4 py-3">Status</th>
                                                                <th className="px-4 py-3">Registered</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-800/50">
                                                            {selectedUser.devices.map((device: any) => (
                                                                <tr key={device.id} className="hover:bg-slate-900/50">
                                                                    <td className="px-4 py-3 font-medium text-white">{device.brand} {device.model}</td>
                                                                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{device.imei}</td>
                                                                    <td className="px-4 py-3"><span className="text-[10px] uppercase font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded">{device.status}</span></td>
                                                                    <td className="px-4 py-3 text-xs text-slate-500">{new Date(device.createdAt).toLocaleDateString()}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }
            </main>
            {liveTrackingImei && <LiveView imei={liveTrackingImei as string} onClose={() => setLiveTrackingImei(null)} />}

            {/* Device Details Modal */}
            {isDeviceDetailsModalOpen && selectedDevice && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md overflow-y-auto">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden relative my-8 flex flex-col max-h-[90vh]">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-blue-500"></div>
                        <div className="p-6 border-b border-slate-800 flex justify-between items-start bg-slate-900/50 backdrop-blur-md">
                            <div className="flex items-center gap-5">
                                <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden flex-shrink-0 relative group">
                                    {selectedDevice.devicePhotos && selectedDevice.devicePhotos.length > 0 ? (
                                        <img src={selectedDevice.devicePhotos[0]} alt="Device" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-white">{selectedDevice.brand} {selectedDevice.model}</h2>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="text-xs font-mono text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">IMEI: {selectedDevice.imei}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${selectedDevice.status === 'CLEAN' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>{selectedDevice.status}</span>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setIsDeviceDetailsModalOpen(false)} className="text-slate-500 hover:text-white text-xl w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-800 transition-all">✕</button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
                            {/* Left: Metadata & Documents (4 cols) */}
                            <div className="lg:col-span-4 space-y-6">
                                <section className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
                                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Ownership Information</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Registered Owner</p>
                                            <p className="text-sm font-bold text-white">{selectedDevice.registeredOwner?.fullName || 'Anonymous'}</p>
                                            <p className="text-xs text-slate-400">{selectedDevice.registeredOwner?.email}</p>
                                        </div>
                                        {selectedDevice.registeredOwner?.phoneNumber && (
                                            <div>
                                                <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Phone</p>
                                                <p className="text-sm text-white font-mono">{selectedDevice.registeredOwner.phoneNumber}</p>
                                            </div>
                                        )}
                                        {selectedDevice.registeredOwner?.address && (
                                            <div>
                                                <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Home Address</p>
                                                <p className="text-xs text-slate-300 leading-relaxed">{selectedDevice.registeredOwner.address}</p>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                <section className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
                                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Evidence & Documents</h3>
                                    <div className="grid grid-cols-1 gap-2">
                                        {[
                                            { label: 'Device Photo', url: selectedDevice.devicePhotos?.[0], icon: '🖼️' },
                                            { label: 'Purchase Receipt', url: selectedDevice.purchaseReceiptUrl, icon: '🧾' },
                                            { label: 'Packaging/Carton', url: selectedDevice.cartonPhotoUrl, icon: '📦' }
                                        ].map(doc => (
                                            doc.url ? (
                                                <a key={doc.label} href={doc.url} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-blue-500/50 transition-all group">
                                                    <span className="text-xs font-bold text-slate-300 flex items-center gap-2"><span>{doc.icon}</span> {doc.label}</span>
                                                    <svg className="w-4 h-4 text-slate-600 group-hover:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                </a>
                                            ) : (
                                                <div key={doc.label} className="flex items-center justify-between p-3 rounded-xl bg-slate-900/50 border border-dashed border-slate-800 opacity-50">
                                                    <span className="text-xs font-medium text-slate-600">{doc.label} (Not Provided)</span>
                                                </div>
                                            )
                                        ))}
                                    </div>
                                </section>

                                <section className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
                                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">System Metrics</h3>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs text-slate-400">Trust Score</span>
                                        <span className={`text-sm font-black ${selectedDevice.riskScore >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>{selectedDevice.riskScore}/100</span>
                                    </div>
                                    <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${selectedDevice.riskScore >= 70 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${selectedDevice.riskScore}%` }}></div>
                                    </div>
                                </section>
                            </div>

                            {/* Center/Right: Tabs for History, Certificates, Incidents (8 cols) */}
                            <div className="lg:col-span-8 flex flex-col h-full gap-6">
                                {/* Digital Certificates Section */}
                                <section className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden flex flex-col">
                                    <div className="p-4 bg-slate-900/50 border-b border-slate-800 flex justify-between items-center">
                                        <h3 className="text-xs font-black text-white uppercase tracking-widest">Digital Property Certificates</h3>
                                        <span className="bg-blue-500/20 text-blue-400 text-[10px] font-black px-2 py-0.5 rounded-full">{selectedDevice.certificates?.length || 0} ISSUED</span>
                                    </div>
                                    <div className="p-4 space-y-3 max-h-[200px] overflow-y-auto">
                                        {(!selectedDevice.certificates || selectedDevice.certificates.length === 0) ? (
                                            <p className="text-xs text-slate-600 italic text-center py-4">No digital certificates have been generated for this device yet.</p>
                                        ) : selectedDevice.certificates.map((cert: any) => (
                                            <div key={cert.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center p-1">
                                                        {/* Placeholder for QR - usually we'd render the cert hash */}
                                                        <div className="grid grid-cols-2 gap-0.5 w-full h-full opacity-30">
                                                            <div className="bg-black"></div><div className="bg-black"></div><div className="bg-black"></div><div className="bg-gray-400"></div>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-white">Cert ID: {cert.id.split('-')[0].toUpperCase()}</p>
                                                        <p className="text-[10px] text-slate-500 font-mono tracking-tight">{cert.qrHash.substring(0, 32)}...</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">{new Date(cert.issueDate).toLocaleDateString()}</p>
                                                    <span className={`text-[9px] font-black ${cert.isActive ? 'text-emerald-500' : 'text-slate-500'}`}>{cert.isActive ? 'ACTIVE' : 'REVOKED'}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                {/* Activity & Forensics Logs */}
                                <section className="bg-slate-950 rounded-2xl border border-slate-800 flex-1 flex flex-col min-h-0 overflow-hidden">
                                    <div className="p-4 bg-slate-900/50 border-b border-slate-800">
                                        <h3 className="text-xs font-black text-white uppercase tracking-widest">Forensic Activity Log</h3>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                        {/* Incident Reports Merge */}
                                        {selectedDevice.incidents?.map((inc: any) => (
                                            <div key={inc.id} className="relative pl-6 border-l-2 border-red-500/30 pb-4">
                                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-950 border-2 border-red-500 flex items-center justify-center">
                                                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></div>
                                                </div>
                                                <div className="bg-red-500/5 rounded-xl p-3 border border-red-500/10">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">INCIDENT REPORTED: {inc.type}</span>
                                                        <span className="text-[10px] text-slate-500 font-bold">{new Date(inc.createdAt).toLocaleString()}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-300 font-medium">{inc.description}</p>
                                                    <div className="mt-2 flex justify-between items-center">
                                                        <span className="text-[9px] text-slate-500 italic">Reporter: {inc.reporter?.email}</span>
                                                        <span className="text-[9px] font-black bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">{inc.status}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        {/* Transaction History */}
                                        {selectedDevice.history?.map((hist: any) => (
                                            <div key={hist.id} className="relative pl-6 border-l-2 border-slate-800 pb-4">
                                                <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-slate-700"></div>
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{hist.type}</p>
                                                        <p className="text-xs text-white mt-1">{hist.description}</p>
                                                        {hist.actor && <p className="text-[9px] text-slate-600 mt-1 uppercase font-bold italic">Signed By: {hist.actor.email} ({hist.actor.role})</p>}
                                                    </div>
                                                    <span className="text-[10px] text-slate-500 font-bold">{new Date(hist.createdAt).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        ))}

                                        {(!selectedDevice.history?.length && !selectedDevice.incidents?.length) && (
                                            <p className="text-xs text-slate-600 italic text-center py-10">No physical or digital logs recorded for this device.</p>
                                        )}
                                    </div>
                                </section>
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-3">
                            <button onClick={() => setIsDeviceDetailsModalOpen(false)} className="px-5 py-2 rounded-xl text-sm font-bold text-slate-400 hover:text-white transition-colors">Close Console</button>
                            <button onClick={() => { setIsDeviceDetailsModalOpen(false); setLiveTrackingImei(selectedDevice.imei); }} className="px-5 py-2 rounded-xl text-sm font-bold bg-red-600 hover:bg-red-500 text-white transition-all shadow-lg shadow-red-600/20 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                Engage Live Tracking
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* HIDDEN DOSSIER TEMPLATE FOR PDF GENERATION */}
            <div className="fixed -left-[4000px] top-0 pointer-events-none">
                {dossierData && (
                    <div ref={dossierRef} className="w-[800px] p-12 bg-white text-slate-900 font-sans shadow-2xl flex flex-col min-h-[1123px]">
                        {/* Dossier Header */}
                        <div className="flex justify-between items-start border-b-[6px] border-slate-900 pb-8 mb-10">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-slate-200">PTS</div>
                                <div>
                                    <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900 leading-none">Forensic Asset Dossier</h1>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1">National Device Registry • Forensic Intelligence Division</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest leading-none mb-1">Dossier ID</p>
                                <p className="text-sm font-mono font-black text-red-600 bg-red-50 px-3 py-1 rounded-lg border border-red-100">{dossierData.reportId}</p>
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
                                <p className="text-sm font-bold text-red-600">CENTRAL ADMIN / RESTRICTED</p>
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
                                        {(dossierData.ledger || []).slice(0, 8).map((entry: any, idx: number) => (
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
                                        {(dossierData.maintenance || []).map((m: any, idx: number) => (
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
                                        {(!dossierData.maintenance || dossierData.maintenance.length === 0) && <p className="text-xs text-slate-400 italic">No technical service history available for this asset.</p>}
                                    </div>
                                </section>
                            </div>
                        </div>

                        {/* Dossier Footer */}
                        <div className="mt-auto pt-10 border-t border-slate-200 flex justify-between items-end">
                            <div className="flex gap-6 items-center">
                                <div className="w-20 h-20 bg-slate-900 p-2 rounded-lg flex items-center justify-center">
                                    <div className="w-full h-full bg-slate-800 rounded flex items-center justify-center text-[8px] text-slate-500 text-center uppercase tracking-tightest leading-none">PTS<br />FORENSIC<br />SEAL</div>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none mb-2 underline">Confidentiality Notice</p>
                                    <p className="text-[9px] text-slate-400 italic max-w-xs leading-relaxed">
                                        This document is an immutable record from the National Property Tracking System. Data integrity is guaranteed via cryptographical hash verification for central administration.
                                    </p>
                                </div>
                            </div>
                            <div className="text-right border-l-2 border-slate-900 pl-4">
                                <p className="text-[10px] font-mono font-black text-slate-900 uppercase">ADMINISTRATIVE CLEARANCE VERIFIED</p>
                                <p className="text-[8px] text-slate-400 uppercase tracking-widest font-bold">PTS GLOBAL COMMAND • CORE v4.1</p>
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'intelligence' && (
                    <IntelligenceView apiUrl={apiUrl} headers={headers} />
                )}

                {/* TAB: Telecom EIR */}
                {activeTab === 'telecom-eir' && (
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 flex items-center justify-center text-rose-400 border border-rose-500/30">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Telecom EIR Sandbox</h3>
                                <p className="text-sm text-slate-400">Simulate network-level blocking across major Nigerian telecom operators.</p>
                            </div>
                        </div>
                        <div className="grid md:grid-cols-3 gap-6">
                            {['MTN Nigeria', 'Airtel', 'Globacom (Glo)'].map(telco => (
                                <div key={telco} className="bg-slate-950 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between">
                                    <div>
                                        <h4 className="text-white font-black mb-2">{telco}</h4>
                                        <p className="text-xs text-slate-500 mb-4">Equipment Identity Register (EIR) Link: <span className="text-emerald-500">Active</span></p>
                                    </div>
                                    <button onClick={() => alert(`Simulating Drop-Kick for stolen IMEIs on ${telco} network. In production, this pushes to the Kafka event queue.`)} className="w-full py-3 rounded-lg text-sm font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all border border-slate-700">
                                        Test Network Drop-Kick
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* TAB: Active Warrants */}
                {activeTab === 'warrants' && (
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-400 border border-amber-500/30">
                                <LayoutDashboard className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">NPF Active Warrants</h3>
                                <p className="text-sm text-slate-400">Force devices into Bloodhound tracking mode based on electronic police warrants.</p>
                            </div>
                        </div>
                        <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl">
                            <h4 className="text-slate-300 font-bold mb-4 uppercase text-sm tracking-widest border-b border-slate-800 pb-2">Issue Digital Warrant</h4>
                            <div className="flex gap-4">
                                <input type="text" placeholder="Enter Target IMEI..." className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500" />
                                <button onClick={() => alert('Warrant Executed! Target device is now in Bloodhound Mode. Live pings will be forwarded to Law Enforcement.')} className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-8 py-3 rounded-lg shadow-lg">
                                    Execute Warrant
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 mt-4 italic">Execution forces the native PTS app (if installed) to ignore battery constraints and ping GPS every 60 seconds.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
