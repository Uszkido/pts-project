'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import './sentinel.css';
import { trackLocation } from '@/lib/ptsGeolocation';

// --- Types ---
interface BeaconLog {
    id: string;
    timestamp: number;
    latitude: number;
    longitude: number;
    accuracy: number;
    address: string;
    status: 'sent' | 'failed' | 'pending';
}

// --- Radar Component ---
function RadarScreen({ active, pings }: { active: boolean; pings: number }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animRef = useRef<number>(0);
    const sweepAngle = useRef(0);
    const blips = useRef<{ x: number; y: number; age: number; intensity: number }[]>([]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;

        const resize = () => {
            canvas.width = canvas.offsetWidth * window.devicePixelRatio;
            canvas.height = canvas.offsetHeight * window.devicePixelRatio;
            ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        };
        resize();

        const draw = () => {
            const W = canvas.offsetWidth; const H = canvas.offsetHeight;
            const cx = W / 2; const cy = H / 2; const R = Math.min(cx, cy) - 12;

            ctx.fillStyle = 'rgba(0, 8, 16, 0.85)';
            ctx.fillRect(0, 0, W, H);

            for (let i = 1; i <= 4; i++) {
                ctx.beginPath(); ctx.arc(cx, cy, (R * i) / 4, 0, Math.PI * 2);
                ctx.strokeStyle = active ? 'rgba(0, 240, 255, 0.1)' : 'rgba(60, 80, 100, 0.15)';
                ctx.lineWidth = 1; ctx.stroke();
            }

            ctx.strokeStyle = active ? 'rgba(0, 240, 255, 0.12)' : 'rgba(60, 80, 100, 0.12)';
            ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();

            if (active) {
                sweepAngle.current = (sweepAngle.current + 0.025) % (Math.PI * 2);
                const grad = ctx.createLinearGradient(cx, cy - R, cx, cy + R);
                grad.addColorStop(0, 'rgba(0, 240, 255, 0)'); grad.addColorStop(1, 'rgba(0, 240, 255, 0.08)');

                ctx.save(); ctx.translate(cx, cy); ctx.rotate(sweepAngle.current);
                const sweepGrad = ctx.createLinearGradient(-R, 0, R * 0.1, 0);
                sweepGrad.addColorStop(0, 'rgba(0, 240, 255, 0)'); sweepGrad.addColorStop(1, 'rgba(0, 240, 255, 0.28)');
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, -1.2, 0); ctx.fillStyle = sweepGrad; ctx.fill();
                ctx.restore();

                ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(sweepAngle.current) * R, cy + Math.sin(sweepAngle.current) * R);
                ctx.strokeStyle = 'rgba(0, 240, 255, 0.9)'; ctx.lineWidth = 1.5; ctx.stroke();

                if (Math.random() < 0.015) blips.current.push({ x: cx + Math.cos(sweepAngle.current + 0.1) * (0.5 * R), y: cy + Math.sin(sweepAngle.current + 0.1) * (0.5 * R), age: 0, intensity: 0.8 });
            }

            blips.current = blips.current.filter(b => {
                b.age += 0.008; const alpha = Math.max(0, b.intensity * (1 - b.age));
                if (alpha <= 0) return false;
                ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); ctx.fillStyle = `rgba(0, 240, 255, ${alpha})`; ctx.fill();
                return true;
            });

            ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fillStyle = active ? '#00f0ff' : '#334155'; ctx.fill();
            ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.strokeStyle = active ? 'rgba(0, 240, 255, 0.4)' : 'rgba(30, 40, 60, 0.6)'; ctx.stroke();

            animRef.current = requestAnimationFrame(draw);
        };

        animRef.current = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(animRef.current);
    }, [active]);

    return (
        <div style={{ position: 'relative', width: '100%', aspectRatio: '1', maxWidth: 280, margin: '0 auto' }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
            <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', fontFamily: 'var(--font-mono)', fontSize: 11, color: active ? 'rgba(0,240,255,0.7)' : 'rgba(100,120,140,0.5)', letterSpacing: '0.15em', whiteSpace: 'nowrap' }}>
                {active ? `${pings} PULSES TX` : 'OFFLINE'}
            </div>
        </div>
    );
}

// --- Main App ---
export default function SentinelWeb() {
    const [screen, setScreen] = useState<'setup' | 'active'>(() => typeof window !== 'undefined' && localStorage.getItem('pts_imei') ? 'active' : 'setup');
    const [imei, setImei] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('pts_imei') || '' : '');
    const [intervalMs, setIntervalMs] = useState(30000);
    const [logs, setLogs] = useState<BeaconLog[]>([]);
    const [pingCount, setPingCount] = useState(0);
    const [isActive, setIsActive] = useState(false);
    const [uptime, setUptime] = useState(0);
    const [locked, setLocked] = useState(false);

    const timerRef = useRef<any>(null);

    // Stop Beacon
    const stopBeacon = useCallback(() => {
        setIsActive(false);
        if (timerRef.current) clearInterval(timerRef.current);
    }, []);

    // Transmit 
    const fireBeacon = useCallback(async (currentImei: string) => {
        const logId = `LOG-${Date.now()}`;
        const pending: BeaconLog = { id: logId, timestamp: Date.now(), latitude: 0, longitude: 0, accuracy: 999, address: 'Resolving Fix...', status: 'pending' };
        setLogs(p => [...p, pending].slice(-50));

        try {
            const pos = await trackLocation();
            const payload = {
                imei: currentImei,
                latitude: pos.latitude, longitude: pos.longitude, accuracy: pos.accuracy,
                speed: pos.speed, heading: pos.heading, altitude: null, batteryLevel: null,
                sessionId: `WEB-${Date.now()}`
            };

            const token = localStorage.getItem('token') || '';
            const res = await fetch('/api/v1/guardian/beacon', {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            setLogs(p => p.map(l => l.id === logId ? {
                ...l, latitude: pos.latitude, longitude: pos.longitude, accuracy: pos.accuracy,
                address: data.address || `${pos.latitude.toFixed(4)}, ${pos.longitude.toFixed(4)}`,
                status: res.ok ? 'sent' : 'failed'
            } : l));

            if (res.ok) setPingCount(c => c + 1);

        } catch (err) {
            setLogs(p => p.map(l => l.id === logId ? { ...l, status: 'failed', address: 'GPS Blocked or Failed' } : l));
        }
    }, []);

    // Start Beacon
    const startBeacon = useCallback((deviceImei: string, ms: number) => {
        setImei(deviceImei);
        setIntervalMs(ms);
        setScreen('active');
        setIsActive(true);
        setUptime(0);

        fireBeacon(deviceImei);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => fireBeacon(deviceImei), ms);
    }, [fireBeacon]);

    useEffect(() => {
        if (!isActive) return;
        const t = setInterval(() => setUptime(u => u + 1), 1000);
        return () => clearInterval(t);
    }, [isActive]);

    const latest = logs.findLast(l => l.status === 'sent') ?? null;
    const fM = Math.floor(uptime / 60).toString().padStart(2, '0');
    const fS = (uptime % 60).toString().padStart(2, '0');

    return (
        <div className="sentinel-root">
            <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(rgba(0,0,0,0) 0, rgba(0,0,0,0) 1px, rgba(0,240,255,0.02) 1px, rgba(0,240,255,0.02) 2px)', pointerEvents: 'none', zIndex: 0 }} />

            {screen === 'setup' ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 1, padding: 20 }}>
                    <div style={{ textAlign: 'center', marginBottom: 30 }}>
                        <div style={{ width: 70, height: 70, margin: '0 auto 16px', background: 'rgba(0, 240, 255, 0.05)', border: '1px solid rgba(0, 240, 255, 0.2)', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>🛰️</div>
                        <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 24, color: 'var(--col-primary)', letterSpacing: '0.15em', margin: 0 }}>PTS SENTINEL</h1>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--col-muted)', letterSpacing: '0.2em' }}>WEB-UPLINK TERMINAL</p>
                    </div>

                    <div style={{ width: '100%', maxWidth: 340, background: 'var(--col-card)', border: '1px solid var(--col-border)', borderRadius: 20, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div>
                            <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--col-muted)', letterSpacing: '0.15em', marginBottom: 8 }}>TARGET DEVICE IMEI</label>
                            <input type="number" maxLength={15} value={imei} onChange={e => setImei(e.target.value)} placeholder="15-Digit IMEI" style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid var(--col-border)', borderRadius: 10, color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 13, outline: 'none' }} />
                        </div>
                        <button onClick={() => { if (imei.length >= 14) { localStorage.setItem('pts_imei', imei); startBeacon(imei, 30000); } }} style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #00b8c8, #0a84ff)', border: 'none', borderRadius: 12, color: '#000', fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 13, letterSpacing: '0.2em', cursor: 'pointer', marginTop: 8 }}>ACTIVATE WEB PULSE</button>
                    </div>
                </div>
            ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', zIndex: 1, overflow: 'hidden' }}>

                    <div style={{ padding: '24px 20px 0', display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto', flex: 1 }}>
                        <RadarScreen active={isActive} pings={pingCount} />

                        <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--col-muted)', background: 'rgba(255,255,255,0.02)', padding: '4px 10px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.05)' }}>IMEI: <span style={{ color: 'var(--col-primary)' }}>{imei}</span></div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            {[
                                { label: 'LAT', val: latest?.latitude.toFixed(5) || '0.00000' },
                                { label: 'LON', val: latest?.longitude.toFixed(5) || '0.00000' },
                                { label: 'ACC', val: latest ? `±${latest.accuracy.toFixed(0)}m` : 'SEARCHING' },
                                { label: 'SESS', val: `UP ${fM}:${fS}` }
                            ].map(s => (
                                <div key={s.label} style={{ background: 'rgba(10, 18, 32, 0.4)', border: '1px solid var(--col-border)', padding: '12px', borderRadius: 12 }}>
                                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--col-muted)', letterSpacing: '0.1em', marginBottom: 4 }}>{s.label}</div>
                                    <div style={{ fontFamily: 'var(--font-head)', fontSize: 14, fontWeight: 700 }}>{s.val}</div>
                                </div>
                            ))}
                        </div>

                        {latest?.address && (
                            <div style={{ background: 'rgba(0, 240, 255, 0.04)', borderLeft: '2px solid var(--col-primary)', padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, animation: 'slide-up 0.3s ease-out' }}>
                                <span style={{ display: 'block', fontSize: 9, color: 'var(--col-muted)', marginBottom: 4, letterSpacing: '0.1em' }}>CURRENT ADDRESS</span>
                                {latest.address}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 12, marginTop: 'auto', paddingBottom: 20 }}>
                            {isActive ? (
                                <button onClick={stopBeacon} style={{ flex: 1, padding: 14, background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.3)', borderRadius: 14, color: 'var(--col-danger)', fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 11, cursor: 'pointer', letterSpacing: '0.1em' }}>⬛ SUSPEND</button>
                            ) : (
                                <button onClick={() => startBeacon(imei, 30000)} style={{ flex: 1, padding: 14, background: 'rgba(48,209,88,0.1)', border: '1px solid rgba(48,209,88,0.3)', borderRadius: 14, color: 'var(--col-success)', fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 11, cursor: 'pointer', letterSpacing: '0.1em' }}>▶ RESUME</button>
                            )}
                            <button onClick={() => setLocked(true)} style={{ flex: 1, padding: 14, background: 'var(--col-surface)', border: '1px solid var(--col-border)', borderRadius: 14, color: 'var(--col-text)', fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 11, cursor: 'pointer', letterSpacing: '0.1em' }}>🔒 STEALTH MODE</button>
                        </div>
                    </div>
                </div>
            )}

            {locked && (
                <div onClick={() => setLocked(false)} style={{ position: 'absolute', inset: 0, zIndex: 1000, backgroundColor: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                    <div style={{ width: 100, height: 100, borderRadius: '50%', border: '2px dashed var(--col-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'radar-spin 10s linear infinite' }}>
                        <div style={{ width: 10, height: 10, background: 'var(--col-primary)', borderRadius: '50%', animation: 'blink 2s infinite' }} />
                    </div>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--col-dim)', letterSpacing: '0.2em' }}>SCANNING BACKGROUND (WEB)</p>
                    <p style={{ position: 'fixed', bottom: 40, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.05)' }}>TAP ANYWHERE TO UNLOCK</p>
                </div>
            )}
        </div>
    );
}
