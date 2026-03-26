'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
    getHighAccuracyLocation,
    watchHighAccuracyLocation,
    reverseGeocode,
    startSensorFusion,
    isWithinGeofence
} from './ptsGeolocation';

// Well-known high-risk zones in Nigeria (lat, lon, radiusMeters)
const HIGH_RISK_GEOFENCES = [
    { name: 'Computer Village, Ikeja', lat: 6.6018, lon: 3.3515, radius: 500 },
    { name: 'Alaba Int\'l Market, Lagos', lat: 6.4608, lon: 3.2847, radius: 600 },
    { name: 'Onitsha Main Market', lat: 6.1344, lon: 6.7866, radius: 500 },
    { name: 'Ladipo Spare Parts, Lagos', lat: 6.5344, lon: 3.3515, radius: 400 },
];

export interface LocationSnapshot {
    latitude: number;
    longitude: number;
    accuracy: number;  // meters
    altitude: number | null;
    speed: number | null;     // m/s
    heading: number | null;
    address: string;
    timestamp: number;
    isHighRisk: boolean;
    highRiskZone: string | null;
    source: 'GPS' | 'DEAD_RECKONING' | 'FALLBACK';
}

interface MotionState {
    x: number;
    y: number;
    z: number;
}

interface OrientationState {
    alpha: number | null;
    beta: number | null;
    gamma: number | null;
}

/**
 * PTS Unified Location Tracker Hook
 * Combines High Accuracy GPS (Fused Location), Dead Reckoning via motion sensors,
 * Reverse Geocoding, and Geofence detection into a single hook.
 */
export function useLocationTracker(options: {
    enabled?: boolean;
    watchMode?: boolean;  // Continuous tracking vs one-shot
    enableDeadReckoning?: boolean;
    onGeofenceEnter?: (zone: string, location: LocationSnapshot) => void;
    onLocationUpdate?: (location: LocationSnapshot) => void;
} = {}) {
    const {
        enabled = true,
        watchMode = false,
        enableDeadReckoning = true,
        onGeofenceEnter,
        onLocationUpdate
    } = options;

    const [location, setLocation] = useState<LocationSnapshot | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLocating, setIsLocating] = useState(false);

    // Dead reckoning state
    const lastGpsRef = useRef<{ lat: number; lon: number; timestamp: number } | null>(null);
    const motionRef = useRef<MotionState>({ x: 0, y: 0, z: 0 });
    const orientationRef = useRef<OrientationState>({ alpha: null, beta: null, gamma: null });
    const watchIdRef = useRef<number | null>(null);

    const detectGeofence = useCallback((lat: number, lon: number): { isHighRisk: boolean; zoneName: string | null } => {
        for (const fence of HIGH_RISK_GEOFENCES) {
            if (isWithinGeofence(lat, lon, fence.lat, fence.lon, fence.radius)) {
                return { isHighRisk: true, zoneName: fence.name };
            }
        }
        return { isHighRisk: false, zoneName: null };
    }, []);

    const buildSnapshot = useCallback(async (
        pos: GeolocationPosition,
        source: 'GPS' | 'DEAD_RECKONING' | 'FALLBACK' = 'GPS'
    ): Promise<LocationSnapshot> => {
        const { latitude, longitude, accuracy, altitude, speed, heading } = pos.coords;
        const { isHighRisk, zoneName } = detectGeofence(latitude, longitude);

        // Perform reverse geocoding in parallel
        const address = await reverseGeocode(latitude, longitude);

        return {
            latitude,
            longitude,
            accuracy,
            altitude,
            speed,
            heading,
            address,
            timestamp: pos.timestamp,
            isHighRisk,
            highRiskZone: zoneName,
            source
        };
    }, [detectGeofence]);

    const handleNewPosition = useCallback(async (pos: GeolocationPosition, source: 'GPS' | 'DEAD_RECKONING' | 'FALLBACK' = 'GPS') => {
        const snapshot = await buildSnapshot(pos, source);

        setLocation(snapshot);
        lastGpsRef.current = { lat: snapshot.latitude, lon: snapshot.longitude, timestamp: snapshot.timestamp };

        if (snapshot.isHighRisk && onGeofenceEnter) {
            onGeofenceEnter(snapshot.highRiskZone!, snapshot);
        }

        if (onLocationUpdate) {
            onLocationUpdate(snapshot);
        }
    }, [buildSnapshot, onGeofenceEnter, onLocationUpdate]);

    // One-shot location fetch
    const fetchLocation = useCallback(async () => {
        if (!enabled) return;
        setIsLocating(true);
        setError(null);
        try {
            const pos = await getHighAccuracyLocation();
            await handleNewPosition(pos, 'GPS');
        } catch (e: any) {
            setError(e.message || 'Location access denied');
        } finally {
            setIsLocating(false);
        }
    }, [enabled, handleNewPosition]);

    useEffect(() => {
        if (!enabled || typeof window === 'undefined') return;

        // Kick off initial fix
        fetchLocation();

        // Start continuous watch if requested
        if (watchMode) {
            watchIdRef.current = watchHighAccuracyLocation(
                (pos) => handleNewPosition(pos, 'GPS'),
                (err) => {
                    console.error('[PTS LOCATION] Watch error:', err.message);
                    setError(err.message);
                }
            );
        }

        // Start sensor fusion for dead reckoning between GPS fixes
        let cleanupSensors: (() => void) | undefined;
        if (enableDeadReckoning) {
            cleanupSensors = startSensorFusion((accel: MotionState, orient: OrientationState) => {
                motionRef.current = accel;
                if (orient) orientationRef.current = orient;
            });
        }

        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
            cleanupSensors?.();
        };
    }, [enabled, watchMode, enableDeadReckoning, fetchLocation, handleNewPosition]);

    return {
        location,
        error,
        isLocating,
        fetchLocation,   // Manually trigger a fresh fix
        motionState: motionRef.current,
        orientationState: orientationRef.current
    };
}
