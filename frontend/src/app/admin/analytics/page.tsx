"use client";

import { useState, useEffect } from 'react';

export default function MetabaseAnalytics() {
    const [iframeUrl, setIframeUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchEmbedUrl = async () => {
            try {
                const adminToken = localStorage.getItem('adminToken');
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://pts-backend-api.vercel.app/api/v1';

                const res = await fetch(`${apiUrl}/analytics/metabase/embed`, {
                    headers: {
                        'Authorization': `Bearer ${adminToken}`
                    }
                });

                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.error || 'Failed to fetch analytics URL');
                }

                setIframeUrl(data.iframeUrl);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchEmbedUrl();
    }, []);

    const content = (
        <div className="min-h-screen bg-slate-950 p-6 md:p-10">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-white tracking-tight">Enterprise Analytics</h1>
                        <p className="text-slate-400 mt-1">Live Intelligence & Reporting powered by Vexel Metabase integration</p>
                    </div>
                </div>

                {loading ? (
                    <div className="h-[75vh] w-full bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-center">
                        <svg className="animate-spin h-10 w-10 text-blue-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <p className="text-slate-400 font-medium tracking-widest uppercase text-sm animate-pulse">Initializing Data Connection...</p>
                    </div>
                ) : error ? (
                    <div className="h-[75vh] w-full bg-slate-900 border border-red-500/20 rounded-2xl flex flex-col items-center justify-center text-center p-8">
                        <svg className="w-16 h-16 text-red-500/50 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <p className="text-red-400 font-bold mb-2">Analytics Engine Offline</p>
                        <p className="text-slate-500 text-sm max-w-md">{error}. Have you started the Metabase Docker container yet?</p>
                        <div className="mt-6 bg-slate-950 p-4 rounded-xl border border-slate-800 text-left w-full max-w-lg overflow-auto">
                            <code className="text-xs text-blue-400">
                                $ docker-compose -f docker-compose.metabase.yml up -d
                            </code>
                        </div>
                    </div>
                ) : (
                    <div className="h-[75vh] w-full bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 ring-1 ring-white/5">
                        <iframe
                            src={iframeUrl || ""}
                            frameBorder="0"
                            width="100%"
                            height="100%"
                            allowTransparency
                            className="bg-slate-900"
                        ></iframe>
                    </div>
                )}
            </div>
        </div>
    );

    // Render plain to ensure it works even if AdminLayout is complex
    return content;
}
