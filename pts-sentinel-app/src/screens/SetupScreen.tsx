/* ─── SETUP SCREEN — Device Registration ─────────────────────────────────*/

import React, { useState } from 'react';

interface Props {
    onActivate: (imei: string, token: string, intervalMs: number) => void;
}

export default function SetupScreen({ onActivate }: Props) {
    const [imei, setImei] = useState(localStorage.getItem('pts_imei') || '');
    const [token, setToken] = useState(localStorage.getItem('pts_sentinel_token') || '');
    const [interval, setInterval] = useState(30);
    const [error, setError] = useState('');

    const handleActivate = () => {
        if (!imei.trim() || imei.trim().length < 14) {
            setError('Enter a valid 15-digit IMEI number');
            return;
        }
        localStorage.setItem('pts_imei', imei.trim());
        localStorage.setItem('pts_sentinel_token', token.trim());
        onActivate(imei.trim(), token.trim(), interval * 1000);
    };

    return (
        <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px 20px',
            gap: 0,
        }}>
            {/* Logo */}
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <div style={{
                    width: 72,
                    height: 72,
                    margin: '0 auto 16px',
                    borderRadius: 18,
                    background: 'rgba(0, 240, 255, 0.06)',
                    border: '1px solid rgba(0, 240, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 32,
                }}>🛰️</div>
                <h1 style={{
                    fontFamily: 'var(--font-head)',
                    fontSize: 22,
                    fontWeight: 900,
                    color: 'var(--col-primary)',
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                }}>PTS SENTINEL</h1>
                <p style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: 'var(--col-muted)',
                    letterSpacing: '0.2em',
                    marginTop: 4,
                }}>NATIONAL DEVICE TRACKING SYSTEM</p>
            </div>

            {/* Form */}
            <div style={{
                width: '100%',
                maxWidth: 360,
                background: 'var(--col-card)',
                border: '1px solid var(--col-border)',
                borderRadius: 20,
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
            }}>
                <div>
                    <label style={labelStyle}>Device IMEI *</label>
                    <input
                        type="number"
                        placeholder="Enter 15-digit IMEI"
                        value={imei}
                        onChange={e => setImei(e.target.value)}
                        style={inputStyle}
                        maxLength={15}
                    />
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--col-muted)', marginTop: 4 }}>
                        Dial *#06# to find your IMEI
                    </p>
                </div>

                <div>
                    <label style={labelStyle}>PTS Auth Token (optional)</label>
                    <input
                        type="password"
                        placeholder="••••••••••••"
                        value={token}
                        onChange={e => setToken(e.target.value)}
                        style={inputStyle}
                    />
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--col-muted)', marginTop: 4 }}>
                        Log in at pts-vexel.vercel.app to get your token
                    </p>
                </div>

                <div>
                    <label style={labelStyle}>Beacon Interval: {interval}s</label>
                    <input
                        type="range"
                        min={10}
                        max={120}
                        step={10}
                        value={interval}
                        onChange={e => setInterval(Number(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--col-primary)', marginTop: 6 }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--col-muted)', marginTop: 2 }}>
                        <span>10s (HIGH FREQ)</span>
                        <span>120s (BATTERY SAVE)</span>
                    </div>
                </div>

                {error && (
                    <div style={{
                        padding: '10px 12px',
                        background: 'rgba(255, 59, 48, 0.1)',
                        border: '1px solid rgba(255, 59, 48, 0.3)',
                        borderRadius: 10,
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        color: 'var(--col-danger)',
                    }}>
                        {error}
                    </div>
                )}

                <button
                    onClick={handleActivate}
                    style={{
                        width: '100%',
                        padding: '14px',
                        background: 'linear-gradient(135deg, #00b8c8, #0a84ff)',
                        border: 'none',
                        borderRadius: 12,
                        color: '#000',
                        fontFamily: 'var(--font-head)',
                        fontWeight: 700,
                        fontSize: 13,
                        letterSpacing: '0.2em',
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                    }}
                >
                    ACTIVATE SENTINEL
                </button>
            </div>

            <p style={{
                marginTop: 20,
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--col-muted)',
                textAlign: 'center',
                letterSpacing: '0.08em',
                lineHeight: 1.6,
                maxWidth: 300,
            }}>
                This device will continuously broadcast its GPS location to the PTS National Registry. Location data is encrypted and only accessible to law enforcement.
            </p>
        </div>
    );
}

const labelStyle: React.CSSProperties = {
    display: 'block',
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    color: 'var(--col-muted)',
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    background: 'rgba(0,0,0,0.5)',
    border: '1px solid var(--col-border)',
    borderRadius: 10,
    color: 'var(--col-text)',
    fontFamily: 'var(--font-mono)',
    fontSize: 13,
    outline: 'none',
};
