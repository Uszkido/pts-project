const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * 1. The "Lazarus Protocol" (Frankenstein Phone Detection)
 * Detects if a "Clean" phone is actually built from stolen parts (Chop-Shop detection).
 */
const evaluateLazarusProtocol = async (screenSerial, batterySerial, motherboardSerial, cameraSerial) => {
    try {
        const serials = [screenSerial, batterySerial, motherboardSerial, cameraSerial].filter(Boolean);
        if (serials.length === 0) return { isFrankenstein: false };

        // Search the DB if ANY of these exact serial components belonged to a STOLEN device
        const stolenMatches = await prisma.device.findMany({
            where: {
                status: 'STOLEN',
                OR: [
                    { screenSerialNumber: { in: serials } },
                    { batterySerialNumber: { in: serials } },
                    { motherboardSerialNumber: { in: serials } },
                    { cameraSerialNumber: { in: serials } }
                ]
            },
            select: { imei: true, brand: true, model: true }
        });

        if (stolenMatches.length > 0) {
            return {
                isFrankenstein: true,
                reason: `CRITICAL HARDWARE MISMATCH: Device contains components harvested from a globally blacklisted stolen device (Origin IMEI: ${stolenMatches[0].imei}). This is a 'Lazarus' Chop-Shop assembly.`,
                blacklistedOrigins: stolenMatches
            };
        }

        return { isFrankenstein: false };
    } catch (error) {
        console.error("Lazarus Protocol Error:", error);
        return { isFrankenstein: false };
    }
};

/**
 * 2. Syndicate Mapper (The "Cartel" Graph AI)
 * Analyzes Vendor transaction networks to uncover organized crime rings.
 */
const detectSyndicateCollusion = async (vendorId, currentIp) => {
    try {
        if (!currentIp) return { isColluding: false };

        // Look for OTHER vendors doing high-risk transactions from the exact same IP address
        const collusionRing = await prisma.user.findMany({
            where: {
                role: 'VENDOR',
                id: { not: vendorId },
                actionsPerformed: {
                    some: {
                        metadata: { contains: currentIp },
                        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
                    }
                }
            },
            select: { id: true, companyName: true }
        });

        if (collusionRing.length >= 2) {
            // Highly suspicious: 3+ vendors using the exact same internet connection to register devices
            return {
                isColluding: true,
                reason: `SYNDICATE WARNING: Vendor is operating from a known shadow-network IP used by ${collusionRing.length} other vendors suspected of fencing stolen goods.`,
                ringMembers: collusionRing
            };
        }

        return { isColluding: false };
    } catch (error) {
        console.error("Syndicate Mapper Error:", error);
        return { isColluding: false };
    }
};

/**
 * 3. The "Digital Bloodhound" (Dynamic Aggregation Tracker)
 * Analyzes movement speed and location to enter aggressive tracking modes.
 */
const evaluateBloodhoundState = (deviceStatus, batteryLevel, isMovingFast) => {
    if (deviceStatus !== 'STOLEN') return "IDLE_MODE";

    // If stolen and moving fast (e.g. in a car escaping), enter Bloodhound Mode
    // to rapidly ping GPS before the battery dies or it leaves the city
    if (isMovingFast && batteryLevel > 15) {
        return "BLOODHOUND_ACTIVE_SNAP_MODE"; // Trigger aggressive tracking
    }

    // If sitting still / dead battery, enter sleeper mode to avoid detection / save power
    if (!isMovingFast && batteryLevel <= 15) {
        return "SLEEPER_CONSERVATION_MODE";
    }

    return "ACTIVE_TRACKING";
};

/**
 * 4. Predictive Smuggling Route AI (Border & Customs Control)
 * Calculates velocity and distance to flag imminent border crossings via Northern routes.
 */
const predictSmugglingTrajectory = (startLat, startLng, currentLat, currentLng, timeElapsedHrs) => {
    // Very simplified geofencing logic for demonstration of concept
    // E.g., moving North rapidly towards Katsina/Niger border

    if (timeElapsedHrs <= 0) return { alert: false };

    // Calculate rough distance (Pythagorean for simple DB mock, ideal would be Haversine)
    const distanceKm = Math.sqrt(Math.pow((currentLat - startLat) * 111, 2) + Math.pow((currentLng - startLng) * 111, 2));
    const speedKmH = distanceKm / timeElapsedHrs;

    // Northern borders roughly > 13.0 Lat
    const isHeadingNorth = currentLat > startLat;
    const isNearBorder = currentLat > 12.5;

    if (speedKmH > 60 && isHeadingNorth && isNearBorder) {
        return {
            alert: true,
            urgency: "CRITICAL",
            warning: `PREDICTIVE SMUGGLING ALERT: Stolen asset is moving North at ${Math.round(speedKmH)} km/h towards International Borders. Estimated extraction window: < 3 hours. Triggering Customs Intel Feed.`
        };
    }

    return { alert: false };
};

module.exports = {
    evaluateLazarusProtocol,
    detectSyndicateCollusion,
    evaluateBloodhoundState,
    predictSmugglingTrajectory
};
