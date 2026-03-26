// Using native Node 18+ fetch

const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY || 'a9f6de70b0b543199e90d853c0e2145e';

/**
 * Perform a reverse geocoding lookup using Geoapify
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<string>} - Human readable address
 */
const reverseGeocode = async (lat, lon) => {
    try {
        const response = await fetch(`https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lon}&apiKey=${GEOAPIFY_API_KEY}`);
        const data = await response.json();

        if (data.features && data.features.length > 0) {
            const result = data.features[0].properties;
            // E.g., "123 Main St, Ikeja, Lagos, Nigeria"
            return result.formatted || `${lat}, ${lon} (Unknown Format)`;
        }

        return `${lat}, ${lon} (Unmapped Area)`;
    } catch (error) {
        console.error('Geoapify Reverse Geocoding Error:', error.message);
        return `${lat}, ${lon} (Geocoder Failed)`;
    }
};

// ─── Well-known High-Risk Zones in Nigeria ─────────────────────────────────
// Used for server-side geofence checks on observation reports.
const HIGH_RISK_ZONES = [
    { name: 'Computer Village, Ikeja', lat: 6.6018, lon: 3.3515, radiusMeters: 500 },
    { name: 'Alaba Int\'l Market, Lagos', lat: 6.4608, lon: 3.2847, radiusMeters: 600 },
    { name: 'Onitsha Main Market', lat: 6.1344, lon: 6.7866, radiusMeters: 500 },
    { name: 'Ladipo Spare Parts, Lagos', lat: 6.5344, lon: 3.3515, radiusMeters: 400 },
    { name: 'Ariaria Market, Aba', lat: 5.1143, lon: 7.3726, radiusMeters: 500 },
];

/**
 * Haversine formula: calculates distance between two GPS coordinates in metres.
 * @param {number} lat1 @param {number} lon1
 * @param {number} lat2 @param {number} lon2
 * @returns {number} Distance in metres
 */
const haversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const rad = Math.PI / 180;
    const phi1 = lat1 * rad;
    const phi2 = lat2 * rad;
    const dPhi = (lat2 - lat1) * rad;
    const dLambda = (lon2 - lon1) * rad;
    const a = Math.sin(dPhi / 2) ** 2 +
        Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Check if coordinates fall within any registered high-risk geofence.
 * @param {number} lat @param {number} lon
 * @returns {{ isHighRisk: boolean, zoneName: string|null, distanceMeters: number|null }}
 */
const checkGeofence = (lat, lon) => {
    if (lat == null || lon == null) return { isHighRisk: false, zoneName: null, distanceMeters: null };

    for (const zone of HIGH_RISK_ZONES) {
        const dist = haversineDistance(lat, lon, zone.lat, zone.lon);
        if (dist <= zone.radiusMeters) {
            return { isHighRisk: true, zoneName: zone.name, distanceMeters: Math.round(dist) };
        }
    }
    return { isHighRisk: false, zoneName: null, distanceMeters: null };
};

module.exports = {
    reverseGeocode,
    checkGeofence,
    haversineDistance
};
