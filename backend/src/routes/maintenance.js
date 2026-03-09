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
        if (err) return res.status(403).json({ error: 'Token is invalid' });
        req.user = user;
        next();
    });
};

const isVendor = (req, res, next) => {
    if (req.user.role !== 'VENDOR' && req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Access denied. Vendors only.' });
    }
    next();
};

// Log a new maintenance record
router.post('/log', authenticateToken, isVendor, async (req, res) => {
    try {
        const { deviceId, imei, serviceType, description, partsReplaced, cost, evidenceUrl } = req.body;

        const device = await prisma.device.findUnique({
            where: imei ? { imei } : { id: deviceId }
        });

        if (!device) return res.status(404).json({ error: 'Device not found' });

        const record = await prisma.maintenanceRecord.create({
            data: {
                deviceId: device.id,
                vendorId: req.user.id,
                serviceType: serviceType || 'GENERAL_REPAIR',
                description,
                partsReplaced,
                cost: parseFloat(cost) || 0,
                evidenceUrl,
                serviceDate: new Date()
            }
        });

        // Add to device history
        await prisma.transactionHistory.create({
            data: {
                deviceId: device.id,
                actorId: req.user.id,
                type: 'STATUS_CHANGE',
                description: `🔧 Maintenance Logged: ${serviceType || 'Service'}. ${description}`
            }
        });

        res.json({ message: 'Maintenance record created', record });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get maintenance history for a device
router.get('/history/:imei', async (req, res) => {
    try {
        const { imei } = req.params;
        const device = await prisma.device.findUnique({
            where: { imei },
            include: {
                maintenance: {
                    include: { vendor: { select: { companyName: true, email: true, fullName: true } } },
                    orderBy: { serviceDate: 'desc' }
                }
            }
        });

        if (!device) return res.status(404).json({ error: 'Device not found' });

        res.json({ history: device.maintenance });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
