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

// GET Device Passport (Full Transaction History)
router.get('/:imei', authenticateToken, async (req, res) => {
    try {
        const { imei } = req.params;

        const device = await prisma.device.findUnique({
            where: { imei },
            include: {
                history: {
                    orderBy: { createdAt: 'desc' },
                    include: {
                        actor: {
                            select: { email: true, companyName: true, role: true }
                        }
                    }
                },
                registeredOwner: {
                    select: { email: true, companyName: true, vendorTier: true }
                },
                maintenance: {
                    orderBy: { serviceDate: 'desc' },
                    include: { vendor: { select: { companyName: true, email: true, fullName: true, vendorTier: true } } }
                }
            }
        });

        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }

        // Authorization check: Only relevant parties or Police/Admin can see the full passport
        // For prototype, we allow owner, police, and registrant vendor.
        const isAuthorized =
            device.registeredOwnerId === req.user.id ||
            req.user.role === 'POLICE' ||
            req.user.role === 'ADMIN';

        if (!isAuthorized) {
            return res.status(403).json({ error: 'Unauthorized to view full device passport history' });
        }

        res.json({
            device: {
                imei: device.imei,
                brand: device.brand,
                model: device.model,
                status: device.status,
                riskScore: device.riskScore,
                devicePhotoUrl: device.devicePhotoUrl,
                currentOwner: device.registeredOwner
            },
            passport: device.history,
            maintenance: device.maintenance
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET Proof of Sale (Digital Certificate)
router.get('/:imei/proof-of-sale', authenticateToken, async (req, res) => {
    try {
        const { imei } = req.params;
        const proofs = await prisma.proofOfSale.findMany({
            where: { device: { imei } },
            include: {
                vendor: { select: { companyName: true, email: true } },
                buyer: { select: { email: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ proofs });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
