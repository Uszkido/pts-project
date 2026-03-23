'use client';

import { useEffect, useRef } from 'react';
import { BleClient, ScanResult } from '@capacitor-community/bluetooth-le';

const GUARDIAN_SERVICE_UUID = '54ab2f30-010e-436d-9781-807d4b29bb80'; // The unique 128-bit UUID for PTS tracking

/**
 * ECHELON II: Guardian Mesh Network Passive Scanning Hook
 * This silently runs on Police and Verified Merchant devices, continually scanning 
 * for the secret BLE signatures broadcasted by newly stolen devices.
 */
export function useGuardianMesh(enabled: boolean = true) {
    const isScanning = useRef(false);

    useEffect(() => {
        if (!enabled || typeof window === 'undefined') return;

        let scanInterval: NodeJS.Timeout;

        const initializeMeshNode = async () => {
            try {
                // Request BLE hardware state
                await BleClient.initialize({ androidNeverForLocation: false });
                console.log('[GUARDIAN MESH] Node Initialized. Hardware Access Granted.');

                // Begin the persistent passive sweeping operation (every 10 seconds for battery health)
                scanInterval = setInterval(async () => {
                    if (isScanning.current) return;
                    isScanning.current = true;

                    try {
                        console.log('[GUARDIAN MESH] Sweeping radio frequencies for stolen signatures...');

                        // Execute a 5-second aggressive ping
                        // In high-risk areas like Computer Village, this intercepts hundreds of MAC addresses
                        const results: ScanResult[] = [];

                        await BleClient.requestLEScan(
                            { services: [GUARDIAN_SERVICE_UUID] },
                            (result) => {
                                results.push(result);
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

    /**
     * Secretly blasts the telemetry to the Central PTS Server if a hit is verified.
     */
    const handleIntercept = async (target: ScanResult) => {
        if (!target.device.deviceId) return;

        // In production, the BLE packet's manufacturer data contains the encrypted IMEI/Owner ID.
        // For Echelon II Beta, we capture the MAC/Device ID and dBm Signal
        const payload = {
            deviceImei: 'MESH-DETECTED', // Simulated payload for the beta
            latitude: 6.5244,            // Requires `@capacitor/geolocation` (Simulated Lagos)
            longitude: 3.3792,
            signalType: 'BT',
            signalStrength: target.rssi.toString(),
            observerId: 'POLICE-HQ-NODE-' + Math.floor(Math.random() * 1000)
        };

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const response = await fetch(`${apiUrl}/guardian/report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('pts_token') || 'BETA_KEY'}`
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                console.log(`[GUARDIAN STRIKE] Silent tracking beacon dispatched for ${target.device.deviceId}`);
            }
        } catch (err) {
            console.error('[GUARDIAN DISCONNECT] Target captured, but uplink to PTS Registry failed:', err);
        }
    };
}
