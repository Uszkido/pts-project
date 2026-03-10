/**
 * PTS Valuation Oracle Engine
 * Calculates the deprecated value of a device based on its lifecycle telemetry.
 */

const BASE_PRICES = {
    'Apple': {
        'iPhone 15 Pro Max': 1800000,
        'iPhone 15 Pro': 1500000,
        'iPhone 15': 1200000,
        'iPhone 14': 950000,
        'iPhone 13': 800000
    },
    'Samsung': {
        'Galaxy S24 Ultra': 1750000,
        'Galaxy S24': 1100000,
        'Galaxy S23': 850000,
        'Galaxy Z Fold 5': 2200000
    },
    'Google': {
        'Pixel 8 Pro': 1200000,
        'Pixel 8': 850000
    }
};

const DEFAULT_BASE = 450000;

function calculateValuation(device) {
    let brandPrices = BASE_PRICES[device.brand] || {};
    let initialValue = brandPrices[device.model] || DEFAULT_BASE;

    // 1. Depreciation based on Age (Months since registration)
    const monthsOwned = Math.max(0, (new Date() - new Date(device.createdAt)) / (1000 * 60 * 60 * 24 * 30));
    const depreciationRate = 0.02; // 2% per month
    let currentValue = initialValue * Math.pow(1 - depreciationRate, monthsOwned);

    // 2. Risk Score Penalty
    // If risk score is 100, no penalty. If 0, value is 0 (stolen/blacklisted)
    const riskFactor = device.riskScore / 100;
    currentValue *= riskFactor;

    // 3. Maintenance Impact
    if (device.maintenance && device.maintenance.length > 0) {
        device.maintenance.forEach(record => {
            switch (record.serviceType) {
                case 'MOTHERBOARD_REPAIR':
                    currentValue *= 0.70; // -30% (Critical)
                    break;
                case 'SCREEN_REPLACEMENT':
                    currentValue *= 0.85; // -15%
                    break;
                case 'BATTERY_CHANGE':
                    currentValue *= 0.95; // -5% (Consumable)
                    break;
                case 'GENERAL_REPAIR':
                    currentValue *= 0.90; // -10%
                    break;
                default:
                    currentValue *= 0.98; // -2% for minor things
            }
        });
    }

    // 4. Status Penalty
    if (device.status !== 'CLEAN') {
        currentValue *= 0.5; // Massive hit for non-clean status even if not stolen
    }

    return Math.max(0, Math.round(currentValue));
}

module.exports = { calculateValuation };
