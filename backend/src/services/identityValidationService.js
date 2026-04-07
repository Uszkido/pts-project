const validateNin = require('validate-nin');

/**
 * Identity Validation Service
 * Pre-validates NIN, BVN, and Phone Numbers locally before hitting the live API.
 * This saves extremely valuable API credits for the external Mono/IdentityPass layer.
 */
class IdentityValidationService {

    /**
     * Validates an 11-digit Nigerian National Identity Number (NIN).
     * @param {string} nin 
     * @returns {boolean}
     */
    static isValidNIN(nin) {
        if (!nin) return false;

        // 1. Check with Reguity/validate-nin
        try {
            const ninValidator = validateNin.getValidator({ country: 'ng', type: 'person' });
            const isFormatValid = ninValidator.isValidNiN(nin);
            return isFormatValid;
        } catch (e) {
            // Fallback: 11 digit check
            return /^\d{11}$/.test(nin);
        }
    }

    /**
     * Validates a Nigerian Bank Verification Number (BVN).
     * @param {string} bvn 
     * @returns {boolean}
     */
    static isValidBVN(bvn) {
        if (!bvn) return false;
        // BVN must be 11 digits
        return /^\d{11}$/.test(bvn);
    }

    /**
     * Validates a Nigerian Phone Number and returns formatted standard.
     * @param {string} phone 
     * @returns {Object} { isValid, formatted, carrier }
     */
    static validatePhone(phone) {
        if (!phone) return { isValid: false };

        // Clean all non-digit characters except +
        let cleaned = phone.replace(/[^\d+]/g, '');

        // Pattern matching for Nigerian phones. 
        // Checks formats like: +2348030000000, 2348030000000, 08030000000, 8030000000
        const phoneRegex = /^(?:\+?234|0)?([789][01]\d{8})$/;
        const match = cleaned.match(phoneRegex);

        if (!match) {
            return { isValid: false };
        }

        // Format to standard intl +234...
        const standardNum = match[1];
        const formatted = `+234${standardNum}`;
        const prefix = standardNum.substring(0, 3); // e.g. 803

        // Super basic carrier identification fallback (Can expand later)
        const mtnPrefixes = ['803', '806', '814', '810', '813', '816', '703', '706', '903', '906'];
        const airtelPrefixes = ['802', '808', '812', '701', '708', '902', '907', '901'];
        const gloPrefixes = ['805', '807', '811', '705', '905'];
        const mobile9Prefixes = ['809', '817', '818', '909', '908'];

        let carrier = 'UNKNOWN';
        if (mtnPrefixes.includes(prefix)) carrier = 'MTN';
        else if (airtelPrefixes.includes(prefix)) carrier = 'Airtel';
        else if (gloPrefixes.includes(prefix)) carrier = 'GLO';
        else if (mobile9Prefixes.includes(prefix)) carrier = '9Mobile';

        return {
            isValid: true,
            formatted,
            carrier
        };
    }
}

module.exports = IdentityValidationService;
