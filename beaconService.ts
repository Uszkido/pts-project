/* ─── PTS SENTINEL — Beacon Service ─────────────────────────────────────── */

import { Geolocation } from '@capacitor/geolocation';
import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';

const PTS_API = import.meta.env.VITE_PTS_API_URL || 'https://pts-backend-main-project.onrender.com/api/v1';

// ─── Types ────────────────────────────────────────────────────────────────────

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
    simCountry: string;
    screen_serial: string;
    battery_serial: string;
    logic_board_serial: string;
    camera_serial: string;
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

// ─── Service ──────────────────────────────────────────────────────────────────

class BeaconService {
    private intervalId: ReturnType<typeof setInterval> | null = null;
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
        intervalMs: number = 30_000,
        onUpdate: (log: BeaconLog) => void,
        onStatusChange: (active: boolean) => void,
        isLostMode = false,
    ) {
        if (this.isActive) return;

        // Lost mode uses faster interval for aggressive tracking
        const activeInterval = isLostMode ? 5_000 : intervalMs;

        // On native platforms, request location permission explicitly
        if (Capacitor.isNativePlatform()) {
            try {
                const perm = await Geolocation.checkPermissions();
                if (perm.location !== 'granted') {
                    const req = await Geolocation.requestPermissions();
                    if (req.location !== 'granted') {
                        throw new Error('Location permission is required for beacon service');
                    }
                }
            } catch (e) {
                console.warn('[BEACON] Permission check failed:', e);
            }
        }

        this.onUpdate = onUpdate;
        this.onStatusChange = onStatusChange;
        this.isActive = true;
        onStatusChange(true);

        // Fire immediately, then on interval
        this.fire(imei, isLostMode);
        this.intervalId = setInterval(() => this.fire(imei, isLostMode), activeInterval);

        // GPS watch for high-movement scenarios (future: dynamic reporting)
        this.watchId = await Geolocation.watchPosition(
            { enableHighAccuracy: true, timeout: 10_000 },
            (_pos) => {
                // Reserved for future adaptive-interval logic
            },
        );
    }

    stop() {
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        if (this.watchId !== null) {
            Geolocation.clearWatch({ id: this.watchId });
            this.watchId = null;
        }
        this.isActive = false;
        this.onStatusChange?.(false);
    }

    private async fire(imei: string, isLostMode = false) {
        const logId = `LOG-${Date.now()}`;
        const pending: BeaconLog = {
            id: logId,
            timestamp: Date.now(),
            latitude: 0,
            longitude: 0,
            accuracy: 999,
            address: 'Resolving GPS fix...',
            status: 'pending',
            trackingMode: isLostMode ? 'LOST_MODE' : 'STANDARD',
        };
        this.onUpdate?.(pending);

        try {
            const pos = await Geolocation.getCurrentPosition({
                enableHighAccuracy: true,
                timeout: 10_000,
            });

            const { latitude, longitude, accuracy, altitude, speed, heading } = pos.coords;
            const battery = await Device.getBatteryInfo();
            const network = await Network.getStatus();
            const address = await this.reverseGeocode(latitude, longitude);

            const payload: BeaconPayload = {
                imei,
                latitude,
                longitude,
                accuracy,
                altitude,
                speed,
                heading,
                batteryLevel: battery.batteryLevel != null ? Math.round(battery.batteryLevel * 100) : null,
                isPlugged: battery.isCharging ?? false,
                status: network.connected ? 'ONLINE' : 'OFFLINE',
                timestamp: pos.timestamp,
                sessionId: this.sessionId,
                simCountry: Capacitor.isNativePlatform() ? 'NG' : 'UNKNOWN',
                // Hardware DNA — provisioned via secure native bridge or on-device setup
                screen_serial:    localStorage.getItem('pts_hw_screen')   ?? 'NOT_PROVISIONED',
                battery_serial:   localStorage.getItem('pts_hw_battery')  ?? 'NOT_PROVISIONED',
                logic_board_serial: localStorage.getItem('pts_hw_board')  ?? 'NOT_PROVISIONED',
                camera_serial:    localStorage.getItem('pts_hw_camera')   ?? 'NOT_PROVISIONED',
            };

            const token = localStorage.getItem('pts_sentinel_token');
            const res = await fetch(`${PTS_API}/guardian/beacon`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(payload),
            });

            this.onUpdate?.({
                ...pending,
                latitude,
                longitude,
                accuracy,
                address,
                status: res.ok ? 'sent' : 'failed',
                simCountry: payload.simCountry,
            });

        } catch (err) {
            console.error('[BEACON FIRE FAILED]', err);
            this.onUpdate?.({ ...pending, address: 'GPS fix failed', status: 'failed' });
        }
    }

    private async reverseGeocode(lat: number, lon: number): Promise<string> {
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
                { headers: { 'Accept-Language': 'en' } },
            );
            const data = await res.json();
            return data.display_name?.split(', ').slice(0, 3).join(', ')
                ?? `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        } catch {
            return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        }
    }
}

export const beaconService = new BeaconService();
