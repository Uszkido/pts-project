// axios is not used in the current simulated mode

/**
 * PTS IMEI Sentinel Service
 * Coordinates with external global databases (GSMA, IMEI.DB, etc.)
 */
const verifyImeiRegistry = async (imei) => {
    // In a production environment, this would hit an API like IMEI.db or GSMA
    // API_KEY = process.env.IMEI_DB_API_KEY;

    console.log(`🔍 Global Lookup: Querying international GSMA registry for IMEI: ${imei}`);

    // SIMULATED RESPONSE for Development
    // In reality, we'd use axios.get(`https://imeidb.xyz/api/v1/check/${imei}?api_key=${API_KEY}`)

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
        isValid: imei.length === 15,
        specs: data,
        isBlacklisted: data.status === 'BLACKLISTED',
        source: "Global IMEI Authority (Simulated)"
    };
};

module.exports = { verifyImeiRegistry };
