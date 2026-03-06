'use client';
import { useState, useEffect } from 'react';

export default function AdminDashboard() {
    const [stats, setStats] = useState<any>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [devices, setDevices] = useState<any[]>([]);
    const [incidents, setIncidents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'vendors' | 'devices' | 'incidents' | 'documents' | 'messages'>('overview');
    const [roleFilter, setRoleFilter] = useState('');

    // New feature states
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<{ users: any[], devices: any[] } | null>(null);
    const [isSearching, setIsSearching] = useState(false);

    const [documents, setDocuments] = useState<{ userDocuments: any[], deviceDocuments: any[] }>({ userDocuments: [], deviceDocuments: [] });
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState({ subject: '', body: '' });

    // Create Account Modal
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newUser, setNewUser] = useState({ email: '', password: '', role: 'CONSUMER', fullName: '', companyName: '', nationalId: '' });

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
    const headers = { 'Authorization': `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('pts_token') : ''}` };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [dashRes, usersRes, devicesRes, incidentsRes, docsRes, msgsRes] = await Promise.all([
                fetch(`${apiUrl}/admin/dashboard`, { headers }),
                fetch(`${apiUrl}/admin/users`, { headers }),
                fetch(`${apiUrl}/admin/devices`, { headers }),
                fetch(`${apiUrl}/admin/incidents`, { headers }),
                fetch(`${apiUrl}/admin/documents`, { headers }),
                fetch(`${apiUrl}/admin/messages`, { headers })
            ]);

            if (!dashRes.ok) throw new Error('Access denied. Admin privileges required.');

            const [dashData, usersData, devicesData, incidentsData, docsData, msgsData] = await Promise.all([
                dashRes.json(), usersRes.json(), devicesRes.json(), incidentsRes.json(), docsRes.json(), msgsRes.json()
            ]);

            setStats(dashData);
            setUsers(usersData.users || []);
            setDevices(devicesData.devices || []);
            setIncidents(incidentsData.incidents || []);
            setDocuments(docsData || { userDocuments: [], deviceDocuments: [] });
            setMessages(msgsData.messages || []);
        } catch (err: any) {
            setError(err.message);
            if (err.message.includes('401') || err.message.includes('403')) {
                window.location.href = '/admin/login';
            }
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

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch(`${apiUrl}/admin/messages`, {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...newMessage, receiverRole: 'POLICE' })
            });
            if (!res.ok) throw new Error('Failed to send message');
            setNewMessage({ subject: '', body: '' });
            fetchData();
            alert('Message sent to Law Enforcement');
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

    const deleteDevice = async (deviceId: string) => {
        if (!confirm('Delete this device permanently?')) return;
        try {
            const res = await fetch(`${apiUrl}/admin/devices/${deviceId}`, { method: 'DELETE', headers });
            if (!res.ok) throw new Error('Failed to delete device');
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
                                    <div key={d.id} className="px-4 py-3 hover:bg-slate-800 cursor-pointer border-l-2 border-transparent hover:border-emerald-500">
                                        <p className="font-bold text-white text-sm">{d.brand} {d.model}</p>
                                        <p className="text-xs font-mono text-slate-400 mt-0.5">IMEI: {d.imei} <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-slate-950 border border-slate-800">{d.status}</span></p>
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
                    {(['overview', 'vendors', 'users', 'devices', 'incidents', 'documents', 'messages'] as const).map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all capitalize ${activeTab === tab ? 'bg-amber-600/20 text-amber-400 shadow-lg border border-amber-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}>
                            {tab === 'vendors' ? `Vendors (${pendingVendors.length} pending)` : tab}
                        </button>
                    ))}
                </div>

                {/* TAB: Overview */}
                {activeTab === 'overview' && stats && (
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
                    </div>
                )}

                {/* TAB: Vendor Approvals */}
                {activeTab === 'vendors' && (
                    <div className="space-y-4">
                        {users.filter(u => u.role === 'VENDOR').length === 0 ? (
                            <div className="text-center py-12 text-slate-500">No vendor accounts registered.</div>
                        ) : users.filter(u => u.role === 'VENDOR').map(vendor => (
                            <div key={vendor.id} className={`bg-slate-900 border rounded-2xl p-6 ${vendor.vendorStatus === 'PENDING' ? 'border-amber-500/30' : 'border-slate-800'}`}>
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h4 className="text-lg font-bold text-white">{vendor.companyName || vendor.email}</h4>
                                        <p className="text-sm text-slate-400">{vendor.email}</p>
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
                                <div className="flex gap-2 mt-4 pt-4 border-t border-slate-800">
                                    {vendor.vendorStatus !== 'APPROVED' && <button onClick={() => updateVendorStatus(vendor.id, 'APPROVED')} className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg transition-colors">✓ Approve</button>}
                                    {vendor.vendorStatus !== 'REJECTED' && <button onClick={() => updateVendorStatus(vendor.id, 'REJECTED')} className="text-xs font-bold bg-red-600/80 hover:bg-red-500 text-white px-4 py-2 rounded-lg transition-colors">✕ Reject</button>}
                                    {vendor.vendorStatus === 'APPROVED' && <button onClick={() => updateVendorStatus(vendor.id, 'SUSPENDED')} className="text-xs font-bold bg-amber-600/80 hover:bg-amber-500 text-white px-4 py-2 rounded-lg transition-colors">⚠ Suspend</button>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* TAB: Users */}
                {activeTab === 'users' && (
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
                                            </td>
                                            <td className="px-6 py-4">
                                                <select value={user.role} onChange={e => updateUserRole(user.id, e.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white">
                                                    {['ADMIN', 'VENDOR', 'CONSUMER', 'POLICE', 'INSURANCE', 'TELECOM'].map(r => <option key={r} value={r}>{r}</option>)}
                                                </select>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusColor(user.vendorStatus)}`}>{user.vendorStatus}</span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-300">{user._count?.devices || 0}</td>
                                            <td className="px-6 py-4 text-slate-500 text-xs">{new Date(user.createdAt).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => deleteUser(user.id)} className="text-xs text-red-500 hover:text-red-400 font-bold">Delete</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TAB: Devices */}
                {activeTab === 'devices' && (
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
                                        <td className="px-6 py-4 font-bold text-white">{d.brand} {d.model}</td>
                                        <td className="px-6 py-4 font-mono text-xs text-slate-400">{d.imei}</td>
                                        <td className="px-6 py-4">
                                            <select value={d.status} onChange={e => updateDeviceStatus(d.id, e.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white">
                                                {['CLEAN', 'STOLEN', 'INVESTIGATING', 'RECOVERED', 'FROZEN', 'BLACKLISTED'].map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-slate-400">{d.registeredOwner?.email}</td>
                                        <td className="px-6 py-4">
                                            <span className={`font-bold ${d.riskScore >= 70 ? 'text-emerald-400' : d.riskScore >= 40 ? 'text-amber-400' : 'text-red-500'}`}>{d.riskScore}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex gap-2 justify-end">
                                                <button onClick={() => transferDevice(d.id)} className="text-xs text-blue-400 hover:text-blue-300 font-bold">Transfer</button>
                                                <button onClick={() => deleteDevice(d.id)} className="text-xs text-red-500 hover:text-red-400 font-bold">Delete</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* TAB: Incidents */}
                {activeTab === 'incidents' && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-300 uppercase bg-slate-950/50 border-b border-slate-800">
                                <tr>
                                    <th className="px-6 py-4">Date</th>
                                    <th className="px-6 py-4">Type</th>
                                    <th className="px-6 py-4">Device</th>
                                    <th className="px-6 py-4">Reporter</th>
                                    <th className="px-6 py-4">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {incidents.map(inc => (
                                    <tr key={inc.id} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-4 text-xs text-slate-400">{new Date(inc.createdAt).toLocaleDateString()}</td>
                                        <td className="px-6 py-4"><span className="bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full text-[10px] font-bold">{inc.type}</span></td>
                                        <td className="px-6 py-4"><span className="font-bold text-white">{inc.device?.brand} {inc.device?.model}</span><span className="text-xs text-slate-500 font-mono ml-2">{inc.device?.imei}</span></td>
                                        <td className="px-6 py-4 text-xs text-slate-400">{inc.reporter?.email}</td>
                                        <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${inc.status === 'OPEN' ? 'bg-red-500/10 text-red-500' : 'bg-slate-700 text-slate-400'}`}>{inc.status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* TAB: Documents */}
                {activeTab === 'documents' && (
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
                                    <div key={d.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl shadow-md">
                                        <div className="mb-3">
                                            <p className="font-bold text-white text-sm">{d.brand} {d.model}</p>
                                            <p className="text-xs font-mono text-slate-400">IMEI: {d.imei}</p>
                                            <p className="text-xs font-medium text-slate-500 mt-0.5">Owner: {d.registeredOwner?.fullName || d.registeredOwner?.email}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {d.devicePhotoUrl && <a href={d.devicePhotoUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-1 rounded inline-flex items-center gap-1 hover:bg-blue-500/20">📱 Photo</a>}
                                            {d.purchaseReceiptUrl && <a href={d.purchaseReceiptUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded inline-flex items-center gap-1 hover:bg-emerald-500/20">🧾 Receipt</a>}
                                            {d.cartonPhotoUrl && <a href={d.cartonPhotoUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded inline-flex items-center gap-1 hover:bg-amber-500/20">📦 Carton</a>}
                                        </div>
                                    </div>
                                ))}
                                {documents.deviceDocuments.length === 0 && <p className="text-slate-500 text-sm italic">No device documents</p>}
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB: Messages */}
                {activeTab === 'messages' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl h-fit sticky top-24">
                            <h3 className="text-lg font-bold text-white mb-4">Message Law Enforcement</h3>
                            <form onSubmit={sendMessage} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Subject *</label>
                                    <input type="text" value={newMessage.subject} onChange={e => setNewMessage({ ...newMessage, subject: e.target.value })} required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500" placeholder="Case investigation request..." />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Message *</label>
                                    <textarea value={newMessage.body} onChange={e => setNewMessage({ ...newMessage, body: e.target.value })} required rows={4} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500" placeholder="Type message to police..." />
                                </div>
                                <button type="submit" className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg> Send Message
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
                                            <span className="text-xs text-slate-500 font-medium">{new Date(msg.createdAt).toLocaleString()}</span>
                                        </div>
                                        <p className="text-sm font-bold text-slate-300 mb-1">{msg.subject}</p>
                                        <p className="text-sm text-slate-400 whitespace-pre-wrap">{msg.body}</p>
                                    </div>
                                ))}
                                {messages.length === 0 && <div className="text-center py-20 text-slate-500">No messages in thread yet.</div>}
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Create Account Modal */}
            {isCreateOpen && (
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
            )}
        </div>
    );
}
