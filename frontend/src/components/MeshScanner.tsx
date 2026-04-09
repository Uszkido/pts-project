'use client';
import { useState, useEffect } from 'react';

// In a real Capacitor build, you would import:
// import { BleClient } from '@capacitor-community/bluetooth-le';

export default function MeshScanner({ observerId, onClose }: { observerId: string, onClose: () => void }) {
    const [isScanning, setIsScanning] = useState(false);
    const [detectedNodes, setDetectedNodes] = useState<any[]>([]);
    const [scanLog, setScanLog] = useState<string[]>(['Initializing Guardian Protocol...', 'Awaiting Uplink...']);

    // Simulated BLE Scanner for Web/Dev Preview
    useEffect(() => {
        if (!isScanning) return;

        const addLog = (msg: string) => setScanLog(prev => [msg, ...prev].slice(0, 10));

        addLog('BLE Hardware Interface Active. Sweeping local area...');

        const scanInterval = setInterval(() => {
            // Simulate finding a random BLE node
            const mockSignals = [-45, -60, -75, -85];
            const randomSignal = mockSignals[Math.floor(Math.random() * mockSignals.length)];
            const randomMac = 'XX:XX:XX:' + Math.random().toString(16).substr(2, 6).toUpperCase();

            // Randomly simulate finding a stolen device to trigger the API
            const isTarget = Math.random() > 0.85;
            const mockImei = isTarget ? '112233445566778' : null;

            const newNode = {
                id: Math.random().toString(),
                mac: randomMac,
                signal: randomSignal,
                time: new Date().toLocaleTimeString(),
                isTarget,
                imei: mockImei
            };

            setDetectedNodes(prev => [newNode, ...prev].slice(0, 5));
            addLog(`Detected footprint [${randomMac}] at ${randomSignal}dBm`);

            if (isTarget) {
                addLog('⚠️ CRITICAL MATCH: Known Stolen Signature Detected! Uploading telemetry...');
                triggerGuardianPing(mockImei, randomSignal);
            }

        }, 1200);

        return () => {
            clearInterval(scanInterval);
            addLog('BLE Interface Powered Down.');
        };
    }, [isScanning]);

    // Send the telemetry to our Node.js Backend
    const triggerGuardianPing = async (imei: string | null, signalStrength: number) => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://pts-backend-api.vercel.app/api/v1';

            // Simulating a GPS location fetch
            const latitude = 6.5244 + (Math.random() * 0.01);
            const longitude = 3.3792 + (Math.random() * 0.01);

            await fetch(`${apiUrl}/guardian/report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    deviceImei: imei,
                    latitude,
                    longitude,
                    signalType: 'BT',
                    signalStrength: signalStrength.toString(),
                    observerId: observerId || 'NODE-ADMIN-1'
                })
            });

            setScanLog(prev => ['🟢 TELEMETRY UPLOADED: Central Command alerted.', ...prev]);
        } catch (err) {
            console.error(err);
            setScanLog(prev => ['🔴 TELEMETRY FAILED: No connection to Command.', ...prev]);
        }
    };

    return (
        <div className="fixed inset-0 z-[110] bg-slate-950/98 backdrop-blur-3xl flex flex-col font-sans">
            <header className="p-6 border-b border-slate-800/80 flex justify-between items-center bg-slate-900/30">
                <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-500 ${isScanning ? 'bg-emerald-600 shadow-emerald-500/20 animate-pulse' : 'bg-slate-800'}`}>
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tighter uppercase">Guardian Mesh Radar</h2>
                        <div className="flex items-center gap-2">
                            <span className={`text-xs font-mono font-bold uppercase tracking-widest ${isScanning ? 'text-emerald-500' : 'text-slate-500'}`}>
                                {isScanning ? 'Active Sub-Surface Scan' : 'Radar Standby'}
                            </span>
                        </div>
                    </div>
                </div>
                <button onClick={onClose} className="p-3 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-all">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </header>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 overflow-hidden">
                {/* Visual Radar Screen */}
                <div className="lg:col-span-2 relative flex items-center justify-center border-r border-slate-800/50 overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950">

                    {/* The Sonar/Radar Animation */}
                    <div className="relative flex justify-center items-center w-[400px] h-[400px]">
                        <div className="absolute inset-0 rounded-full border border-slate-800/50"></div>
                        <div className="absolute inset-10 rounded-full border border-slate-800/50"></div>
                        <div className="absolute inset-20 rounded-full border border-slate-800/50"></div>
                        <div className="absolute inset-32 rounded-full border border-slate-800/50"></div>

                        {/* Radar Sweep */}
                        <div className={`absolute top-0 w-1/2 h-1/2 origin-bottom-right transition-all duration-[1200ms] ${isScanning ? 'bg-gradient-to-r from-transparent to-emerald-500/20 animate-spin' : 'hidden'}`} style={{ animationDuration: '1.2s' }}>
                            <div className="absolute right-0 top-0 bottom-0 w-px bg-emerald-500/50 shadow-[0_0_15px_#10b981]"></div>
                        </div>

                        {/* Center Node */}
                        <div className="absolute w-4 h-4 bg-emerald-500 rounded-full shadow-[0_0_20px_#10b981]"></div>

                        {/* Render Detected Nodes */}
                        {detectedNodes.map((node, i) => {
                            // Calculate random position on the radar based on signal strength (closer = stronger)
                            const distance = Math.max(10, 200 - (Math.abs(node.signal) * 2));
                            const angle = Math.random() * 360;
                            const x = Math.cos(angle) * distance;
                            const y = Math.sin(angle) * distance;

                            return (
                                <div
                                    key={node.id}
                                    className={`absolute w-3 h-3 rounded-full animate-ping ${node.isTarget ? 'bg-red-500 shadow-[0_0_15px_#ef4444]' : 'bg-emerald-400 opacity-50'}`}
                                    style={{ transform: `translate(${x}px, ${y}px)` }}
                                ></div>
                            );
                        })}
                    </div>

                    <div className="absolute bottom-8 left-8 right-8 text-center text-[10px] font-mono text-slate-500 uppercase tracking-widest leading-loose">
                        Scanning IEEE 802.15.1 Physical Layer • AES-256 Encrypted Pings <br />
                        Node ID: {Math.random().toString(16).substr(2, 8).toUpperCase()}
                    </div>
                </div>

                {/* Right Panel: Intelligence Log */}
                <div className="lg:col-span-1 p-6 flex flex-col bg-slate-900/20">
                    <button
                        onClick={() => setIsScanning(!isScanning)}
                        className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-sm transition-all border shadow-2xl flex justify-center items-center gap-3 ${isScanning ? 'bg-rose-600/10 text-rose-500 border-rose-500/20 hover:bg-rose-600/20' : 'bg-emerald-600 shadow-emerald-600/20 border-emerald-500 text-white hover:bg-emerald-500'}`}
                    >
                        {isScanning ? (
                            <><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg> Terminate Scan</>
                        ) : (
                            <><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> Initiate Guardian Radar</>
                        )}
                    </button>

                    <div className="mt-8">
                        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Live Threat Stream</h3>
                        <div className="space-y-3">
                            {detectedNodes.map(node => (
                                <div key={node.id} className={`p-4 rounded-xl border ${node.isTarget ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-900/50 border-slate-800'}`}>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className={`text-[10px] font-black uppercase ${node.isTarget ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}>
                                            {node.isTarget ? '⚠️ STOLEN SIGNATURE MATCH' : 'Untracked Hardware'}
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-mono">{node.time}</span>
                                    </div>
                                    <div className="text-xs text-white font-mono tracking-wider">{node.mac}</div>
                                    <div className="text-[10px] text-slate-500 mt-2 font-mono flex items-center justify-between">
                                        <span>Proximity Strength</span>
                                        <span className={node.signal > -50 ? 'text-emerald-400' : 'text-amber-400'}>{node.signal} dBm</span>
                                    </div>
                                    {node.isTarget && (
                                        <div className="mt-3 pt-3 border-t border-red-500/20 text-[10px] text-red-400 uppercase tracking-widest">
                                            Telemetry dispatched to Central Registry
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-auto pt-8">
                        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Command Terminal</h3>
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 h-48 overflow-y-auto font-mono text-[10px] leading-relaxed">
                            {scanLog.map((log, i) => (
                                <div key={i} className={`mb-1 ${log.includes('CRITICAL') || log.includes('FAILED') ? 'text-red-400' : log.includes('TELEMETRY') ? 'text-emerald-400' : 'text-slate-500'}`}>
                                    <span className="opacity-50 mr-2">{'>'}</span> {log}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
