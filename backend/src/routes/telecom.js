const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// In a real scenario, this would be validated against a DB of registered Enterprise Telecom API Keys
const validTelecomKeys = ['TEL_MTN_123', 'TEL_AIRTEL_456', 'TEL_GLO_789'];

const authenticateTelecomAPI = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || !validTelecomKeys.includes(apiKey)) {
        return res.status(403).json({ error: 'Unauthorized Telecom Node.' });
    }
    req.telecomId = apiKey;
    next();
};

// Polling endpoint for telecom networks to get current blacklist
router.get('/blacklist/sync', authenticateTelecomAPI, async (req, res) => {
    try {
        // Fetch all IMEIs that are reported stolen or lost
        const blacklistedDevices = await prisma.device.findMany({
            where: {
                status: { in: ['STOLEN', 'LOST'] }
            },
            select: {
                imei: true,
                status: true,
                updatedAt: true
            }
        });

        // Log the sync event for audit purposes
        await prisma.telecomSyncLog.create({
            data: {
                telecomName: req.telecomId,
                recordsSent: blacklistedDevices.length
            }
        });

        res.json({
            syncTimestamp: new Date().toISOString(),
            totalRecords: blacklistedDevices.length,
            blacklist: blacklistedDevices
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error while syncing blacklist.' });
    }
});

// Incoming webhook for SIM change detection
// (Telecoms call THIS when a blacklisted IMEI tries to connect with a new IMSI/SIM)
router.post('/sim-change-alert', authenticateTelecomAPI, async (req, res) => {
    try {
        const { imei, newImsi, timestamp, cellTowerId } = req.body;

        if (!imei || !newImsi) {
            return res.status(400).json({ error: 'Missing required payload data.' });
        }

        const device = await prisma.device.findUnique({ where: { imei } });

        if (!device) {
            return res.status(404).json({ error: 'Device not registered in PTS.' });
        }

        // Ideally, we'd fire off an async Kafka event to law enforcement here.
        // For now, if we receive an alert on a CLEAN phone, it might be a cloning attempt, so we flag it.
        if (device.status === 'CLEAN') {
            await prisma.device.update({
                where: { imei },
                data: { status: 'INVESTIGATING', riskScore: 20 }
            });
        }

        res.status(202).json({ message: 'Alert received and logged by PTS.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
