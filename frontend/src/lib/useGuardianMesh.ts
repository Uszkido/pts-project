'use client';

import { useEffect, useRef } from 'react';
import { BleClient, ScanResult } from '@capacitor-community/bluetooth-le';

const GUARDIAN_SERVICE_UUID = '54ab2f30-010e-436d-9781-807d4b29bb80'; // The unique 128-bit UUID for PTS tracking

/**
 * ECHELON II: Guardian Mesh Network Passive Scanning Hook
 * Silently runs on Police and Verified Merchant devices, continually scanning
 * for the secret BLE signatures broadcasted by newly stolen devices.
 * Now uses Web Geolocation API (enableHighAccuracy: true) for 5-10 m GPS accuracy
 * instead of hardcoded stub coordinates.
 */
export function useGuardianMesh(enabled: boolean = true) {
    const isScanning = useRef(false);

    /**
     * Acquires a live high-accuracy GPS fix for the observing node device.
     * Uses Fused Location (GPS + Wi-Fi) via enableHighAccuracy: true.
     * Falls back to null if location permission is denied — intercept still fires.
     */
    const getLivePosition = (): Promise<{ latitude: number; longitude: number; accuracy: number } | null> => {
        return new Promise((resolve) => {
            if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                    accuracy: pos.coords.accuracy  // ~5-10 m with GPS/Wi-Fi fusion
                }),
                () => resolve(null), // graceful fallback — don't block the beacon dispatch
                {
                    enableHighAccuracy: true, // Forces GPS hardware + Wi-Fi positioning
                    timeout: 8000,
                    maximumAge: 30000         // Allow 30s cached fix to speed up 15s mesh cycles
                }
            );
        });
    };

    /**
     * Dispatches telemetry to the Central PTS Server when a BLE hit is verified.
     * Reports REAL GPS coordinates — replaces the hardcoded Lagos stub.
     */
    const handleIntercept = async (target: ScanResult) => {
        if (!target.device.deviceId) return;

        // Acquire live observer position (Fused GPS/Wi-Fi, 5-10 m accuracy)
        const position = await getLivePosition();

        const payload = {
            deviceImei: 'MESH-DETECTED',
            latitude: position?.latitude ?? null,
            longitude: position?.longitude ?? null,
            locationAccuracyMeters: position?.accuracy ?? null,
            signalType: 'BT',
            signalStrength: (target.rssi || 0).toString(),
            observerId: 'POLICE-NODE-' + Math.floor(Math.random() * 1000)
        };

        if (!payload.latitude) {
            console.warn('[GUARDIAN MESH] Location unavailable for this intercept — reporting without coords.');
        } else {
            console.log(`[GUARDIAN MESH] Live fix acquired: ${payload.latitude.toFixed(5)}, ${payload.longitude!.toFixed(5)} (±${payload.locationAccuracyMeters!.toFixed(0)}m)`);
        }

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://pts-backend-api.vercel.app/api/v1';
            const response = await fetch(`${apiUrl}/guardian/report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('pts_token') || 'BETA_KEY'}`
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                console.log(`[GUARDIAN STRIKE] Beacon dispatched for ${target.device.deviceId}`);
            }
        } catch (err) {
            console.error('[GUARDIAN DISCONNECT] Target captured, but uplink to PTS Registry failed:', err);
        }
    };

    useEffect(() => {
        if (!enabled || typeof window === 'undefined') return;

        let scanInterval: NodeJS.Timeout;

        const initializeMeshNode = async () => {
            try {
                // Feature Detection: Ensure browser supports Web Bluetooth before attempting to initialize
                const isBluetoothSupported = typeof navigator !== 'undefined' && (navigator as any).bluetooth;
                if (!isBluetoothSupported) {
                    console.warn('[GUARDIAN MESH] Web Bluetooth API is not available/supported in this environment.');
                    return;
                }

                await BleClient.initialize({ androidNeverForLocation: false });
                console.log('[GUARDIAN MESH] Node Initialized. Hardware Access Granted.');

                scanInterval = setInterval(async () => {
                    if (isScanning.current) return;
                    isScanning.current = true;

                    try {
                        console.log('[GUARDIAN MESH] Sweeping radio frequencies for stolen signatures...');

                        await BleClient.requestLEScan(
                            { services: [GUARDIAN_SERVICE_UUID] },
                            (result) => {
                                handleIntercept(result);
                            }
                        );

                        // Stop scanning after 5s to conserve Node battery
                        setTimeout(() => {
                            BleClient.stopLEScan();
                            isScanning.current = false;
                        }, 5000);

                    } catch (scanErr) {
                        console.error('[GUARDIAN MESH] Sweep failed:', scanErr);
                        isScanning.current = false;
                    }
                }, 15000); // 15-second cycles

            } catch (initErr) {
                console.warn('[GUARDIAN MESH ERROR] Hardware unavailable. Device might not be native Android/iOS or lacks permissions.');
            }
        };

        initializeMeshNode();

        return () => {
            clearInterval(scanInterval);
            BleClient.stopLEScan().catch(console.error);
        };
    }, [enabled]);
}
