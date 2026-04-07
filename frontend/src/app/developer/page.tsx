'use client';
import { useState } from 'react';

export default function DeveloperPortal() {
    const [form, setForm] = useState({ companyName: '', contactEmail: '', billingPlan: 'PAYG', useCase: '' });
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('loading');
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const res = await fetch(`${apiUrl}/b2b/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setStatus('success');
            setMessage(data.message);
        } catch (err: any) {
            setStatus('error');
            setMessage(err.message);
        }
    };

    const endpoints = [
        {
            method: 'GET',
            path: '/api/v1/b2b/verify/:imei',
            desc: 'Verify a device IMEI against the national registry.',
            response: '{ status, riskScore, isSafeTransaction, brand, model }',
            color: 'emerald'
        }
    ];

    const useCases = [
        { icon: '🏦', title: 'Fintech & Banking', desc: 'Block fraudulent accounts opened from stolen phones. Protect loan & transfer flows.' },
        { icon: '🛒', title: 'E-Commerce', desc: 'Validate used devices listed for sale on your platform. Kill the stolen phone black market.' },
        { icon: '📱', title: 'Telecom Providers', desc: 'Cross-reference IMEI against national registry before SIM activation.' },
        { icon: '🏪', title: 'POS & Retailers', desc: 'Scan trade-in phones before purchase. Protect your business from receiving stolen goods.' },
    ];

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">
            {/* Navbar */}
            <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <a href="/" className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-black text-white text-sm">PTS</div>
                        <span className="font-bold text-white">Developer Portal</span>
                        <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">B2B API</span>
                    </a>
                    <a href="/" className="text-sm text-slate-400 hover:text-white transition-colors">← Back to Registry</a>
                </div>
            </nav>

            {/* Hero */}
            <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
                <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                    PTS National Registry — Open API
                </div>
                <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-slate-200 to-slate-500 mb-6">
                    Build with the <br />
                    <span className="text-blue-500">Nigeria IMEI Registry</span>
                </h1>
                <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
                    Integrate real-time stolen device detection into your Fintech, E-Commerce, or Telecom platform with a single API call. Protect your business and your users.
                </p>
            </section>

            {/* Use Cases */}
            <section className="max-w-5xl mx-auto px-6 pb-20">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-20">
                    {useCases.map(uc => (
                        <div key={uc.title} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-blue-900/50 transition-colors">
                            <div className="text-3xl mb-3">{uc.icon}</div>
                            <h3 className="font-bold text-white mb-2">{uc.title}</h3>
                            <p className="text-sm text-slate-400 leading-relaxed">{uc.desc}</p>
                        </div>
                    ))}
                </div>

                {/* API Docs */}
                <div className="mb-20">
                    <h2 className="text-2xl font-black text-white mb-2">API Reference</h2>
                    <p className="text-slate-400 mb-6 text-sm">All requests must include your API Key in the <code className="text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded text-xs">x-api-key</code> header.</p>

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                        {/* Base URL */}
                        <div className="p-4 border-b border-slate-800 bg-slate-950/50">
                            <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">Base URL</span>
                            <div className="font-mono text-blue-400 text-sm mt-1">https://pts-backend-api.vercel.app</div>
                        </div>

                        {endpoints.map(ep => (
                            <div key={ep.path} className="p-6">
                                <div className="flex flex-wrap items-center gap-3 mb-3">
                                    <span className={`px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20`}>{ep.method}</span>
                                    <code className="font-mono text-sm text-white">{ep.path}</code>
                                </div>
                                <p className="text-slate-400 text-sm mb-4">{ep.desc}</p>
                                <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
                                    <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-2">Example Response</p>
                                    <pre className="font-mono text-xs text-emerald-400 whitespace-pre-wrap">{`{
  "imei": "351234567890123",
  "brand": "Samsung",
  "model": "Galaxy A54",
  "status": "CLEAN",
  "riskScore": 95,
  "isBricked": false,
  "isSafeTransaction": true
}`}</pre>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Code Example */}
                    <div className="mt-4 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                        <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex items-center gap-2">
                            <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">Integration Example</span>
                            <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-bold">JavaScript / Node.js</span>
                        </div>
                        <div className="p-6">
                            <pre className="font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{`const checkImei = async (imei) => {
  const res = await fetch(
    \`https://pts-backend-api.vercel.app/api/v1/b2b/verify/\${imei}\`,
    {
      headers: {
        'x-api-key': process.env.PTS_API_KEY
      }
    }
  );
  const data = await res.json();

  if (!data.isSafeTransaction) {
    // Block the transaction / listing
    return { blocked: true, reason: data.status };
  }
  return { blocked: false };
};`}</pre>
                        </div>
                    </div>
                </div>

                {/* Pricing */}
                <div className="mb-20">
                    <h2 className="text-2xl font-black text-white mb-6">Pricing Plans</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
                            <h3 className="text-lg font-bold text-white mb-1">Pay As You Go</h3>
                            <p className="text-slate-400 text-sm mb-6">Ideal for startups and growing platforms.</p>
                            <div className="text-4xl font-black text-white mb-1">₦10 <span className="text-slate-500 text-lg font-normal">/ call</span></div>
                            <p className="text-xs text-slate-500 mb-6">10,000 free calls/month included</p>
                            <ul className="space-y-2 text-sm text-slate-300">
                                <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Real-time IMEI status</li>
                                <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Risk Score & Brand info</li>
                                <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Automated key delivery</li>
                            </ul>
                        </div>
                        <div className="bg-slate-900 border border-blue-500/40 rounded-2xl p-8 relative overflow-hidden shadow-lg shadow-blue-500/10">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
                            <div className="inline-block bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-[10px] font-black px-2.5 py-1 mb-3 uppercase tracking-widest">Most Popular</div>
                            <h3 className="text-lg font-bold text-white mb-1">Enterprise</h3>
                            <p className="text-slate-400 text-sm mb-6">For banks, telcos, and major platforms.</p>
                            <div className="text-4xl font-black text-white mb-1">Custom</div>
                            <p className="text-xs text-slate-500 mb-6">Up to 1,000,000 calls/month</p>
                            <ul className="space-y-2 text-sm text-slate-300">
                                <li className="flex items-center gap-2"><span className="text-blue-400">✓</span> Everything in PAYG</li>
                                <li className="flex items-center gap-2"><span className="text-blue-400">✓</span> Dedicated SLA support</li>
                                <li className="flex items-center gap-2"><span className="text-blue-400">✓</span> Webhook event notifications</li>
                                <li className="flex items-center gap-2"><span className="text-blue-400">✓</span> NCC Telecom Block integration</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Request Form */}
                <div id="request-access">
                    <h2 className="text-2xl font-black text-white mb-2">Request API Access</h2>
                    <p className="text-slate-400 mb-8 text-sm">Fill in your details below. Your unique API Key will be generated and <strong className="text-white">emailed directly</strong> to you automatically — no waiting, no manual reviews for PAYG.</p>

                    {status === 'success' ? (
                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-10 text-center">
                            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">API Key Dispatched!</h3>
                            <p className="text-emerald-400 font-medium">{message}</p>
                            <p className="text-slate-400 text-sm mt-3">Check your inbox (and spam folder). The key email arrives within 30 seconds.</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Company / Organization Name *</label>
                                    <input
                                        type="text"
                                        required
                                        value={form.companyName}
                                        onChange={e => setForm({ ...form, companyName: e.target.value })}
                                        placeholder="e.g. Opay Nigeria Ltd"
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Technical Contact Email *</label>
                                    <input
                                        type="email"
                                        required
                                        value={form.contactEmail}
                                        onChange={e => setForm({ ...form, contactEmail: e.target.value })}
                                        placeholder="dev@yourcompany.com"
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors text-sm"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Billing Plan *</label>
                                <select
                                    value={form.billingPlan}
                                    onChange={e => setForm({ ...form, billingPlan: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors text-sm"
                                >
                                    <option value="PAYG">Pay As You Go — ₦10/call (10,000 free calls/month)</option>
                                    <option value="ENTERPRISE">Enterprise — Custom pricing (up to 1M calls/month)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Describe Your Use Case</label>
                                <textarea
                                    rows={3}
                                    value={form.useCase}
                                    onChange={e => setForm({ ...form, useCase: e.target.value })}
                                    placeholder="e.g. We want to block stolen phones from being used to open accounts on our platform..."
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors text-sm resize-none"
                                />
                            </div>
                            {status === 'error' && (
                                <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{message}</p>
                            )}
                            <button
                                type="submit"
                                disabled={status === 'loading'}
                                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 text-sm"
                            >
                                {status === 'loading' ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        Generating & Dispatching Key...
                                    </>
                                ) : (
                                    '🔑 Generate My API Key'
                                )}
                            </button>
                            <p className="text-xs text-slate-500 text-center">Your key will be generated instantly and emailed to your contact address. No human review required for PAYG.</p>
                        </form>
                    )}
                </div>
            </section>

            <footer className="border-t border-slate-900 py-8 text-center">
                <p className="text-xs text-slate-600">© Vexel Innovations 2026 — PTS National Device Registry B2B Developer Portal</p>
            </footer>
        </div>
    );
}
