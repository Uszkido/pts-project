/**
 * PTS SENTINEL — Mono Financial & Identity Service
 * Status: SUSPENDED (v1.7.8) - Mock Mode Active
 * ==================================================
 * Suspended as requested. Returns simulated successful verifications
 * to maintain UI flows without requiring a live MONO_SEC_KEY.
 */

const MONO_SEC_KEY = process.env.MONO_SEC_KEY || '';

/**
 * Mock CAC Business Verification
 */
const verifyCAC = async (searchTerm) => {
    console.log(`[Mono Service] (MOCK) Verifying CAC: ${searchTerm}`);
    return {
        valid: true,
        mock: true,
        details: {
            name: searchTerm,
            registration_number: "RC1234567-MOCK",
            address: "PTS Sentinel Digital HQ",
            status: "ACTIVE_SIMULATED"
        }
    };
};

/**
 * Mock NIN Identity Verification
 */
const verifyNIN = async (nin) => {
    console.log(`[Mono Service] (MOCK) Verifying NIN: ${nin}`);
    return {
        valid: true,
        mock: true,
        details: {
            first_name: "Sentinel-Citizen",
            last_name: "Verified",
            nin: nin,
            verification_status: "SUCCESS_MOCKED"
        }
    };
};

module.exports = {
    verifyCAC,
    verifyNIN
};
