const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class RiskEngine {
    /**
     * Calculate Trust Index (0-100) for a device based on its telemetry and history.
     */
    static async calculateDeviceTrustIndex(imei) {
        try {
            const device = await prisma.device.findUnique({
                where: { imei },
                include: {
                    registeredOwner: {
                        include: { trustScore: true }
                    },
                    transfersAsDevice: true
                }
            });

            if (!device) return null;

            // Base score for a registered device
            let score = 100;

            // 1. Status Penalty (Fatal)
            if (device.status === 'STOLEN') return 0;
            if (device.status === 'LOST') return 20;
            if (device.status === 'INVESTIGATING') return 40;

            // 2. Vendor Reputation Proxy
            // If registered by a Vendor, factor in their Trust Score
            if (device.registeredOwner.role === 'VENDOR') {
                const vendorScore = device.registeredOwner.trustScore?.score || 80; // Defaults to 80 if unrated
                if (vendorScore < 50) score -= 30; // High penalty for shady vendors
                else if (vendorScore < 80) score -= 10;
            }

            // 3. Chain of Custody Penalty
            // Too many transfers in a short time is suspicious
            const transferCount = device.transfersAsDevice.filter(t => t.status === 'COMPLETED').length;
            if (transferCount > 3) score -= (transferCount * 5); // Deduct points for high churn

            // 4. Time-based stability (Bonus/Penalty)
            const daysSinceRegistration = (Date.now() - new Date(device.createdAt).getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceRegistration < 7 && transferCount > 1) {
                // Flipped too fast
                score -= 20;
            }

            // Clamp score between 0 and 100
            score = Math.max(0, Math.min(100, score));

            // Persist the updated score
            await prisma.device.update({
                where: { imei },
                data: { riskScore: score }
            });

            return score;

        } catch (error) {
            console.error('Error calculating risk score:', error);
            return 50; // Neutral fallback
        }
    }
}

module.exports = RiskEngine;
