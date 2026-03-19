const fetch = require('node-fetch') || global.fetch;

const MONO_SEC_KEY = process.env.MONO_SEC_KEY || '';

/**
 * Verify exactly or search CAC business registration using Mono API
 * @param {string} searchTerm - The CAC registration number or company name
 * @returns {Promise<any>} - The business details if valid
 */
const verifyCAC = async (searchTerm) => {
    if (!MONO_SEC_KEY) {
        console.warn('⚠️ MONO_SEC_KEY is not set. Skipping real CAC verification.');
        return { valid: true, mock: true, warning: "Mono API Key missing" };
    }

    try {
        const response = await fetch(`https://api.withmono.com/v3/lookup/cac?search=${encodeURIComponent(searchTerm)}`, {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                'mono-sec-key': MONO_SEC_KEY
            }
        });

        if (!response.ok) {
            console.error('Mono API error:', await response.text());
            return { valid: false, reason: 'Failed to verify CAC number with the National Registry.' };
        }

        const data = await response.json();

        // Mono API typically returns results in `data` array for search endpoints
        if (data && data.data && data.data.length > 0) {
            return { valid: true, details: data.data[0] };
        } else {
            return { valid: false, reason: 'Business not found in CAC registry.' };
        }
    } catch (error) {
        console.error('Error verifying CAC with Mono:', error.message);
        throw new Error('CAC verification service is currently unreachable.');
    }
};

/**
 * Verify National Identity Number (NIN) using Mono API
 * @param {string} nin - The National Identity Number
 * @returns {Promise<any>} - The identity details if valid
 */
const verifyNIN = async (nin) => {
    if (!MONO_SEC_KEY) {
        console.warn('⚠️ MONO_SEC_KEY is not set. Skipping real NIN verification.');
        return { valid: true, mock: true, warning: "Mono API Key missing" };
    }

    try {
        const response = await fetch(`https://api.withmono.com/v3/lookup/nin`, {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'content-type': 'application/json',
                'mono-sec-key': MONO_SEC_KEY
            },
            body: JSON.stringify({ nin })
        });

        if (!response.ok) {
            console.error('Mono NIN verification API error:', await response.text());
            return { valid: false, reason: 'Failed to verify NIN with the National Identity Database.' };
        }

        const data = await response.json();

        // Ensure successful response contains data
        if (data && data.status === 'successful' && data.data) {
            return { valid: true, details: data.data };
        } else if (data && data.data) {
            return { valid: true, details: data.data };
        } else {
            return { valid: false, reason: 'NIN not found or invalid.' };
        }
    } catch (error) {
        console.error('Error verifying NIN with Mono:', error.message);
        throw new Error('NIN verification service is currently unreachable.');
    }
};

module.exports = {
    verifyCAC,
    verifyNIN
};
