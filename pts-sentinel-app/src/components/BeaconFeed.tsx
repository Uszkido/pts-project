/* ─── BEACON LOG FEED ───────────────────────────────────────────────────── */

import type { BeaconLog } from '../services/beaconService';

interface Props {
    logs: BeaconLog[];
}

function timeAgo(ts: number): string {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 5) return 'just now';
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    return `${Math.floor(s / 3600)}h ago`;
}

export default function BeaconFeed({ logs }: Props) {
    const reversed = [...logs].reverse().slice(0, 50);

    return (
        <div style={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
        }}>
            <div style={{
                padding: '8px 16px',
                borderBottom: '1px solid var(--col-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
            }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--col-muted)', letterSpacing: '0.15em' }}>
                    BEACON TRANSMISSION LOG
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--col-primary)', letterSpacing: '0.1em' }}>
                    {logs.length} PINGS
                </span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
                {reversed.length === 0 ? (
                    <div style={{
                        padding: 24,
                        textAlign: 'center',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        color: 'var(--col-muted)',
                        letterSpacing: '0.1em',
                    }}>
                        AWAITING FIRST BEACON...
                    </div>
                ) : (
                    reversed.map((log) => (
                        <LogRow key={log.id} log={log} />
                    ))
                )}
            </div>
        </div>
    );
}

function LogRow({ log }: { log: BeaconLog }) {
    const statusColor = log.status === 'sent' ? 'var(--col-success)'
        : log.status === 'failed' ? 'var(--col-danger)'
            : 'var(--col-warning)';

    const statusLabel = log.status === 'sent' ? '● TX' : log.status === 'failed' ? '✕ ERR' : '◌ ...';

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 16px',
            borderBottom: '1px solid rgba(26, 40, 64, 0.5)',
            animation: 'slide-up 0.25s ease-out',
        }}>
            <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: statusColor,
                minWidth: 36,
                letterSpacing: '0.05em',
            }}>
                {statusLabel}
            </span>

            <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--col-text)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                }}>
                    {log.address}
                </div>
                <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: 'var(--col-muted)',
                    marginTop: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                }}>
                    <span>{log.latitude.toFixed(5)}, {log.longitude.toFixed(5)} · ±{log.accuracy.toFixed(0)}m</span>
                    {log.trackingMode === 'LOST_MODE' && (
                        <span style={{
                            padding: '1px 4px',
                            background: 'rgba(255, 0, 85, 0.15)',
                            color: '#ff0055',
                            borderRadius: 2,
                            fontSize: 9,
                            fontWeight: 'bold'
                        }}>
                            ⚡ LOST MODE
                        </span>
                    )}
                    {log.simCountry && (
                        <span style={{
                            padding: '1px 4px',
                            background: 'rgba(0, 240, 255, 0.1)',
                            color: 'var(--col-primary)',
                            borderRadius: 2,
                            fontSize: 9,
                        }}>
                            SIM: {log.simCountry}
                        </span>
                    )}
                </div>
            </div>

            <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--col-muted)',
                flexShrink: 0,
            }}>
                {timeAgo(log.timestamp)}
            </span>
        </div>
    );
}
