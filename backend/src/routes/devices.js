const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = 'supersecret_pts_dev_key';

// Middleware to verify JWT
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

// Register a new device (Vendors only)
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { imei, serialNumber, brand, model } = req.body;

        if (!imei || !brand || !model) {
            return res.status(400).json({ error: 'IMEI, brand, and model are required' });
        }

        // Check if IMEI already exists
        const existingDevice = await prisma.device.findUnique({ where: { imei } });
        if (existingDevice) {
            return res.status(400).json({ error: 'Device with this IMEI already registered' });
        }

        const device = await prisma.device.create({
            data: {
                imei,
                serialNumber,
                brand,
                model,
                registeredOwnerId: req.user.id
            }
        });

        // Generate Digital Device Ownership Certificate (DDOC)
        const crypto = require('crypto');
        const ddocHash = crypto.createHash('sha256').update(`${device.id}-${req.user.id}-${Date.now()}`).digest('hex');

        const certificate = await prisma.certificate.create({
            data: {
                deviceId: device.id,
                ownerId: req.user.id,
                qrHash: ddocHash
            }
        });

        res.status(201).json({ message: 'Device registered successfully', device, certificate });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Verify device by IMEI (Public endpoint)
router.get('/verify/:imei', async (req, res) => {
    try {
        const { imei } = req.params;
        const device = await prisma.device.findUnique({
            where: { imei },
            include: {
                registeredOwner: {
                    select: { companyName: true, email: true }
                }
            }
        });

        if (!device) {
            return res.status(404).json({ message: 'Device not found in registry. Status unknown.' });
        }

        // Dynamically calculate the Device's Trust Index
        const RiskEngine = require('../services/RiskEngine');
        const riskScore = await RiskEngine.calculateDeviceTrustIndex(imei);

        res.json({
            device: {
                imei: device.imei,
                brand: device.brand,
                model: device.model,
                status: device.status,
                riskScore,
                registeredBy: device.registeredOwner.companyName || 'Private Owner'
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Report device as stolen (Owner only)
router.post('/:imei/report', authenticateToken, async (req, res) => {
    try {
        const { imei } = req.params;
        const { status } = req.body; // STOLEN or LOST

        if (!['STOLEN', 'LOST'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const device = await prisma.device.findUnique({ where: { imei } });
        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }

        if (device.registeredOwnerId !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized to report this device' });
        }

        const updatedDevice = await prisma.device.update({
            where: { imei },
            data: { status }
        });

        res.json({ message: `Device marked as ${status}`, device: updatedDevice });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update Device Tracking Location (Ping)
router.post('/:imei/track', async (req, res) => {
    try {
        const { imei } = req.params;
        const { location, ip } = req.body;

        if (!location) {
            return res.status(400).json({ error: 'Location coordinates required' });
        }

        const device = await prisma.device.findUnique({ where: { imei } });
        if (!device) return res.status(404).json({ error: 'Device not found' });

        const updatedDevice = await prisma.device.update({
            where: { imei },
            data: {
                lastKnownLocation: location,
                lastKnownIp: ip || req.ip,
                lastLocationUpdate: new Date()
            }
        });

        res.json({ message: 'Device location updated securely', lastUpdate: updatedDevice.lastLocationUpdate });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
