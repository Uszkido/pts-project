/* ─── RADAR SCREEN — Live Scanning Visualizer ──────────────────────────── */

import { useEffect, useRef } from 'react';

interface RadarProps {
    active: boolean;
    pings: number; // number of successful pings
}

export default function RadarScreen({ active, pings }: RadarProps) {
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
        window.addEventListener('resize', resize);

        const draw = () => {
            const W = canvas.offsetWidth;
            const H = canvas.offsetHeight;
            const cx = W / 2;
            const cy = H / 2;
            const R = Math.min(cx, cy) - 12;

            // Dark clear
            ctx.fillStyle = 'rgba(0, 8, 16, 0.85)';
            ctx.fillRect(0, 0, W, H);

            // Grid rings
            for (let i = 1; i <= 4; i++) {
                ctx.beginPath();
                ctx.arc(cx, cy, (R * i) / 4, 0, Math.PI * 2);
                ctx.strokeStyle = active ? 'rgba(0, 240, 255, 0.1)' : 'rgba(60, 80, 100, 0.15)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            // Cross hairs
            ctx.strokeStyle = active ? 'rgba(0, 240, 255, 0.12)' : 'rgba(60, 80, 100, 0.12)';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();

            if (active) {
                // Sweep gradient trail
                sweepAngle.current = (sweepAngle.current + 0.025) % (Math.PI * 2);

                // Fallback for browsers without conical gradient support
                const grad = ctx.createLinearGradient(cx, cy - R, cx, cy + R);
                grad.addColorStop(0, 'rgba(0, 240, 255, 0)');
                grad.addColorStop(1, 'rgba(0, 240, 255, 0.08)');

                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(sweepAngle.current);
                const sweepGrad = ctx.createLinearGradient(-R, 0, R * 0.1, 0);
                sweepGrad.addColorStop(0, 'rgba(0, 240, 255, 0)');
                sweepGrad.addColorStop(0.7, 'rgba(0, 240, 255, 0.04)');
                sweepGrad.addColorStop(1, 'rgba(0, 240, 255, 0.28)');
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.arc(0, 0, R, -1.2, 0);
                ctx.fillStyle = sweepGrad;
                ctx.fill();
                ctx.restore();

                // Sweep line
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx + Math.cos(sweepAngle.current) * R, cy + Math.sin(sweepAngle.current) * R);
                ctx.strokeStyle = 'rgba(0, 240, 255, 0.9)';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                // Spawn new blip when sweep passes ~random points
                if (Math.random() < 0.015) {
                    const angle = sweepAngle.current + (Math.random() - 0.5) * 0.3;
                    const dist = (0.35 + Math.random() * 0.55) * R;
                    blips.current.push({
                        x: cx + Math.cos(angle) * dist,
                        y: cy + Math.sin(angle) * dist,
                        age: 0,
                        intensity: 0.6 + Math.random() * 0.4
                    });
                }
            }

            // Draw and age blips
            blips.current = blips.current.filter(b => {
                b.age += 0.008;
                const alpha = Math.max(0, b.intensity * (1 - b.age));
                if (alpha <= 0) return false;

                ctx.beginPath();
                ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(0, 240, 255, ${alpha})`;
                ctx.fill();

                // Glow
                ctx.beginPath();
                ctx.arc(b.x, b.y, 7, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(0, 240, 255, ${alpha * 0.2})`;
                ctx.fill();
                return true;
            });

            // Centre dot
            ctx.beginPath();
            ctx.arc(cx, cy, 4, 0, Math.PI * 2);
            ctx.fillStyle = active ? '#00f0ff' : '#334155';
            ctx.fill();

            // Outer border ring
            ctx.beginPath();
            ctx.arc(cx, cy, R, 0, Math.PI * 2);
            ctx.strokeStyle = active ? 'rgba(0, 240, 255, 0.4)' : 'rgba(30, 40, 60, 0.6)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            animRef.current = requestAnimationFrame(draw);
        };

        animRef.current = requestAnimationFrame(draw);
        return () => {
            cancelAnimationFrame(animRef.current);
            window.removeEventListener('resize', resize);
        };
    }, [active]);

    return (
        <div style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '1',
            maxWidth: 280,
            margin: '0 auto',
        }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
            {/* Ping counter overlay */}
            <div style={{
                position: 'absolute',
                bottom: 10,
                left: '50%',
                transform: 'translateX(-50%)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: active ? 'rgba(0,240,255,0.7)' : 'rgba(100,120,140,0.5)',
                letterSpacing: '0.15em',
                whiteSpace: 'nowrap'
            }}>
                {active ? `${pings} SIGNALS SENT` : 'OFFLINE'}
            </div>
        </div>
    );
}
