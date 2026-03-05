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

const verifyVendorRole = (req, res, next) => {
    if (req.user.role !== 'VENDOR') {
        return res.status(403).json({ error: 'Vendor access required' });
    }
    next();
};

// Vendor reports a suspicious seller
router.post('/suspicious-alert', authenticateToken, verifyVendorRole, async (req, res) => {
    try {
        const { imei, sellerEmail, description } = req.body;

        const device = await prisma.device.findUnique({ where: { imei } });
        if (!device) return res.status(404).json({ error: 'Device not found in registry' });

        const alert = await prisma.vendorSuspiciousAlert.create({
            data: {
                deviceId: device.id,
                vendorId: req.user.id,
                sellerEmail,
                description
            }
        });

        // Tank the risk score and flag if it wasn't already stolen
        if (device.status === 'CLEAN') {
            await prisma.device.update({
                where: { id: device.id },
                data: { status: 'INVESTIGATING', riskScore: 0 }
            });
        }

        res.status(201).json({ message: 'Suspicious activity logged and authorities alerted.', alert });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
