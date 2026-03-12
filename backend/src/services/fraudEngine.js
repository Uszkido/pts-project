const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Checks if an IMEI is experiencing abnormal verification velocity.
 * Analyzes DeviceTrackingLog to see if the same IMEI has been verified by multiple distinct people/locations within 24 hours.
 */
const detectClonedImeiAnomaly = async (imei, currentMethod, currentLocation) => {
    try {
        // 1. Log the current verification event
        await prisma.deviceTrackingLog.create({
            data: {
                deviceImei: imei,
                method: currentMethod, // e.g. "WHATSAPP", "TELEGRAM"
                location: currentLocation, // e.g. "+23470...", "ChatID_123"
            }
        });

        // 2. Fetch all tracking logs for this IMEI in the last 24 hours
        const oneDayAgo = new Date();
        oneDayAgo.setHours(oneDayAgo.getHours() - 24);

        const recentLogs = await prisma.deviceTrackingLog.findMany({
            where: {
                deviceImei: imei,
                createdAt: {
                    gte: oneDayAgo
                }
            }
        });

        // 3. Count unique locations (phone numbers/chat IDs/IPs)
        const uniqueLocations = new Set(recentLogs.map(log => log.location));

        // 4. Determine Anomaly Status
        if (uniqueLocations.size >= 3) {
            return `HIGH ANOMALY DETECTED: This identical IMEI has been independently searched for high-risk verification by ${uniqueLocations.size} completely different people across different locations in the last 24 hours. This is highly indicative of a CLONED or "FLASHED" IMEI distributed to multiple physical phones in the market. The user MUST BE WARNED severely not to buy this device as it may be stolen hardware posing as clean.`;
        }

        return ""; // No anomaly
    } catch (error) {
        console.error("Fraud Engine Error:", error);
        return "";
    }
};

module.exports = { detectClonedImeiAnomaly };
