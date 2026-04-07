const ngv = require('nigeria-validator');
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
        const ninValidator = validateNin.getValidator({ country: 'ng', type: 'person' });
        const isFormatValid = ninValidator.isValidNiN(nin);

        // 2. Check with nigeria-validator (fallback/backup)
        const isNigerianValid = ngv.isValidNIN(nin);

        return isFormatValid || isNigerianValid;
    }

    /**
     * Validates a Nigerian Bank Verification Number (BVN).
     * @param {string} bvn 
     * @returns {boolean}
     */
    static isValidBVN(bvn) {
        if (!bvn) return false;
        return ngv.isValidBVN(bvn);
    }

    /**
     * Validates a Nigerian Phone Number and returns formatted standard.
     * @param {string} phone 
     * @returns {Object} { isValid, formatted, carrier }
     */
    static validatePhone(phone) {
        if (!phone) return { isValid: false };

        const isValid = ngv.isValidPhone(phone);
        if (!isValid) return { isValid: false };

        const formatted = ngv.formatPhone(phone, 'intl');
        const carrier = ngv.getNigerianNetwork(phone);

        return {
            isValid,
            formatted,
            carrier
        };
    }
}

module.exports = IdentityValidationService;
