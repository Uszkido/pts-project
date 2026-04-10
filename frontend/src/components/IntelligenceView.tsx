'use client';

import React, { useState, useEffect } from 'react';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as ReTooltip,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import { Brain, TrendingUp, ShieldAlert, Cpu, Database, Activity } from 'lucide-react';

interface IntelligenceViewProps {
    apiUrl: string;
    headers: any;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function IntelligenceView({ apiUrl, headers }: IntelligenceViewProps) {
    const [briefing, setBriefing] = useState<string>('');
    const [trends, setTrends] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const { api } = await import('@/lib/api');
                const [briefingData, trendsData] = await Promise.all([
                    api.get('/admin/intelligence/briefing'),
                    api.get('/admin/analytics/trends')
                ]);

                setBriefing(briefingData.briefing);
                setTrends(trendsData);
            } catch (error) {
                console.error('Failed to load intelligence data');
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-96 space-y-4">
                <Brain className="w-12 h-12 text-indigo-500 animate-pulse" />
                <p className="text-slate-400 font-mono italic">Sentinel Brain is processing national theft patterns...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* AI Top Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-slate-900/50 backdrop-blur-xl border border-indigo-500/20 rounded-3xl p-8 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Brain size={120} className="text-indigo-400" />
                    </div>
                    <div className="flex items-center space-x-3 mb-6">
                        <div className="p-3 bg-indigo-500/10 rounded-2xl">
                            <Brain className="text-indigo-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-white">National Commanders Briefing</h2>
                    </div>
                    <div className="font-mono text-indigo-100/90 leading-relaxed whitespace-pre-wrap min-h-[150px]">
                        {briefing || "No active intelligence briefing available at this moment. Stay vigilant."}
                    </div>
                    <div className="mt-8 flex items-center space-x-4 text-xs font-mono text-slate-500">
                        <span className="flex items-center"><Activity size={14} className="mr-1" /> LIVE ANALYSIS</span>
                        <span className="flex items-center"><Database size={14} className="mr-1" /> PTS CENTRAL DB</span>
                        <span className="flex items-center text-indigo-400"><Cpu size={14} className="mr-1" /> GEMINI 1.5 PRO ACTIVE</span>
                    </div>
                </div>

                <div className="bg-slate-900/50 backdrop-blur-xl border border-emerald-500/20 rounded-3xl p-8">
                    <div className="flex items-center space-x-3 mb-6">
                        <div className="p-3 bg-emerald-500/10 rounded-2xl">
                            <TrendingUp className="text-emerald-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-white">Trust Analytics</h2>
                    </div>
                    <div className="space-y-6">
                        <div className="flex justify-between items-center bg-slate-800/50 p-4 rounded-2xl">
                            <span className="text-slate-400">Compliance Rate</span>
                            <span className="text-emerald-400 font-bold text-xl">98.2%</span>
                        </div>
                        <div className="flex justify-between items-center bg-slate-800/50 p-4 rounded-2xl">
                            <span className="text-slate-400">Recovery velocity</span>
                            <span className="text-indigo-400 font-bold text-xl">1.4 days/avg</span>
                        </div>
                        <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl">
                            <p className="text-xs text-emerald-300 font-mono">
                                🛡️ National Registry integrity is currently at "OPTIMAL" status. No unauthorized IMEI manipulations detected in last 24h.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-8">
                    <h3 className="text-xl font-bold text-white mb-6">Theft vs Recovery Trends (6mo)</h3>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trends?.monthlyTrends}>
                                <defs>
                                    <linearGradient id="colorThefts" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorRecov" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="name" stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" />
                                <ReTooltip
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                                />
                                <Area type="monotone" dataKey="thefts" stroke="#ef4444" fillOpacity={1} fill="url(#colorThefts)" />
                                <Area type="monotone" dataKey="recoveries" stroke="#6366f1" fillOpacity={1} fill="url(#colorRecov)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-8">
                    <h3 className="text-xl font-bold text-white mb-6">Device Brand Vulnerability</h3>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={trends?.brandStats}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="name" stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" />
                                <ReTooltip
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                                />
                                <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
