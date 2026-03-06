'use client';
import { useState, useEffect } from 'react';

export default function AdminDashboard() {
    const [stats, setStats] = useState<any>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [devices, setDevices] = useState<any[]>([]);
    const [incidents, setIncidents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'vendors' | 'devices' | 'incidents'>('overview');
    const [roleFilter, setRoleFilter] = useState('');

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
    const headers = { 'Authorization': `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('pts_token') : ''}` };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [dashRes, usersRes, devicesRes, incidentsRes] = await Promise.all([
                fetch(`${apiUrl}/admin/dashboard`, { headers }),
                fetch(`${apiUrl}/admin/users`, { headers }),
                fetch(`${apiUrl}/admin/devices`, { headers }),
                fetch(`${apiUrl}/admin/incidents`, { headers })
            ]);

            if (!dashRes.ok) throw new Error('Access denied. Admin privileges required.');

            const [dashData, usersData, devicesData, incidentsData] = await Promise.all([
                dashRes.json(), usersRes.json(), devicesRes.json(), incidentsRes.json()
            ]);

            setStats(dashData);
            setUsers(usersData.users || []);
            setDevices(devicesData.devices || []);
            setIncidents(incidentsData.incidents || []);
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
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-600 to-red-600 text-white flex items-center justify-center font-black text-sm shadow-lg">A</div>
                    <span className="text-xl font-bold text-white tracking-tight">Admin Console</span>
                    <span className="text-[10px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 font-bold uppercase">System Administrator</span>
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
                    {(['overview', 'vendors', 'users', 'devices', 'incidents'] as const).map(tab => (
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
                        <div className="flex gap-2 mb-4">
                            {['', 'ADMIN', 'VENDOR', 'CONSUMER', 'POLICE'].map(r => (
                                <button key={r} onClick={() => setRoleFilter(r)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${roleFilter === r ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white'}`}>{r || 'All'}</button>
                            ))}
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
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {devices.map(d => (
                                    <tr key={d.id} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-4 font-bold text-white">{d.brand} {d.model}</td>
                                        <td className="px-6 py-4 font-mono text-xs text-slate-400">{d.imei}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${d.status === 'CLEAN' ? 'bg-emerald-500/10 text-emerald-400' : d.status === 'STOLEN' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-400'}`}>{d.status}</span>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-slate-400">{d.registeredOwner?.email}</td>
                                        <td className="px-6 py-4">
                                            <span className={`font-bold ${d.riskScore >= 70 ? 'text-emerald-400' : d.riskScore >= 40 ? 'text-amber-400' : 'text-red-500'}`}>{d.riskScore}</span>
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
            </main>
        </div>
    );
}
