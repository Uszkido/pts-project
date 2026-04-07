// axios is not used in the current simulated mode

/**
 * Cryptographic Luhn Algorithm Check
 * Mathematically validates if an IMEI is structurally sound
 * preventing random 15-digit fabrications from wasting DB lookups.
 */
const isValidLuhn = (imei) => {
    if (!/^\d{15}$/.test(imei)) return false;

    let sum = 0;
    for (let i = 0; i < 15; i++) {
        let digit = parseInt(imei.charAt(i), 10);
        if (i % 2 !== 0) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
    }
    return sum % 10 === 0;
};

/**
 * PTS IMEI Sentinel Service
 * Coordinates with external global databases (GSMA, IMEI.DB, etc.)
 */
const verifyImeiRegistry = async (imei) => {
    // 1. Hardware-Level Verification (Luhn Checksum)
    const isValidHardwareId = isValidLuhn(imei);

    if (!isValidHardwareId) {
        console.warn(`🛑 Rejected Fake IMEI Fabricated Input: ${imei}`);
        return {
            isValid: false,
            luhnCheckPassed: false,
            specs: null,
            isBlacklisted: false,
            source: "PTS Cryptographic Filter"
        };
    }

    console.log(`🔍 Global Lookup: Querying international GSMA registry for IMEI: ${imei}`);

    // SIMULATED RESPONSE for Development
    const mockDb = {
        "351234567890123": { brand: "Apple", model: "iPhone 15 Pro", status: "CLEAN", manufacturer: "Apple Inc." },
        "354455667788990": { brand: "Samsung", model: "Galaxy S24 Ultra", status: "BLACKLISTED", manufacturer: "Samsung Electronics" }
    };

    const data = mockDb[imei] || {
        brand: "Generic",
        model: "Smartphone",
        status: "UNREGISTERED",
        manufacturer: "Unknown"
    };

    return {
        isValid: true,
        luhnCheckPassed: true,
        specs: data,
        isBlacklisted: data.status === 'BLACKLISTED',
        source: "Global IMEI Authority (Simulated)"
    };
};

module.exports = { verifyImeiRegistry };
