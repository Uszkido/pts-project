/* ─── SETUP SCREEN — Device Registration ─────────────────────────────────── */

import { useState } from 'react';

interface Props {
    onActivate: (imei: string, token: string, intervalMs: number) => void;
}

/** Luhn algorithm check — standard IMEI validity test */
function isValidImei(imei: string): boolean {
    if (!/^\d{15}$/.test(imei)) return false;
    let sum = 0;
    for (let i = 0; i < 15; i++) {
        let digit = parseInt(imei[i], 10);
        if (i % 2 === 1) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
    }
    return sum % 10 === 0;
}

export default function SetupScreen({ onActivate }: Props) {
    const [imei, setImei]         = useState(localStorage.getItem('pts_imei') || '');
    const [token, setToken]       = useState(localStorage.getItem('pts_sentinel_token') || '');
    const [intervalSec, setIntervalSec] = useState(30);
    const [error, setError]       = useState('');

    const handleImeiChange = (value: string) => {
        // Strip non-digits as the user types
        setImei(value.replace(/\D/g, '').slice(0, 15));
        setError('');
    };

    const handleActivate = () => {
        const trimmed = imei.trim();
        if (trimmed.length !== 15) {
            setError('IMEI must be exactly 15 digits. Dial *#06# to find yours.');
            return;
        }
        if (!isValidImei(trimmed)) {
            setError('Invalid IMEI — checksum failed. Please double-check the number.');
            return;
        }
        localStorage.setItem('pts_imei', trimmed);
        localStorage.setItem('pts_sentinel_token', token.trim());
        onActivate(trimmed, token.trim(), intervalSec * 1000);
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
            {/* Brand */}
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <div style={{
                    width: 72, height: 72,
                    margin: '0 auto 16px',
                    borderRadius: 18,
                    background: 'rgba(0, 240, 255, 0.06)',
                    border: '1px solid rgba(0, 240, 255, 0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
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

            {/* Form Card */}
            <div style={{
                width: '100%', maxWidth: 360,
                background: 'var(--col-card)',
                border: '1px solid var(--col-border)',
                borderRadius: 20,
                padding: 20,
                display: 'flex', flexDirection: 'column', gap: 16,
            }}>
                {/* IMEI Field */}
                <div>
                    <label style={labelStyle}>Device IMEI *</label>
                    <input
                        type="tel"
                        inputMode="numeric"
                        placeholder="Enter 15-digit IMEI"
                        value={imei}
                        onChange={e => handleImeiChange(e.target.value)}
                        style={{
                            ...inputStyle,
                            borderColor: error ? 'rgba(255, 59, 48, 0.5)' : undefined,
                        }}
                        maxLength={15}
                        aria-label="Device IMEI number"
                    />
                    <p style={hintStyle}>
                        Dial <strong>*#06#</strong> on your phone to find your IMEI
                    </p>
                </div>

                {/* Token Field */}
                <div>
                    <label style={labelStyle}>PTS Auth Token <span style={{ opacity: 0.5 }}>(optional)</span></label>
                    <input
                        type="password"
                        placeholder="••••••••••••"
                        value={token}
                        onChange={e => setToken(e.target.value)}
                        style={inputStyle}
                        aria-label="PTS authentication token"
                        autoComplete="current-password"
                    />
                    <p style={hintStyle}>
                        Get your token at <span style={{ color: 'var(--col-primary)' }}>pts-vexel.vercel.app</span>
                    </p>
                </div>

                {/* Interval Slider */}
                <div>
                    <label style={labelStyle}>Beacon Interval: {intervalSec}s</label>
                    <input
                        type="range"
                        min={10} max={120} step={10}
                        value={intervalSec}
                        onChange={e => setIntervalSec(Number(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--col-primary)', marginTop: 6 }}
                        aria-label={`Beacon interval: ${intervalSec} seconds`}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', ...hintStyle, marginTop: 4 }}>
                        <span>10s — High frequency</span>
                        <span>120s — Battery saver</span>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div role="alert" style={{
                        padding: '10px 12px',
                        background: 'rgba(255, 59, 48, 0.1)',
                        border: '1px solid rgba(255, 59, 48, 0.3)',
                        borderRadius: 10,
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        color: 'var(--col-danger)',
                        lineHeight: 1.5,
                    }}>
                        {error}
                    </div>
                )}

                {/* Submit */}
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
                This device will broadcast its GPS location to the PTS National Registry.
                Location data is only accessible to authorised law enforcement.
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
    textTransform: 'uppercase',
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
    boxSizing: 'border-box',
};

const hintStyle: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    color: 'var(--col-muted)',
    marginTop: 4,
};
