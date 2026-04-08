'use client';
import { useState, useRef, useEffect } from 'react';

interface FaceCaptureProps {
    onCapture: (file: File) => void;
    label?: string;
}

export default function FaceCapture({ onCapture, label = "Facial Data (Live Capture)" }: FaceCaptureProps) {
    const [isStreaming, setIsStreaming] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const startCamera = async () => {
        setCameraError(null);
        try {
            if (!navigator?.mediaDevices?.getUserMedia) {
                throw new Error("Camera API is not supported in this browser, or you are not on a secure HTTPS connection.");
            }
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setIsStreaming(true);
            }
        } catch (err: any) {
            let errorMessage = "Could not access camera. Please ensure you have given permission.";
            if (err.name === 'NotAllowedError' || err.message?.includes('permission denied')) {
                errorMessage = "Camera access denied. Please allow camera permissions in your browser settings and try again.";
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                errorMessage = "No camera found on this device.";
            } else if (!window.isSecureContext) {
                errorMessage = "Camera requires a secure (HTTPS) connection or localhost.";
            }
            setCameraError(errorMessage);
        }
    };

    const stopCamera = () => {
        if (videoRef.current?.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            setIsStreaming(false);
        }
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            if (context) {
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
                setCapturedImage(dataUrl);
                fetch(dataUrl)
                    .then(res => res.blob())
                    .then(blob => {
                        const file = new File([blob], "facial_capture.jpg", { type: "image/jpeg" });
                        onCapture(file);
                    });
                stopCamera();
            }
        }
    };

    const resetCapture = () => {
        setCapturedImage(null);
        setCameraError(null);
        startCamera();
    };

    useEffect(() => { return () => stopCamera(); }, []);

    return (
        <div className="space-y-3">
            <label className="block text-sm font-bold text-slate-200 mb-1">{label}</label>

            {/* Camera Container — large and prominent */}
            <div className="relative w-full bg-black rounded-2xl overflow-hidden border-2 border-slate-700 shadow-2xl"
                style={{ minHeight: '380px' }}>

                {/* IDLE STATE */}
                {!isStreaming && !capturedImage && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-slate-900 to-slate-950">
                        {/* Face silhouette guide */}
                        <div className="relative w-32 h-40 rounded-full border-4 border-dashed border-blue-500/40 flex items-center justify-center">
                            <svg className="w-16 h-16 text-slate-600" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                            </svg>
                            <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-blue-500 rounded-tl-lg" />
                            <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-blue-500 rounded-tr-lg" />
                            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-blue-500 rounded-bl-lg" />
                            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-blue-500 rounded-br-lg" />
                        </div>
                        <div className="text-center">
                            <p className="text-slate-300 text-sm font-semibold mb-1">Face Verification Required</p>
                            <p className="text-slate-500 text-xs">Position your face clearly within the frame</p>
                        </div>
                        {cameraError && (
                            <div className="mx-6 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 text-center max-w-xs">
                                {cameraError}
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={startCamera}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold px-8 py-3.5 rounded-2xl transition-all shadow-xl shadow-blue-500/30 text-sm"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                            </svg>
                            Open Camera
                        </button>
                    </div>
                )}

                {/* LIVE VIDEO STREAM */}
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${isStreaming && !capturedImage ? '' : 'hidden'}`}
                    style={{ transform: 'scaleX(-1)', minHeight: '380px' }}
                />

                {/* Face guide overlay when streaming */}
                {isStreaming && !capturedImage && (
                    <>
                        {/* Corner brackets overlay */}
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            <div className="relative w-48 h-56 opacity-70">
                                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-400 rounded-tl-xl" />
                                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-400 rounded-tr-xl" />
                                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-400 rounded-bl-xl" />
                                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-400 rounded-br-xl" />
                            </div>
                        </div>
                        {/* Instruction bar */}
                        <div className="absolute top-3 left-0 right-0 flex justify-center">
                            <div className="bg-slate-900/80 backdrop-blur-sm text-xs text-blue-300 px-4 py-1.5 rounded-full border border-blue-500/30 font-semibold">
                                🔵 Center your face in the frame
                            </div>
                        </div>
                        {/* Capture button */}
                        <div className="absolute bottom-6 left-0 right-0 flex justify-center">
                            <button
                                type="button"
                                onClick={capturePhoto}
                                className="w-20 h-20 rounded-full bg-white/10 border-4 border-white backdrop-blur-sm shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all group"
                            >
                                <div className="w-14 h-14 rounded-full bg-white group-hover:bg-blue-100 transition-colors flex items-center justify-center">
                                    <svg className="w-7 h-7 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </div>
                            </button>
                        </div>
                    </>
                )}

                {/* CAPTURED STATE */}
                {capturedImage && (
                    <div className="relative w-full h-full" style={{ minHeight: '380px' }}>
                        <img src={capturedImage} alt="Captured face" className="w-full h-full object-cover" style={{ minHeight: '380px' }} />
                        {/* Dark overlay at bottom */}
                        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
                        {/* Success badge */}
                        <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-emerald-500/90 backdrop-blur-sm text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            Identity Captured
                        </div>
                        {/* Retake button */}
                        <button
                            type="button"
                            onClick={resetCapture}
                            className="absolute bottom-4 right-4 flex items-center gap-1.5 bg-slate-900/80 hover:bg-slate-950 backdrop-blur-sm text-white px-4 py-2 rounded-xl border border-white/10 transition-colors text-xs font-bold"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            Retake
                        </button>
                    </div>
                )}

                <canvas ref={canvasRef} className="hidden" />
            </div>

            <p className="text-[11px] text-slate-500 text-center font-medium">
                📷 Ensure good lighting · Neutral expression · No glasses · Face directly to camera
            </p>
        </div>
    );
}
