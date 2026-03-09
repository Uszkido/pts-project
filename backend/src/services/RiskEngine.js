const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class RiskEngine {
    /**
     * Calculate Trust Index (0-100) — V2 AI-Lite Heuristics
     */
    static async calculateDeviceTrustIndex(imei) {
        try {
            const device = await prisma.device.findUnique({
                where: { imei },
                include: {
                    registeredOwner: {
                        include: { trustScore: true }
                    },
                    transfersAsDevice: true,
                    history: {
                        orderBy: { createdAt: 'desc' },
                        take: 50
                    }
                }
            });

            if (!device) return null;

            let score = 100;

            // 1. FATAL STATUS CHECK (Non-negotiable)
            if (device.status === 'STOLEN') return 0;
            if (device.status === 'LOST') return 20;

            // 2. VELOCITY ATTACK DETECTION (Heuristic: Scan Bursts)
            // If the device has been scanned > 5 times in the last 1 hour across different IPs/Sessions
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            const recentHistory = device.history.filter(h => h.createdAt > oneHourAgo);
            const scanEvents = recentHistory.filter(h => h.type === 'STATUS_CHANGE' || h.description.includes('Registry Check'));
            if (scanEvents.length > 5) {
                score -= 40; // High probability of "hot" device being tested for resale
            }

            // 3. VENDOR INTEGRITY SCORE
            if (device.registeredOwner.role === 'VENDOR') {
                const vendorScore = device.registeredOwner.trustScore?.score || 80;
                if (vendorScore < 40) score -= 50;
                else if (vendorScore < 70) score -= 15;
            }

            // 4. CHURN & CUSTODY OSCILLATION
            // Tracking "High Churn" — lots of owners in short duration
            const completedTransfers = device.transfersAsDevice.filter(t => t.status === 'COMPLETED');
            if (completedTransfers.length > 5) score -= 25; // Professional flipping or laundering detection

            // Tracking "Failed Transfers" — high cancellation rate suggests rejected sales due to issues
            const cancelledTransfers = device.transfersAsDevice.filter(t => t.status === 'CANCELLED');
            if (cancelledTransfers.length > 3) score -= 20;

            // 5. GEOSPATIAL ANOMALY (Pseudo-ML)
            // If the last location ping is in a known "Black Market" zone (Mocked list)
            const blackMarketZones = ['ZONE_LAG_ALABA', 'ZONE_ABJ_EMAB', 'ZONE_PH_COMP'];
            if (device.lastKnownLocation && blackMarketZones.some(z => device.lastKnownLocation.includes(z))) {
                score -= 30;
            }

            // 6. ASSET AGE STABILITY
            const daysActive = (Date.now() - new Date(device.createdAt).getTime()) / (1000 * 60 * 60 * 24);
            if (daysActive > 365) score += 10; // Long-term stable ownership is a trust signal

            score = Math.max(0, Math.min(100, score));

            // Async persist (Fire & Forget)
            prisma.device.update({
                where: { imei },
                data: { riskScore: score }
            }).catch(e => console.error('Silent failure updating score:', e));

            return score;

        } catch (error) {
            console.error('AI Strategy Error:', error);
            return 45; // Neutral-Low fallback
        }
    }
}

module.exports = RiskEngine;
