const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const { calculateValuation } = require('../utils/valuation');
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

// Vendor triggers a Priority 1 Emergency Alert (Direct Police Contact)
router.post('/emergency-alert', authenticateToken, verifyVendorRole, async (req, res) => {
    try {
        const { imei, description, location } = req.body;

        const device = await prisma.device.findUnique({ where: { imei } });

        // 1. Create the alert record
        const alert = await prisma.vendorSuspiciousAlert.create({
            data: {
                deviceId: device ? device.id : undefined, // Might be an unregistered device
                vendorId: req.user.id,
                description: `🚨 EMERGENCY POLICE REQUEST: ${description} @ ${location}`,
            }
        });

        // 2. Send HIGH PRIORITY message to all Police
        await prisma.message.create({
            data: {
                senderId: req.user.id,
                receiverRole: 'POLICE',
                subject: `🚨 PRIORITY 1: Vendor Assistance Required`,
                body: `Vendor "${req.user.companyName}" (ID: ${req.user.id}) has triggered a RAPID INTERVENTION alert.\n\nLocation: ${location}\nDevice IMEI: ${imei || 'N/A'}\nSituation: ${description}\n\nPlease dispatch the nearest unit.`,
            }
        });

        // 3. Log the deployment request
        if (device) {
            await prisma.transactionHistory.create({
                data: {
                    deviceId: device.id,
                    actorId: req.user.id,
                    type: 'TEAM_DEPLOYED',
                    description: `Vendor requested immediate law enforcement intervention at their shop location.`,
                    metadata: JSON.stringify({ location, vendor: req.user.companyName })
                }
            });
        }

        res.status(201).json({
            message: 'EMERGENCY SIGNAL TRANSMITTED. Stay calm. Law enforcement has been notified of your location.',
            alertId: alert.id
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to transmit emergency signal.' });
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
                devicePhotos: true,
                maintenance: true,
                createdAt: true
            },
            orderBy: { createdAt: 'desc' }
        });

        // Calculate valuations for each item
        const inventoryWithValuation = inventory.map(device => ({
            ...device,
            estimatedValue: calculateValuation(device)
        }));

        // 3. Fetch Sales History (Ownership Transfers where vendor is seller)
        const sales = await prisma.ownershipTransfer.findMany({
            where: { sellerId: vendorId, status: 'COMPLETED' },
            include: {
                device: {
                    select: { imei: true, brand: true, model: true, devicePhotos: true }
                },
                buyer: {
                    select: { email: true }
                }
            },
        });

        // 4. Fetch Pending Transfers (Devices being sent to the vendor)
        const pendingTransfers = await prisma.ownershipTransfer.findMany({
            where: { buyerId: vendorId, status: 'PENDING' },
            include: {
                device: {
                    select: { imei: true, brand: true, model: true }
                },
                seller: {
                    select: { email: true, companyName: true }
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
            inventory: inventoryWithValuation,
            sales,
            pendingTransfers
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error while fetching dashboard data' });
    }
});

router.get('/messages', authenticateToken, verifyVendorRole, async (req, res) => {
    try {
        const messages = await prisma.message.findMany({
            where: {
                OR: [
                    { receiverId: req.user.id },
                    { receiverRole: 'VENDOR' },
                    { receiverRole: 'ALL' }
                ]
            },
            include: { sender: { select: { email: true, fullName: true, role: true } } },
            orderBy: { createdAt: 'desc' },
            take: 20
        });
        res.json({ messages });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error while fetching messages' });
    }
});

router.get('/nearby-risks', authenticateToken, verifyVendorRole, async (req, res) => {
    try {
        const vendor = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { shopLatitude: true, shopLongitude: true }
        });

        if (!vendor || !vendor.shopLatitude) {
            return res.json({ risks: [] });
        }

        // Simplistic nearby search (square bounding box)
        const range = 0.5; // roughly 50km
        const observations = await prisma.observationReport.findMany({
            where: {
                latitude: { gte: vendor.shopLatitude - range, lte: vendor.shopLatitude + range },
                longitude: { gte: vendor.shopLongitude - range, lte: vendor.shopLongitude + range }
            },
            include: {
                device: { select: { imei: true, brand: true, model: true, status: true } }
            },
            take: 20,
            orderBy: { createdAt: 'desc' }
        });

        res.json({ risks: observations });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Vendor Bulk Import (Inventory Scaling for Major Retailers)
router.post('/devices/bulk-import', authenticateToken, verifyVendorRole, async (req, res) => {
    try {
        const { devices } = req.body;

        if (!Array.isArray(devices) || devices.length === 0) {
            return res.status(400).json({ error: 'Payload must contain a non-empty array of devices.' });
        }

        // Vendor limit is 5000 to prevent tier-abuse, unlike Admins who get 50,000
        if (devices.length > 5000) {
            return res.status(413).json({ error: 'Vendor bulk import limit is 5,000 devices per batch.' });
        }

        console.log(`📦 VENDOR B2B LOAD: Retailer ${req.user.companyName || req.user.id} uploading ${devices.length} devices.`);

        // Efficient transaction mapping
        const batchPayload = devices.map(d => ({
            imei: String(d.imei).trim(),
            brand: d.brand || 'Unknown',
            model: d.model || 'Unknown',
            registeredOwnerId: req.user.id, // CRITICAL: Force Vendor ID so they cannot register devices to others
            status: 'CLEAN',
            riskScore: 100
        }));

        const result = await prisma.device.createMany({
            data: batchPayload,
            skipDuplicates: true // Will skip if IMEI belongs to someone else or is already in DB
        });

        res.status(201).json({
            message: `Vendor inventory bulk operation completed successfully.`,
            importedCount: result.count,
            skippedCount: devices.length - result.count
        });
    } catch (error) {
        console.error('Vendor Bulk Import Error:', error);
        res.status(500).json({ error: 'Database error during inventory mass injection.' });
    }
});

module.exports = router;
