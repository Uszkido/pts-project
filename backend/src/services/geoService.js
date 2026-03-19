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

module.exports = {
    reverseGeocode
};
