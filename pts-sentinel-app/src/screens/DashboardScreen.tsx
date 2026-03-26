/* ─── DASHBOARD — SENTINEL HUB (HUD UI) ─────────────────────────────────── */

import React, { useState, useEffect } from 'react';
import RadarScreen from '../components/RadarScreen';
import BeaconFeed from '../components/BeaconFeed';
import type { BeaconLog } from '../services/beaconService';

interface Props {
    imei: string;
    intervalMs: number;
    logs: BeaconLog[];
    pingCount: number;
    isActive: boolean;
    onStop: () => void;
    onRestart: () => void;
}

function formatCoord(n: number) { return n === 0 ? '---' : n.toFixed(5); }

export default function DashboardScreen({ imei, intervalMs, logs, pingCount, isActive, onStop, onRestart }: Props) {
    const latest = logs.findLast(l => l.status === 'sent') ?? null;
    const [uptime, setUptime] = useState(0);
    const [showFeed, setShowFeed] = useState(false);
    const [isLocked, setIsLocked] = useState(false);

    useEffect(() => {
        if (!isActive) return;
        const start = Date.now();
        const t = setInterval(() => setUptime(Math.floor((Date.now() - start) / 1000)), 1000);
        return () => clearInterval(t);
    }, [isActive]);

    const formatUptime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    };

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

            {/* ─── RADAR HUD LAYER ─── */}
            <div style={{
                padding: '24px 20px 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 20
            }}>
                {/* Radar Visualizer — HUD Centerpiece */}
                <RadarScreen active={isActive} pings={pingCount} />

                {/* HUD Data Tags */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                    <div style={tagStyle}>IMEI: <span style={{ color: 'var(--col-primary)' }}>{imei}</span></div>
                    <div style={tagStyle}>SYNC: <span style={{ color: 'var(--col-primary)' }}>{intervalMs / 1000}s</span></div>
                </div>

                {/* Stat Cards Grid — The Core HUD Stats */}
                {!showFeed && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <StatHUD label="LAT" value={latest ? formatCoord(latest.latitude) : '0.00000'} />
                        <StatHUD label="LON" value={latest ? formatCoord(latest.longitude) : '0.00000'} />
                        <StatHUD label="ACC" value={latest ? `±${latest.accuracy.toFixed(0)}m` : 'SEARCHING'} />
                        <StatHUD label="SESS" value={`UP ${formatUptime(uptime)}`} />
                    </div>
                )}

                {/* Address & Status Feed HUD */}
                {latest?.address && !showFeed && (
                    <div style={{
                        background: 'rgba(0, 240, 255, 0.04)',
                        borderLeft: '2px solid var(--col-primary)',
                        padding: '12px 16px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
                        color: 'var(--col-text)',
                        animation: 'slide-up 0.3s ease-out'
                    }}>
                        <span style={{ display: 'block', fontSize: 9, color: 'var(--col-muted)', marginBottom: 4, letterSpacing: '0.1em' }}>CURRENT TELEMETRY ADDRESS</span>
                        {latest.address}
                    </div>
                )}

                {/* Main Control Panel HUD */}
                {!showFeed && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', gap: 12 }}>
                            {isActive ? (
                                <button onClick={onStop} style={hudBtnStyle('var(--col-danger)', true)}>⬛ TERMINATE BEACON</button>
                            ) : (
                                <button onClick={onRestart} style={hudBtnStyle('var(--col-success)', true)}>▶ ACTIVATE BEACON</button>
                            )}
                        </div>
                        <button
                            onClick={() => setShowFeed(true)}
                            style={hudBtnStyle('var(--col-dim)', false)}
                        >
                            📜 ACCESS LOG CRYPTO-FEED
                        </button>
                    </div>
                )}
            </div>

            {/* ─── FULLFEED SUB-SCREEN ─── */}
            {showFeed && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'scale-up 0.2s ease-out' }}>
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--col-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <button
                            onClick={() => setShowFeed(false)}
                            style={{ background: 'none', border: 'none', color: 'var(--col-primary)', fontFamily: 'var(--font-mono)', fontSize: 13, cursor: 'pointer', letterSpacing: '0.1em' }}
                        >
                            ← BACK TO RADAR
                        </button>
                    </div>
                    <BeaconFeed logs={logs} />
                </div>
            )}

            {/* ─── STEALTH LOCK OVERLAY ─── */}
            {isLocked && (
                <div
                    onClick={() => setIsLocked(false)}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 1000,
                        backgroundColor: '#000',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 20
                    }}
                >
                    <div style={{
                        width: 100,
                        height: 100,
                        borderRadius: '50%',
                        border: '2px dashed var(--col-dim)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        animation: 'radar-spin 10s linear infinite'
                    }}>
                        <div style={{ width: 10, height: 10, background: 'var(--col-primary)', borderRadius: '50%', animation: 'blink 2s infinite' }} />
                    </div>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--col-dim)', letterSpacing: '0.2em' }}>STEALTH SCAN ACTIVE</p>
                    <p style={{ position: 'fixed', bottom: 40, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.05)' }}>TAP TO UNLOCK HUD</p>
                </div>
            )}

            {/* Floating Stealth Lock Button */}
            {!showFeed && !isLocked && (
                <button
                    onClick={() => setIsLocked(true)}
                    style={{
                        position: 'fixed', bottom: 84, right: 24,
                        width: 52, height: 52, borderRadius: '50%',
                        background: 'rgba(0,0,0,0.8)', border: '1px solid var(--col-border)',
                        color: 'var(--col-text)', fontSize: 20, zIndex: 100,
                        boxShadow: '0 8px 16px rgba(0,0,0,0.5)',
                        display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center'
                    }}
                >
                    🔒
                </button>
            )}

        </div>
    );
}

function StatHUD({ label, value }: { label: string; value: string }) {
    return (
        <div style={{
            background: 'rgba(10, 18, 32, 0.4)',
            border: '1px solid var(--col-border)',
            padding: '12px',
            borderRadius: 12,
            textAlign: 'left'
        }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--col-muted)', letterSpacing: '0.1em', marginBottom: 4 }}>{label}</div>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: 14, fontWeight: 700, color: 'var(--col-text)', letterSpacing: '0.05em' }}>{value}</div>
        </div>
    );
}

const tagStyle: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    color: 'var(--col-muted)',
    background: 'rgba(255,255,255,0.02)',
    padding: '4px 10px',
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.05)',
};

function hudBtnStyle(color: string, accent: boolean): React.CSSProperties {
    return {
        flex: 1,
        padding: '16px 12px',
        background: accent ? `${color}18` : 'var(--col-surface)',
        border: `1px solid ${accent ? `${color}40` : 'var(--col-border)'}`,
        borderRadius: 18,
        color: accent ? color : 'var(--col-text)',
        fontFamily: 'var(--font-head)',
        fontSize: 11,
        letterSpacing: '0.15em',
        fontWeight: 800,
        cursor: 'pointer',
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    };
}
