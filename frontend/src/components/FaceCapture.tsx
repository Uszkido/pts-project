'use client';
import { useState, useRef, useEffect } from 'react';

interface FaceCaptureProps {
    onCapture: (file: File) => void;
    label?: string;
}

export default function FaceCapture({ onCapture, label = "Facial Data (Live Capture)" }: FaceCaptureProps) {
    const [isStreaming, setIsStreaming] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const startCamera = async () => {
        try {
            if (!navigator?.mediaDevices?.getUserMedia) {
                throw new Error("Camera API is not supported in this browser, or you are not on a secure HTTPS connection.");
            }
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setIsStreaming(true);
            }
        } catch (err: any) {
            console.error("Error accessing camera:", err);
            let errorMessage = "Could not access camera. Please ensure you have given permission.";

            // Helpful message for local network testing without HTTPS
            if (err.name === 'NotAllowedError' || err.message.includes('permission denied')) {
                errorMessage = "Camera access denied. Please allow permissions in your browser settings.";
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                errorMessage = "No camera found on this device.";
            } else if (!window.isSecureContext) {
                errorMessage = "Camera access requires a secure connection (HTTPS) or localhost. If you are testing on a local network (e.g. 192.168.x.x), the browser will block the camera.";
            }

            alert(errorMessage);
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
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
                const dataUrl = canvas.toDataURL('image/jpeg');
                setCapturedImage(dataUrl);

                // Convert to file
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
        startCamera();
    };

    useEffect(() => {
        return () => stopCamera();
    }, []);

    return (
        <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>

            <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-slate-700 shadow-inner">
                {!isStreaming && !capturedImage && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
                        <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-500">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </div>
                        <button
                            type="button"
                            onClick={startCamera}
                            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
                        >
                            Start Camera
                        </button>
                    </div>
                )}

                {isStreaming && (
                    <>
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            className="w-full h-full object-cover mirror"
                            style={{ transform: 'scaleX(-1)' }}
                        />
                        <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                            <button
                                type="button"
                                onClick={capturePhoto}
                                className="w-14 h-14 rounded-full bg-white border-4 border-slate-300 shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
                            >
                                <div className="w-10 h-10 rounded-full bg-red-500 animate-pulse"></div>
                            </button>
                        </div>
                    </>
                )}

                {capturedImage && (
                    <div className="relative w-full h-full">
                        <img src={capturedImage} alt="Captured face" className="w-full h-full object-cover" />
                        <div className="absolute top-2 right-2">
                            <button
                                type="button"
                                onClick={resetCapture}
                                className="bg-slate-900/80 hover:bg-slate-950 text-white p-2 rounded-lg backdrop-blur-sm transition-colors border border-white/10"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            </button>
                        </div>
                        <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-emerald-500/90 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            Identity Captured
                        </div>
                    </div>
                )}

                <canvas ref={canvasRef} className="hidden" />
            </div>

            <p className="text-[10px] text-slate-500 text-center font-medium">Capture should be clear with neutral expression.</p>
        </div>
    );
}
