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

/**
 * AI Behavioral "Pattern of Life" Lock (Account Takeover Protection)
 * Checks if a transfer request breaks the user's "Pattern of Life".
 */
const checkPatternOfLifeAnomaly = async (userId, currentIp) => {
    try {
        // Fetch the last 5 actions performed by this user
        const recentHistory = await prisma.transactionHistory.findMany({
            where: { actorId: userId },
            orderBy: { createdAt: 'desc' },
            take: 5
        });

        // Extract historical IPs from metadata
        const historicIps = recentHistory.map(h => {
            try {
                const meta = h.metadata ? JSON.parse(h.metadata) : {};
                return meta.ip || null;
            } catch (e) { return null; }
        }).filter(ip => ip !== null);

        // Simple Anomaly Logic: If the user has an established pattern (at least 2 previous IPs)
        // and the current IP has NEVER been seen before, we lock the account to prevent hostile takeover.
        // In a deployed ML system, this analyzes distance/velocity (e.g. Kano -> Lagos in 5 mins).
        if (historicIps.length >= 2 && currentIp && !historicIps.includes(currentIp)) {
            return {
                anomalyDetected: true,
                reason: `Unusual geographic or network location detected (IP: ${currentIp}). This does not match your typical Pattern of Life. A Live Selfie verification is required to authorize this transfer.`
            };
        }

        return { anomalyDetected: false, reason: "" };
    } catch (error) {
        console.error("Pattern of life check error:", error);
        return { anomalyDetected: false, reason: "" }; // Fallback open
    }
};

module.exports = { detectClonedImeiAnomaly, checkPatternOfLifeAnomaly };
