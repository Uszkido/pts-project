const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = 'supersecret_pts_dev_key';

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Report a lost/stolen device (Consumer only)
router.post('/report', authenticateToken, async (req, res) => {
    try {
        const { deviceId, type, location, description, policeReportNo, incidentDate, evidenceUrls } = req.body;

        if (!['LOST', 'STOLEN', 'SNATCHED', 'FRAUD'].includes(type)) {
            return res.status(400).json({ error: 'Invalid incident type' });
        }

        const device = await prisma.device.findUnique({
            where: { id: deviceId },
            include: { certificates: { where: { isActive: true } } }
        });

        if (!device) return res.status(404).json({ error: 'Device not found' });
        if (device.registeredOwnerId !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

        // Create Report
        const report = await prisma.incidentReport.create({
            data: {
                deviceId,
                reporterId: req.user.id,
                type,
                location,
                description,
                policeReportNo,
                incidentDate: incidentDate ? new Date(incidentDate) : new Date(),
                evidenceUrls: evidenceUrls || []
            }
        });

        // Update Device Status & Tank Risk Score
        const newStatus = ['STOLEN', 'SNATCHED', 'FRAUD'].includes(type) ? 'STOLEN' : 'LOST';
        await prisma.device.update({
            where: { id: deviceId },
            data: { status: newStatus, riskScore: 0 }
        });

        // Revoke active DDOC
        if (device.certificates.length > 0) {
            await prisma.certificate.update({
                where: { id: device.certificates[0].id },
                data: { isActive: false }
            });
        }

        res.status(201).json({ message: 'Incident reported successfully. Device locked.', report });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Emergency Freeze (1-click lock)
router.post('/emergency-freeze', authenticateToken, async (req, res) => {
    try {
        const { deviceId } = req.body;

        const device = await prisma.device.findUnique({
            where: { id: deviceId },
            include: { certificates: { where: { isActive: true } } }
        });

        if (!device || device.registeredOwnerId !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized to freeze this device' });
        }

        await prisma.device.update({
            where: { id: deviceId },
            data: { status: 'INVESTIGATING', riskScore: 10 }
        });

        if (device.certificates.length > 0) {
            await prisma.certificate.update({
                where: { id: device.certificates[0].id },
                data: { isActive: false }
            });
        }

        // Auto-generate a brief incident report
        await prisma.incidentReport.create({
            data: {
                deviceId,
                reporterId: req.user.id,
                type: 'LOST',
                description: 'Emergency Freeze Initiated via Consumer Dashboard',
                status: 'OPEN'
            }
        });

        res.json({ message: 'Emergency Freeze Activated. Device flagged and certificate revoked.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
