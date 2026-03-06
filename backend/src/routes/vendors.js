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

// Vendor Dashboard Analytics & Data
router.get('/dashboard', authenticateToken, verifyVendorRole, async (req, res) => {
    try {
        const vendorId = req.user.id;

        // 1. Fetch Vendor Profile & Trust Score
        const profile = await prisma.user.findUnique({
            where: { id: vendorId },
            select: {
                id: true,
                email: true,
                companyName: true,
                vendorTier: true,
                trustScore: {
                    select: {
                        score: true,
                        completedSales: true,
                        flaggedDevices: true
                    }
                }
            }
        });

        // 2. Fetch Active Inventory (Devices currently owned by the vendor)
        const inventory = await prisma.device.findMany({
            where: { registeredOwnerId: vendorId },
            select: {
                id: true,
                imei: true,
                brand: true,
                model: true,
                status: true,
                riskScore: true,
                createdAt: true
            },
            orderBy: { createdAt: 'desc' }
        });

        // 3. Fetch Sales History (Ownership Transfers where vendor is seller)
        const sales = await prisma.ownershipTransfer.findMany({
            where: { sellerId: vendorId, status: 'COMPLETED' },
            include: {
                device: {
                    select: { imei: true, brand: true, model: true }
                },
                buyer: {
                    select: { email: true }
                }
            },
            orderBy: { transferDate: 'desc' }
        });

        res.json({
            profile,
            metrics: {
                totalInventory: inventory.length,
                totalSales: sales.length,
                trustScore: profile.trustScore?.score || 100
            },
            inventory,
            sales
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error while fetching dashboard data' });
    }
});

module.exports = router;
