/**
 * PTS Web Geolocation API
 * Integrates High Accuracy Geolocation (Fused Location), Sensor Fusion (Dead Reckoning), 
 * Reverse Geocoding, and Geofencing logic.
 */

// 1. High Accuracy Geolocation
export const getHighAccuracyLocation = async (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined' || !navigator.geolocation) {
            return reject(new Error('Geolocation not supported'));
        }
        navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            {
                enableHighAccuracy: true, // Forces GPS hardware and Wi-Fi positioning (Fused Location)
                timeout: 15000,
                maximumAge: 0 // Prevent caching to ensure 5-10 meters accuracy
            }
        );
    });
};

export const watchHighAccuracyLocation = (
    onSuccess: (pos: GeolocationPosition) => void,
    onError: (err: GeolocationPositionError) => void
): number => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
        throw new Error('Geolocation not supported');
    }
    return navigator.geolocation.watchPosition(
        onSuccess,
        onError,
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
};

// 2. Reverse Geocoding (Converts Coordinates to Address)
// Using Nominatim as an open API for reverse geocoding
export const reverseGeocode = async (latitude: number, longitude: number): Promise<string> => {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        if (!response.ok) throw new Error('API Request Failed');
        const data = await response.json();
        return data.display_name || 'Unknown Location';
    } catch (error) {
        console.error('Reverse Geocoding Error:', error);
        return 'Unknown Location';
    }
};

// 3. Sensor Fusion & Dead Reckoning (Motion & Orientation Sensors)
export const startSensorFusion = (onMotionDetect: (acceleration: any, orientation: any) => void) => {
    let currentOrientation: any = null;

    const orientationHandler = (event: DeviceOrientationEvent) => {
        currentOrientation = {
            alpha: event.alpha, // z-axis rotation
            beta: event.beta,   // x-axis rotation
            gamma: event.gamma  // y-axis rotation
        };
    };

    const motionHandler = (event: DeviceMotionEvent) => {
        const acceleration = {
            x: event.acceleration?.x || 0,
            y: event.acceleration?.y || 0,
            z: event.acceleration?.z || 0
        };
        onMotionDetect(acceleration, currentOrientation);
    };

    if (typeof window !== 'undefined') {
        if ('DeviceOrientationEvent' in window) {
            window.addEventListener('deviceorientation', orientationHandler);
        }
        if ('DeviceMotionEvent' in window) {
            window.addEventListener('devicemotion', motionHandler);
        }
    }

    return () => {
        if (typeof window !== 'undefined') {
            window.removeEventListener('deviceorientation', orientationHandler);
            window.removeEventListener('devicemotion', motionHandler);
        }
    };
};

// 4. Geofencing Logic (Haversine Formula)
export const isWithinGeofence = (lat1: number, lon1: number, centerLat: number, centerLon: number, radiusInMeters: number): boolean => {
    const R = 6371e3; // Earth radius in meters
    const rad = Math.PI / 180;
    const phi1 = lat1 * rad;
    const phi2 = centerLat * rad;
    const deltaPhi = (centerLat - lat1) * rad;
    const deltaLambda = (centerLon - lon1) * rad;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) *
        Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c;
    return distance <= radiusInMeters;
};
