const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

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

// Dual Registration Endpoint (Vendor-First or Consumer-Direct)
router.post('/register', authenticateToken, async (req, res) => {
    try {
        const { imei, serialNumber, brand, model, customerEmail } = req.body;

        if (!imei || !brand || !model) {
            return res.status(400).json({ error: 'IMEI, brand, and model are required' });
        }

        // 1. Conflict Check / Duplicate Prevention
        const existingDevice = await prisma.device.findUnique({ where: { imei } });
        if (existingDevice) {
            return res.status(400).json({
                error: 'Ownership Conflict: Device already registered in the National Registry.',
                conflictStatus: existingDevice.status
            });
        }

        let device;
        let certificate;
        let proofOfSale;

        // Use transaction for atomic registration and ledger logging
        await prisma.$transaction(async (tx) => {
            // Determine initial status and owner
            let initialStatus = 'CLEAN';
            let ownerId = req.user.id; // Default to registrant

            if (req.user.role === 'VENDOR') {
                if (customerEmail) {
                    // Direct-to-Customer Sale flow
                    const customer = await tx.user.findUnique({ where: { email: customerEmail } });
                    if (!customer) throw new Error('Customer account not found. Customer must register with PTS first.');
                    ownerId = customer.id;
                    initialStatus = 'CLEAN';
                } else {
                    // In-Stock Vendor Inventory
                    initialStatus = 'VENDOR_HELD';
                }
            }

            // 2. Create Device
            device = await tx.device.create({
                data: {
                    imei,
                    serialNumber,
                    brand,
                    model,
                    status: initialStatus,
                    registeredOwnerId: ownerId
                }
            });

            // 3. Issue Ownership Certificate
            const ddocHash = crypto.createHash('sha256').update(`${device.id}-${ownerId}-${Date.now()}`).digest('hex');
            certificate = await tx.certificate.create({
                data: {
                    deviceId: device.id,
                    ownerId: ownerId,
                    qrHash: ddocHash
                }
            });

            // 4. Log in Transaction Ledger (Immutable History)
            await tx.transactionHistory.create({
                data: {
                    deviceId: device.id,
                    actorId: req.user.id,
                    type: 'REGISTRATION',
                    description: customerEmail
                        ? `Vendor ${req.user.email} registered and sold device directly to ${customerEmail}`
                        : `${req.user.role} ${req.user.email} registered device to registry.`,
                    metadata: JSON.stringify({
                        method: customerEmail ? 'DIRECT_SALE' : 'INVENTORY_LOAD',
                        role: req.user.role,
                        initialStatus
                    })
                }
            });

            // 5. If it's a direct-to-customer sale, create a Proof of Sale
            if (req.user.role === 'VENDOR' && customerEmail) {
                proofOfSale = await tx.proofOfSale.create({
                    data: {
                        deviceId: device.id,
                        vendorId: req.user.id,
                        buyerId: ownerId, // the customer we found
                        signedByVendor: true, // Auto-signed by vendor on successful API call
                        transactionRef: `TRAN-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
                    }
                });
            }
        });

        res.status(201).json({
            message: 'Device Lifecycle Initialized',
            device,
            certificate,
            proofOfSale
        });

    } catch (error) {
        console.error(error);
        res.status(400).json({ error: error.message || 'Error initializing device lifecycle' });
    }
});

module.exports = router;
