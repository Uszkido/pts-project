'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const STATS = [
    { num: 2.1, suffix: 'B+', label: 'Naira Lost Annually to Device Theft', prefix: '₦' },
    { num: 500, suffix: '+', label: 'Devices Stolen Daily in Lagos Alone', prefix: '' },
    { num: 91, suffix: '%', label: 'Of Stolen Phones Resold With Impunity', prefix: '' },
    { num: 5, suffix: '', label: 'Stakeholder Portals, One Unified System', prefix: '' },
];

const PORTALS = [
    { icon: '👤', color: '#10b981', bg: 'rgba(16,185,129,0.1)', title: 'Consumer Portal', desc: 'Register devices, download ownership certificates, flag theft in seconds.' },
    { icon: '🚔', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', title: 'Police Command Center', desc: 'Forensic dossiers, triangulation tracking, suspect registry, and kill-switch.' },
    { icon: '🏪', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', title: 'Vendor Network', desc: 'Pre-purchase IMEI scanner, maintenance logs, and stolen device alerts.' },
    { icon: '🏛️', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', title: 'Admin Oversight', desc: 'National surveillance map, user management, and cross-portal analytics.' },
    { icon: '🌐', color: '#a855f7', bg: 'rgba(168,85,247,0.1)', title: 'Public Verify', desc: 'Anyone scans a QR code to verify a device\'s legal status before buying.' },
];

const STEPS = [
    { num: '01', title: 'Vendor Registers Device', desc: 'Certified vendor registers IMEI, hardware DNA serials, device photos, and receipt at point of sale.' },
    { num: '02', title: '2FA Ownership Transfer', desc: 'Buyer receives a 6-digit Handover Code to complete cryptographic ownership transfer.' },
    { num: '03', title: 'Certificate Issued', desc: 'A Digital Device Ownership Certificate (DDOC) is generated — QR-linked and downloadable as PDF.' },
    { num: '04', title: 'Lifetime Protection', desc: 'If stolen, one report locks the device globally. All vendors instantly alerted.' },
];

const TECH = [
    { icon: '⚡', name: 'Next.js / Vercel Edge', desc: 'Sub-100ms response times globally. Scales to millions of concurrent device verifications.' },
    { icon: '🔐', name: 'Neon PostgreSQL Ledger', desc: 'Serverless, ACID-compliant database. Every transfer is immutable and cryptographically signed.' },
    { icon: '🤖', name: 'Google Gemini AI', desc: 'Sentinel AI analyzes receipt fraud, hardware tampering, and history for automated risk scoring.' },
    { icon: '🖼️', name: 'Cloudinary Forensics', desc: 'Encrypted CDN storage for device photo evidence — accessible to law enforcement anytime.' },
    { icon: '🌍', name: 'Real-Time Surveillance Map', desc: 'Dark-mode geospatial intelligence with pulsing alert markers and triangulation visualization.' },
    { icon: '🔑', name: 'JWT Role Architecture', desc: 'Five distinct permission tiers — all cryptographically enforced at every API endpoint.' },
];

const ROADMAP = [
    { phase: '✅ Phase 1 — Live', color: '#10b981', textColor: 'black', title: 'Core Platform Launch', desc: 'All five portals live on Vercel. AI risk engine, forensic PDF export, and surveillance map operational.', tags: ['Backend API', '5 Portals', 'AI Engine', 'PDF Export', 'Map View'] },
    { phase: '🔵 Phase 2 — Q3 2026', color: '#3b82f6', textColor: 'white', title: 'Telecom & NCC Integration', desc: 'Direct integration with MTN, Glo, Airtel, 9mobile. NCC regulatory partnership for IMEI blocking at network level.', tags: ['NCC Partnership', 'IMEI Blocking', 'SIM Lockout', 'Telecom APIs'] },
    { phase: '⬜ Phase 3 — Q1 2027', color: '#334155', textColor: '#94a3b8', title: 'NPF Integration & National Mandate', desc: 'Nigeria Police Force central command integration. Proposed legislative mandate for PTS registration as a condition of legal device commerce.', tags: ['NPF Integration', 'Legislative Push', '36 States', 'FCT Rollout'] },
    { phase: '⬜ Phase 4 — 2028', color: '#334155', textColor: '#94a3b8', title: 'ECOWAS Regional Expansion', desc: 'Expand PTS to Ghana, Côte d\'Ivoire, Senegal, and other ECOWAS states — creating a West African device security bloc.', tags: ['ECOWAS', 'Ghana', 'Cross-border', 'Regional Hub'] },
];

function useCountUp(target: number, duration = 2000) {
    const [count, setCount] = useState(0);
    const [started, setStarted] = useState(false);
    const ref = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && !started) {
                setStarted(true);
                let start = 0;
                const step = 16;
                const inc = target / (duration / step);
                const timer = setInterval(() => {
                    start += inc;
                    if (start >= target) { setCount(target); clearInterval(timer); }
                    else setCount(target % 1 !== 0 ? parseFloat(start.toFixed(1)) : Math.floor(start));
                }, step);
            }
        }, { threshold: 0.5 });
        obs.observe(el);
        return () => obs.disconnect();
    }, [target, duration, started]);

    return { count, ref };
}

function StatNum({ stat }: { stat: typeof STATS[0] }) {
    const { count, ref } = useCountUp(stat.num);
    return (
        <span ref={ref} className="text-5xl font-black text-emerald-400 font-outfit leading-none">
            {stat.prefix}{stat.num % 1 !== 0 ? count.toFixed(1) : count}{stat.suffix}
        </span>
    );
}

export default function PitchPage() {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 40);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className="bg-[#020817] text-white font-sans overflow-x-hidden">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&display=swap');
                .font-outfit { font-family: 'Outfit', sans-serif; }
                .grid-bg {
                    background-image: linear-gradient(rgba(16,185,129,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.04) 1px, transparent 1px);
                    background-size: 60px 60px;
                    mask-image: radial-gradient(ellipse 80% 80% at 50% 0%, black 0%, transparent 80%);
                }
                .card-hover { transition: transform 0.3s, border-color 0.3s; }
                .card-hover:hover { transform: translateY(-6px); border-color: rgba(16,185,129,0.4) !important; }
            `}</style>

            {/* NAV */}
            <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#020817]/90 backdrop-blur-xl border-b border-emerald-500/10 shadow-2xl' : 'bg-transparent'}`}>
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <Link href="/" className="font-outfit font-black text-lg tracking-tight">VEXEL <span className="text-emerald-400">Innovations</span></Link>
                    <div className="hidden md:flex items-center gap-8">
                        <a href="#problem" className="text-xs font-bold text-slate-400 hover:text-emerald-400 uppercase tracking-widest transition-colors">Problem</a>
                        <a href="#solution" className="text-xs font-bold text-slate-400 hover:text-emerald-400 uppercase tracking-widest transition-colors">Solution</a>
                        <a href="#tech" className="text-xs font-bold text-slate-400 hover:text-emerald-400 uppercase tracking-widest transition-colors">Technology</a>
                        <a href="https://pts-vexel.vercel.app" target="_blank" className="bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs px-5 py-2.5 rounded-xl uppercase tracking-widest transition-all hover:scale-105 shadow-lg shadow-emerald-500/20">Live Demo</a>
                    </div>
                </div>
            </nav>

            {/* HERO */}
            <section className="min-h-screen flex flex-col items-center justify-center text-center px-6 pt-24 pb-20 relative overflow-hidden">
                <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(16,185,129,0.08) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(59,130,246,0.05) 0%, transparent 60%), linear-gradient(180deg, #020817 0%, #0a1628 100%)' }}></div>
                <div className="absolute inset-0 grid-bg"></div>

                <div className="relative z-10 max-w-5xl mx-auto">
                    <div className="inline-flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-5 py-2 text-xs font-bold text-emerald-400 uppercase tracking-widest mb-8 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                        🇳🇬 Nigeria&apos;s National Device Registry
                    </div>

                    <h1 className="font-outfit font-black text-[clamp(52px,10vw,110px)] leading-[0.9] tracking-[-4px] mb-8">
                        <span className="text-slate-400">Securing</span><br />
                        <span className="text-emerald-400">Nigeria&apos;s</span><br />
                        <span className="text-white">Digital Economy</span>
                    </h1>

                    <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                        The <strong className="text-white">Police Tracking System (PTS)</strong> is a sovereign, AI-powered device ownership registry that renders stolen mobile devices permanently worthless — protecting citizens, businesses, and the national economy.
                    </p>

                    <div className="flex gap-4 justify-center flex-wrap">
                        <a href="https://pts-vexel.vercel.app" target="_blank" className="bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm px-9 py-4 rounded-2xl uppercase tracking-widest transition-all hover:-translate-y-1 shadow-[0_0_40px_rgba(16,185,129,0.3)] hover:shadow-[0_0_60px_rgba(16,185,129,0.4)]">
                            🚀 View Live System
                        </a>
                        <a href="#problem" className="bg-white/5 border border-white/15 hover:bg-white/10 text-white font-bold text-sm px-9 py-4 rounded-2xl uppercase tracking-widest transition-all hover:-translate-y-1">
                            Learn the Problem →
                        </a>
                    </div>

                    {/* Stats */}
                    <div className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-px border border-white/10 rounded-3xl overflow-hidden">
                        {STATS.map((stat, i) => (
                            <div key={i} className="bg-slate-900/40 backdrop-blur-sm p-8 text-center">
                                <StatNum stat={stat} />
                                <div className="text-xs text-slate-500 uppercase tracking-widest mt-3 font-semibold leading-snug">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* PROBLEM */}
            <section id="problem" className="bg-[#04101f] py-32 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="mb-16">
                        <div className="text-xs font-bold text-red-400 uppercase tracking-[0.2em] mb-4">⚠ The Challenge</div>
                        <h2 className="font-outfit font-black text-[clamp(36px,5vw,64px)] leading-[1] tracking-[-2px] mb-6">Nigeria Has a<br />Device Crime <span className="text-red-500">Crisis</span></h2>
                        <p className="text-xl text-slate-400 max-w-xl leading-relaxed">Mobile phone theft is one of the fastest-growing economic crimes in Nigeria — and there is currently no national system to stop it.</p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            { num: '₦2.1B+', title: 'Annual Economic Loss', desc: 'Nigeria loses over ₦2.1 billion annually to mobile device theft and resale fraud, draining consumer purchasing power and corporate investments.' },
                            { num: '91%', title: 'Stolen Devices Resold', desc: 'Over 9 in 10 stolen phones are resold within 72 hours through unregulated secondary markets — with zero traceability or accountability.' },
                            { num: '0', title: 'National Registry Exists', desc: 'Nigeria has no centralized system for law enforcement to verify ownership, track stolen goods, or prosecute secondary market crimes.' },
                        ].map((item, i) => (
                            <div key={i} className="relative bg-white/[0.02] border border-white/[0.07] hover:border-red-500/30 rounded-3xl p-9 transition-all duration-300 group overflow-hidden">
                                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="font-outfit font-black text-6xl text-red-500 leading-none mb-4">{item.num}</div>
                                <div className="font-bold text-lg mb-3">{item.title}</div>
                                <div className="text-sm text-slate-500 leading-relaxed">{item.desc}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* SOLUTION */}
            <section id="solution" className="py-32 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="mb-16">
                        <div className="text-xs font-bold text-emerald-400 uppercase tracking-[0.2em] mb-4">✅ The Solution</div>
                        <h2 className="font-outfit font-black text-[clamp(36px,5vw,64px)] leading-[1] tracking-[-2px] mb-6">One Registry.<br />Every Stakeholder <span className="text-emerald-400">Protected.</span></h2>
                        <p className="text-xl text-slate-400 max-w-xl leading-relaxed">PTS is a unified ecosystem connecting consumers, vendors, police, and governments in a single verifiable network.</p>
                    </div>
                    <div className="grid md:grid-cols-2 gap-8 items-start">
                        <div className="flex flex-col gap-4">
                            {PORTALS.map((p, i) => (
                                <div key={i} className="card-hover flex items-center gap-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 cursor-default">
                                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: p.bg }}>
                                        {p.icon}
                                    </div>
                                    <div>
                                        <div className="font-bold text-base mb-1" style={{ color: p.color }}>{p.title}</div>
                                        <div className="text-sm text-slate-500 leading-relaxed">{p.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 relative overflow-hidden">
                            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-emerald-500 via-blue-500 to-emerald-500"></div>
                            <div className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-6">Core Capabilities</div>
                            <div className="flex flex-col gap-6">
                                {[
                                    ['🔒', 'Cryptographic Ownership Chain', 'Every device transfer is permanently hashed and verified through a tamper-proof digital ledger.'],
                                    ['🤖', 'Sentinel AI Risk Engine', 'Gemini-powered AI analyzes device history, receipt authenticity, and hardware tampering.'],
                                    ['🌍', 'National Surveillance Map', 'Real-time geospatial visualization of stolen device pings and police deployment zones.'],
                                    ['📱', 'Public QR Verification', 'Anyone can scan to instantly verify a device\'s registry status before purchase.'],
                                    ['⚡', 'National Kill-Switch', 'Law enforcement permanently flags devices — blacklisted from all vendor networks nationwide.'],
                                ].map(([icon, title, desc], i) => (
                                    <div key={i} className="flex gap-4 items-start">
                                        <span className="text-2xl">{icon}</span>
                                        <div>
                                            <div className="font-bold text-sm mb-1">{title}</div>
                                            <div className="text-xs text-slate-500 leading-relaxed">{desc}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* HOW IT WORKS */}
            <section id="how" className="bg-gradient-to-b from-[#020817] to-[#04101f] py-32 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <div className="text-xs font-bold text-emerald-400 uppercase tracking-[0.2em] mb-4">⚙ The Process</div>
                        <h2 className="font-outfit font-black text-[clamp(36px,5vw,64px)] leading-[1] tracking-[-2px] mb-6">From Purchase<br />to <span className="text-emerald-400">Protection</span></h2>
                    </div>
                    <div className="grid md:grid-cols-4 gap-6 relative">
                        <div className="absolute top-10 left-[15%] right-[15%] h-px bg-gradient-to-r from-transparent via-emerald-500 to-transparent hidden md:block"></div>
                        {STEPS.map((step, i) => (
                            <div key={i} className="card-hover bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center relative">
                                <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-full flex items-center justify-center font-outfit font-black text-xl text-black mx-auto mb-6 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                                    {step.num}
                                </div>
                                <div className="font-bold text-base mb-3">{step.title}</div>
                                <div className="text-sm text-slate-500 leading-relaxed">{step.desc}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* IMPACT METRICS */}
            <section className="py-32 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <div className="text-xs font-bold text-emerald-400 uppercase tracking-[0.2em] mb-4">📊 Projected Impact</div>
                        <h2 className="font-outfit font-black text-[clamp(36px,5vw,64px)] leading-[1] tracking-[-2px]">What <span className="text-emerald-400">PTS Delivers</span><br />at National Scale</h2>
                    </div>
                    <div className="grid md:grid-cols-4 gap-6">
                        {[
                            { num: '73%', label: 'Projected reduction in device resale crime within 18 months of national rollout' },
                            { num: '15M+', label: 'Nigerian smartphone users immediately benefiting from registry protection' },
                            { num: '<3s', label: 'Time to verify a device\'s legitimacy through public QR scan' },
                            { num: '100%', label: 'Chain of custody documented from factory registration to current owner' },
                        ].map((m, i) => (
                            <div key={i} className="card-hover relative bg-slate-900 border border-slate-800 rounded-3xl p-9 overflow-hidden">
                                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 to-transparent"></div>
                                <div className="font-outfit font-black text-5xl text-emerald-400 leading-none mb-4">{m.num}</div>
                                <div className="text-sm text-slate-400 leading-relaxed">{m.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* QUOTE */}
            <div className="bg-gradient-to-br from-emerald-500/5 to-blue-500/5 border-t border-b border-emerald-500/10 py-24 px-6">
                <div className="max-w-3xl mx-auto text-center">
                    <div className="font-outfit font-bold text-[clamp(20px,3vw,34px)] leading-snug mb-8 text-white">
                        &quot;PTS doesn&apos;t just track stolen phones — it <span className="text-emerald-400">eliminates the economics of phone theft</span> entirely. When stolen devices cannot be sold, they lose all criminal value.&quot;
                    </div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">— Vexel Innovations Foundation Document, 2026</div>
                </div>
            </div>

            {/* TECH */}
            <section id="tech" className="py-32 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="mb-16">
                        <div className="text-xs font-bold text-emerald-400 uppercase tracking-[0.2em] mb-4">🛠 Technology</div>
                        <h2 className="font-outfit font-black text-[clamp(36px,5vw,64px)] leading-[1] tracking-[-2px] mb-6">Enterprise-Grade<br /><span className="text-emerald-400">Architecture</span></h2>
                        <p className="text-xl text-slate-400 max-w-xl leading-relaxed">Built for scale, security, and sovereign deployment across all 36 Nigerian states and the FCT.</p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-6">
                        {TECH.map((t, i) => (
                            <div key={i} className="card-hover bg-slate-900 border border-slate-800 rounded-2xl p-7">
                                <div className="text-3xl mb-4">{t.icon}</div>
                                <div className="font-bold text-base mb-2">{t.name}</div>
                                <div className="text-sm text-slate-500 leading-relaxed">{t.desc}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ROADMAP */}
            <section className="bg-[#04101f] py-32 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="mb-16">
                        <div className="text-xs font-bold text-emerald-400 uppercase tracking-[0.2em] mb-4">🗓 Roadmap</div>
                        <h2 className="font-outfit font-black text-[clamp(36px,5vw,64px)] leading-[1] tracking-[-2px]">From Pilot to<br /><span className="text-emerald-400">National Standard</span></h2>
                    </div>
                    <div className="flex flex-col gap-0 border border-slate-800 rounded-3xl overflow-hidden">
                        {ROADMAP.map((r, i) => (
                            <div key={i} className={`flex gap-6 items-start p-8 ${i < ROADMAP.length - 1 ? 'border-b border-slate-800' : ''} hover:bg-white/[0.02] transition-colors`}>
                                <span className="flex-shrink-0 text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-wider mt-1" style={{ background: r.color, color: r.textColor }}>{r.phase}</span>
                                <div>
                                    <div className="font-bold text-lg mb-2">{r.title}</div>
                                    <div className="text-sm text-slate-500 leading-relaxed mb-4">{r.desc}</div>
                                    <div className="flex flex-wrap gap-2">
                                        {r.tags.map((tag, j) => (
                                            <span key={j} className="bg-white/5 border border-slate-700 rounded-lg px-3 py-1 text-xs text-slate-400">{tag}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section id="contact" className="py-32 px-6 relative overflow-hidden bg-slate-900">
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[radial-gradient(circle,rgba(16,185,129,0.15),transparent_70%)] pointer-events-none"></div>
                <div className="max-w-3xl mx-auto text-center relative z-10">
                    <div className="text-xs font-bold text-emerald-400 uppercase tracking-[0.2em] mb-6">📬 Partner With Us</div>
                    <h2 className="font-outfit font-black text-[clamp(40px,6vw,80px)] leading-[0.9] tracking-[-3px] mb-6">
                        Ready to <span className="text-emerald-400">Secure</span><br />Nigeria Together?
                    </h2>
                    <p className="text-xl text-slate-400 mb-10 leading-relaxed">
                        We are seeking partnerships with government agencies, law enforcement bodies, telecom operators, and private investors to scale PTS to national deployment.
                    </p>
                    <div className="flex gap-4 justify-center flex-wrap mb-16">
                        <a href="https://pts-vexel.vercel.app" target="_blank" className="bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm px-9 py-4 rounded-2xl uppercase tracking-widest transition-all hover:-translate-y-1 shadow-[0_0_40px_rgba(16,185,129,0.3)]">
                            🌐 Explore Live Platform
                        </a>
                        <a href="mailto:usamaado36@gmail.com" className="bg-white/5 border border-white/15 hover:bg-white/10 text-white font-bold text-sm px-9 py-4 rounded-2xl uppercase tracking-widest transition-all hover:-translate-y-1">
                            📧 Contact Us
                        </a>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-px border border-white/10 rounded-3xl overflow-hidden">
                        {[
                            { label: 'Organization', value: 'Vexel Innovations' },
                            { label: 'Email', value: 'usamaado36@gmail.com' },
                            { label: 'Platform', value: 'pts-vexel.vercel.app' },
                            { label: 'Year', value: '2026 — 🇳🇬' },
                        ].map((c, i) => (
                            <div key={i} className="bg-slate-950/50 py-6 px-4">
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">{c.label}</div>
                                <div className="text-sm font-semibold text-white">{c.value}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="bg-[#020817] border-t border-white/[0.06] px-6 py-8 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="font-outfit font-black text-base">VEXEL <span className="text-emerald-400">Innovations</span></div>
                <div className="text-xs text-slate-500">© 2026 Vexel Innovations — Police Tracking System (PTS). Proprietary & Confidential.</div>
                <div className="text-sm text-slate-400">🇳🇬 Made in Nigeria</div>
            </footer>
        </div>
    );
}
