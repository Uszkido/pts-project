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

// Initiate an ownership transfer
router.post('/initiate', authenticateToken, async (req, res) => {
    try {
        const { deviceId, buyerEmail } = req.body;

        // Ensure device belongs to the sender
        const device = await prisma.device.findUnique({ where: { id: deviceId } });
        if (!device || device.registeredOwnerId !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized. You do not own this device.' });
        }

        // Find the buyer
        const buyer = await prisma.user.findUnique({ where: { email: buyerEmail } });
        if (!buyer) {
            return res.status(404).json({ error: 'Buyer not found. They must register for a PTS account first.' });
        }

        // Create transfer record
        const transfer = await prisma.ownershipTransfer.create({
            data: {
                deviceId,
                sellerId: req.user.id,
                buyerId: buyer.id,
                status: 'PENDING'
            }
        });

        res.json({ message: 'Transfer initiated. Awaiting buyer confirmation.', transfer });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Accept a transfer
router.post('/accept/:transferId', authenticateToken, async (req, res) => {
    try {
        const { transferId } = req.params;

        // Transaction to ensure atomicity
        const result = await prisma.$transaction(async (tx) => {
            const transfer = await tx.ownershipTransfer.findUnique({ where: { id: transferId } });
            if (!transfer || transfer.buyerId !== req.user.id || transfer.status !== 'PENDING') {
                throw new Error('Invalid or unauthorized transfer request.');
            }

            // 1. Mark transfer as completed
            await tx.ownershipTransfer.update({
                where: { id: transferId },
                data: { status: 'COMPLETED' }
            });

            // 2. Update device owner
            await tx.device.update({
                where: { id: transfer.deviceId },
                data: { registeredOwnerId: req.user.id }
            });

            // 3. Invalidate old certificate(s)
            await tx.certificate.updateMany({
                where: { deviceId: transfer.deviceId, isActive: true },
                data: { isActive: false }
            });

            // 4. Issue new certificate (DDOC)
            const crypto = require('crypto');
            const ddocHash = crypto.createHash('sha256').update(`${transfer.deviceId}-${req.user.id}-${Date.now()}`).digest('hex');

            const newCertificate = await tx.certificate.create({
                data: {
                    deviceId: transfer.deviceId,
                    ownerId: req.user.id,
                    qrHash: ddocHash
                }
            });

            // 5. Log in Transaction Ledger
            await tx.transactionHistory.create({
                data: {
                    deviceId: transfer.deviceId,
                    actorId: req.user.id,
                    type: 'TRANSFER',
                    description: `Ownership transferred from ${transfer.sellerId} to ${req.user.email}`,
                    metadata: JSON.stringify({ transferId: transfer.id, sellerId: transfer.sellerId })
                }
            });

            return newCertificate;
        });

        res.json({ message: 'Transfer successful. New DDOC issued.', certificate: result });
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: error.message || 'Error processing transfer' });
    }
});

module.exports = router;
