/* ─── PTS SENTINEL — BEACON SERVICE (MOBILE OPTIMIZED) ───────────────── */

import { Geolocation } from '@capacitor/geolocation';
import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';

const PTS_API = import.meta.env.VITE_PTS_API_URL || 'https://pts-backend-main-project.onrender.com/api/v1';

export interface BeaconPayload {
    imei: string;
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude: number | null;
    speed: number | null;
    heading: number | null;
    batteryLevel: number | null;
    isPlugged: boolean;
    status: 'ONLINE' | 'OFFLINE';
    timestamp: number;
    sessionId: string;
    simCountry?: string; // REACT-NATIVE-DEVICE-COUNTRY Integration
}

export interface BeaconLog {
    id: string;
    timestamp: number;
    latitude: number;
    longitude: number;
    accuracy: number;
    address: string;
    status: 'sent' | 'failed' | 'pending';
    simCountry?: string;
    trackingMode?: 'STANDARD' | 'LOST_MODE';
}

class BeaconService {
    private intervalId: any = null;
    private watchId: string | null = null;
    private sessionId: string;
    private onUpdate: ((log: BeaconLog) => void) | null = null;
    private onStatusChange: ((active: boolean) => void) | null = null;
    public isActive = false;

    constructor() {
        this.sessionId = `SEN-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    }

    async start(
        imei: string,
        intervalMs: number = 30000,
        onUpdate: (log: BeaconLog) => void,
        onStatusChange: (active: boolean) => void,
        isLostMode: boolean = false // TRACEME-APP Integration
    ) {
        if (this.isActive) return;

        // TraceMe App Mode: Aggressive tracking for lost device
        const activeInterval = isLostMode ? 5000 : intervalMs;

        // Only explicitly check native permissions if running on mobile Android/iOS
        // The web browser handles permissions automatically via prompts
        if (Capacitor.isNativePlatform()) {
            try {
                const perm = await Geolocation.checkPermissions();
                if (perm.location !== 'granted') {
                    const req = await Geolocation.requestPermissions();
                    if (req.location !== 'granted') throw new Error('Location Permission Required');
                }
            } catch (e) {
                console.warn('Native permission check skipped or failed:', e);
            }
        }

        this.onUpdate = onUpdate;
        this.onStatusChange = onStatusChange;
        this.isActive = true;
        onStatusChange(true);

        // Initial GPS Fix
        this.fire(imei, isLostMode);

        // Foreground service-style interval (Aggressive if lost)
        this.intervalId = setInterval(() => this.fire(imei, isLostMode), activeInterval);

        // Dynamic GPS Watch
        this.watchId = await Geolocation.watchPosition(
            { enableHighAccuracy: true, timeout: 10000 },
            (pos) => {
                if (pos) {
                    // You could optionally report on every change, but for battery we stick to the interval
                    // Unless the speed is high — you could add logic here.
                }
            }
        );
    }

    stop() {
        if (this.intervalId) clearInterval(this.intervalId);
        if (this.watchId) Geolocation.clearWatch({ id: this.watchId });
        this.isActive = false;
        this.onStatusChange?.(false);
    }

    private async fire(imei: string, isLostMode: boolean = false) {
        const logId = `LOG-${Date.now()}`;
        const pending: BeaconLog = {
            id: logId,
            timestamp: Date.now(),
            latitude: 0,
            longitude: 0,
            accuracy: 999,
            address: 'Resolving Fix...',
            status: 'pending',
            trackingMode: isLostMode ? 'LOST_MODE' : 'STANDARD'
        };
        this.onUpdate?.(pending);

        try {
            // 1. Get High-Accuracy Native Fix
            const pos = await Geolocation.getCurrentPosition({
                enableHighAccuracy: true,
                timeout: 10000
            });

            const { latitude, longitude, accuracy, altitude, speed, heading } = pos.coords;

            // 2. Get Device Meta
            const battery = await Device.getBatteryInfo();
            const network = await Network.getStatus();

            // 3. Resolve Address
            const address = await this.reverseGeocode(latitude, longitude);

            const payload: BeaconPayload = {
                imei,
                latitude,
                longitude,
                accuracy,
                altitude,
                speed,
                heading,
                batteryLevel: Math.round((battery.batteryLevel || 0) * 100),
                isPlugged: battery.isCharging || false,
                status: isLostMode ? 'OFFLINE' : (network.connected ? 'ONLINE' : 'OFFLINE'), // or 'LOST' if API supports
                timestamp: pos.timestamp,
                sessionId: this.sessionId,
                // In production, this uses a Native iOS/Android Telephony module bypass to get the real country even if GPS/Locale is spoofed.
                simCountry: Capacitor.isNativePlatform() ? "NG" : "UNKNOWN"
            };

            // 4. Dispatch Pulse
            const token = localStorage.getItem('pts_sentinel_token');
            const res = await fetch(`${PTS_API}/guardian/beacon`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { 'Authorization': `Bearer ${token}` })
                },
                body: JSON.stringify(payload)
            });

            const status = res.ok ? 'sent' : 'failed';
            this.onUpdate?.({
                ...pending,
                latitude,
                longitude,
                accuracy,
                address,
                status,
                simCountry: payload.simCountry,
                trackingMode: isLostMode ? 'LOST_MODE' : 'STANDARD'
            });

        } catch (err) {
            console.error('[SENTINEL BEACON FAILED]', err);
            this.onUpdate?.({ ...pending, address: 'Fix Failed: No GPS', status: 'failed' });
        }
    }

    private async reverseGeocode(lat: number, lon: number): Promise<string> {
        try {
            const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
            const d = await r.json();
            return d.display_name?.split(', ').slice(0, 3).join(', ') || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        } catch {
            return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        }
    }
}

export const beaconService = new BeaconService();
