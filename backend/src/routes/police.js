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
                device: { select: { imei: true, brand: true, model: true, lastKnownLocation: true } },
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
                device: { select: { imei: true, brand: true, model: true } },
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

module.exports = router;
