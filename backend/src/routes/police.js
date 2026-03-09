const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = 'supersecret_pts_dev_key';

// Middleware to verify JWT and Police role
const authenticatePolice = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        if (user.role !== 'POLICE' && user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Access denied. Law enforcement personnel only.' });
        }
        req.user = user;
        next();
    });
};

// Get all devices or filter by status
router.get('/devices', authenticatePolice, async (req, res) => {
    try {
        const { status } = req.query;
        let query = {};

        if (status) {
            query.status = status;
        }

        const devices = await prisma.device.findMany({
            where: query,
            include: {
                registeredOwner: {
                    select: { email: true, companyName: true }
                }
            },
            orderBy: { updatedAt: 'desc' }
        });

        res.json({ devices });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update device status (e.g., mark as INVESTIGATING or RECOVERED)
router.put('/devices/:imei/status', authenticatePolice, async (req, res) => {
    try {
        const { imei } = req.params;
        const { status } = req.body; // e.g., INVESTIGATING, CLEAN

        const allowedStatuses = ['CLEAN', 'STOLEN', 'LOST', 'INVESTIGATING'];
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const device = await prisma.device.update({
            where: { imei },
            data: { status }
        });

        res.json({ message: `Device status updated to ${status}`, device });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Fetch all consumer incident reports
router.get('/incidents', authenticatePolice, async (req, res) => {
    try {
        const reports = await prisma.incidentReport.findMany({
            include: {
                device: { select: { imei: true, brand: true, model: true, lastKnownLocation: true, devicePhotoUrl: true } },
                reporter: { select: { email: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ reports });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Fetch all vendor suspicious activity alerts
router.get('/vendor-alerts', authenticatePolice, async (req, res) => {
    try {
        const alerts = await prisma.vendorSuspiciousAlert.findMany({
            include: {
                device: { select: { imei: true, brand: true, model: true, devicePhotoUrl: true } },
                vendor: { select: { email: true, companyName: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ alerts });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Fetch metrics for the dashboard
router.get('/dashboard-metrics', authenticatePolice, async (req, res) => {
    try {
        const totalDevices = await prisma.device.count();
        const cleanDevices = await prisma.device.count({ where: { status: 'CLEAN' } });
        const stolenDevices = await prisma.device.count({ where: { status: 'STOLEN' } });
        const lostDevices = await prisma.device.count({ where: { status: 'LOST' } });
        const investigatingDevices = await prisma.device.count({ where: { status: 'INVESTIGATING' } });

        const openIncidents = await prisma.incidentReport.count({ where: { status: 'OPEN' } });
        const openAlerts = await prisma.vendorSuspiciousAlert.count();

        res.json({
            metrics: {
                totalDevices,
                cleanDevices,
                stolenDevices,
                lostDevices,
                investigatingDevices,
                openIncidents,
                openAlerts
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ DEVICE SEARCH ============
router.get('/search', authenticatePolice, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) return res.status(400).json({ error: 'Search query too short' });

        const devices = await prisma.device.findMany({
            where: {
                OR: [
                    { imei: { contains: q, mode: 'insensitive' } },
                    { brand: { contains: q, mode: 'insensitive' } },
                    { model: { contains: q, mode: 'insensitive' } },
                    { serialNumber: { contains: q, mode: 'insensitive' } },
                    { registeredOwner: { email: { contains: q, mode: 'insensitive' } } },
                    { registeredOwner: { companyName: { contains: q, mode: 'insensitive' } } }
                ]
            },
            include: {
                registeredOwner: { select: { email: true, companyName: true, fullName: true } }
            },
            take: 20,
            orderBy: { updatedAt: 'desc' }
        });

        res.json({ devices });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ SUSPECT REGISTRY ============
router.post('/suspects', authenticatePolice, async (req, res) => {
    try {
        const { fullName, alias, nationalId, phoneNumber, description, photoUrl, knownAddresses, dangerLevel } = req.body;

        const suspect = await prisma.suspect.create({
            data: { fullName, alias, nationalId, phoneNumber, description, photoUrl, knownAddresses, dangerLevel: dangerLevel || 'UNKNOWN' }
        });

        res.status(201).json({ message: 'Suspect record created', suspect });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/suspects', authenticatePolice, async (req, res) => {
    try {
        const suspects = await prisma.suspect.findMany({
            include: { incidents: { include: { device: { select: { imei: true, brand: true, model: true } } } } },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ suspects });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Link a suspect to an incident
router.put('/incidents/:id/suspect', authenticatePolice, async (req, res) => {
    try {
        const { id } = req.params;
        const { suspectId } = req.body;

        const report = await prisma.incidentReport.update({
            where: { id },
            data: { suspectId }
        });

        res.json({ message: 'Suspect linked to incident', report });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Police clears an incident
router.put('/incidents/:id/clear', authenticatePolice, async (req, res) => {
    try {
        const { id } = req.params;
        const report = await prisma.incidentReport.update({
            where: { id },
            data: { status: 'CLEARED' }
        });
        res.json({ message: 'Incident cleared successfully', report });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/suspects/:id/status', authenticatePolice, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // ACTIVE, CLEARED, GUILTY, NOT_GUILTY

        if (!['ACTIVE', 'CLEARED', 'GUILTY', 'NOT_GUILTY'].includes(status)) {
            return res.status(400).json({ error: 'Invalid suspect status' });
        }

        const suspect = await prisma.suspect.update({
            where: { id },
            data: { status }
        });

        res.json({ message: `Suspect status updated to ${status}`, suspect });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ TRACKING LOGS ============
router.post('/tracking-log', authenticatePolice, async (req, res) => {
    try {
        const { deviceImei, method, location, accuracy, ipAddress, metadata } = req.body;

        if (!deviceImei || !method || !location) {
            return res.status(400).json({ error: 'deviceImei, method, and location are required' });
        }

        const log = await prisma.deviceTrackingLog.create({
            data: { deviceImei, method, location, accuracy, ipAddress, metadata, loggedById: req.user.id }
        });

        // Also update device's last known location
        await prisma.device.updateMany({
            where: { imei: deviceImei },
            data: { lastKnownLocation: location, lastKnownIp: ipAddress, lastLocationUpdate: new Date() }
        });

        res.status(201).json({ message: 'Tracking log recorded', log });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/tracking-logs/:imei', authenticatePolice, async (req, res) => {
    try {
        const { imei } = req.params;
        const logs = await prisma.deviceTrackingLog.findMany({
            where: { deviceImei: imei },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ logs });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ LOCATION SHARING WITH VICTIM ============
router.put('/incidents/:id/share-location', authenticatePolice, async (req, res) => {
    try {
        const { id } = req.params;

        const report = await prisma.incidentReport.update({
            where: { id },
            data: { locationSharedWithOwner: true }
        });

        res.json({ message: 'Device location is now shared with the victim account', report });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ MESSAGING (ADMIN ↔ POLICE) ============
router.get('/messages', authenticatePolice, async (req, res) => {
    try {
        const messages = await prisma.message.findMany({
            where: {
                OR: [
                    { receiverRole: 'POLICE' },
                    { senderId: req.user.id }
                ]
            },
            include: { sender: { select: { email: true, fullName: true, role: true } } },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ messages });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/messages', authenticatePolice, async (req, res) => {
    try {
        const { subject, body } = req.body;
        if (!subject || !body) return res.status(400).json({ error: 'Subject and body are required' });

        const message = await prisma.message.create({
            data: {
                senderId: req.user.id,
                receiverRole: 'ADMIN',
                subject,
                body
            }
        });

        res.status(201).json({ message: 'Message sent to Admins', data: message });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ LIVE ACTIONS ============
router.post('/deploy-team', authenticatePolice, async (req, res) => {
    try {
        const { imei, location } = req.body;
        if (!imei) return res.status(400).json({ error: 'IMEI is required' });

        const device = await prisma.device.findUnique({ where: { imei } });
        if (!device) return res.status(404).json({ error: 'Device not found' });

        // Record the deployment in transaction history
        await prisma.transactionHistory.create({
            data: {
                deviceId: device.id,
                actorId: req.user.id,
                type: 'TEAM_DEPLOYED',
                description: `Rapid Response Team deployed to last known location: ${location || device.lastKnownLocation || 'Unknown'}`,
                metadata: JSON.stringify({ timestamp: new Date(), location })
            }
        });

        // Update device status to INVESTIGATING if it's not already something more serious
        if (device.status === 'STOLEN' || device.status === 'LOST' || device.status === 'CLEAN') {
            await prisma.device.update({
                where: { imei },
                data: { status: 'INVESTIGATING' }
            });
        }

        res.json({ message: 'Rapid Response Team has been dispatched and logged.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/alert-vendors', authenticatePolice, async (req, res) => {
    try {
        const { imei, brand, model, location } = req.body;
        if (!imei) return res.status(400).json({ error: 'IMEI is required' });

        const subject = `🚨 STOLEN DEVICE ALERT: ${brand} ${model}`;
        const body = `Attention all vendors: A device with IMEI ${imei} (${brand} ${model}) was recently tracked near ${location || 'your area'}. DO NOT attempt to purchase or service this device. Contact law enforcement immediately if it appears in your shop.`;

        // Broadcast message to all vendors
        await prisma.message.create({
            data: {
                senderId: req.user.id,
                receiverRole: 'VENDOR',
                subject,
                body
            }
        });

        res.json({ message: 'Alert broadcasted to all registered vendors in the network.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
