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
                device: { select: { imei: true, brand: true, model: true } },
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

module.exports = router;
