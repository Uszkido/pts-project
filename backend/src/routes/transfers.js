const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const prisma = require('../db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'supersecret_pts_dev_key';
const { checkPatternOfLifeAnomaly } = require('../services/fraudEngine');

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
        const { deviceId, buyerEmail, price, useEscrow, escrowAmount } = req.body;

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

        // --- AI Pattern of Life Lock (Account Takeover Protection) ---
        // Prevents a thief who stole a logged-in phone from transferring devices to themselves
        const currentIp = req.ip || req.headers['x-forwarded-for'];
        const pOLCheck = await checkPatternOfLifeAnomaly(req.user.id, currentIp);

        if (pOLCheck.anomalyDetected) {
            return res.status(403).json({
                error: 'SECURITY LOCK: Pattern of Life Anomaly',
                details: pOLCheck.reason,
                requiresSelfieVerification: true
            });
        }

        // Generate 6-digit Handover Code (2FA)

        const handoverCode = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 chars
        const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours validity

        // Create transfer record
        const transfer = await prisma.ownershipTransfer.create({
            data: {
                deviceId,
                sellerId: req.user.id,
                buyerId: buyer.id,
                handoverCode,
                expiresAt,
                status: 'PENDING',
                price,
                isEscrowEnabled: !!useEscrow,
                escrowStatus: useEscrow ? 'LOCKED' : 'NONE',
                escrowAmount: useEscrow ? parseFloat(escrowAmount) || 0 : null
            }
        });

        res.json({
            message: useEscrow
                ? 'Transfer initiated with P2P Escrow. Funds are SECURED. Give this Handover Code to the buyer: ' + handoverCode
                : 'Transfer initiated. Give this Handover Code to the buyer: ' + handoverCode,
            handoverCode,
            transfer
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get pending transfers for the logged in user (as buyer)
router.get('/pending', authenticateToken, async (req, res) => {
    try {
        const pending = await prisma.ownershipTransfer.findMany({
            where: {
                buyerId: req.user.id,
                status: 'PENDING',
                expiresAt: { gt: new Date() }
            },
            include: {
                device: true,
                seller: {
                    select: { fullName: true, email: true, companyName: true }
                }
            }
        });
        res.json({ pending });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch pending transfers' });
    }
});

// Accept a transfer
router.post('/accept/:transferId', authenticateToken, async (req, res) => {
    try {
        const { transferId } = req.params;
        const { handoverCode } = req.body; // 2FA code required

        if (!handoverCode) {
            return res.status(400).json({ error: 'Handover Code is required to complete the 2FA transfer.' });
        }

        // Transaction to ensure atomicity
        const result = await prisma.$transaction(async (tx) => {
            const transfer = await tx.ownershipTransfer.findUnique({ where: { id: transferId } });

            if (!transfer || transfer.buyerId !== req.user.id || transfer.status !== 'PENDING') {
                throw new Error('Invalid or unauthorized transfer request.');
            }

            // Verify Handover Code
            if (transfer.handoverCode !== handoverCode.toUpperCase()) {
                throw new Error('Incorrect Handover Code. 2FA verification failed.');
            }

            // Verify Expiry
            if (transfer.expiresAt && transfer.expiresAt < new Date()) {
                throw new Error('Transfer request has expired. Seller must re-initiate.');
            }

            // 1. Mark transfer as completed (and release escrow if enabled)
            await tx.ownershipTransfer.update({
                where: { id: transferId },
                data: {
                    status: 'COMPLETED',
                    escrowStatus: transfer.isEscrowEnabled ? 'RELEASED' : 'NONE'
                }
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
                    description: transfer.isEscrowEnabled
                        ? `Ownership transferred and ESCROW FUNDS RELEASED to seller. Secure handover complete.`
                        : `Ownership transferred from ${transfer.sellerId} to ${req.user.email}`,
                    metadata: JSON.stringify({
                        transferId: transfer.id,
                        sellerId: transfer.sellerId,
                        escrowEnabled: transfer.isEscrowEnabled,
                        escrowAmount: transfer.escrowAmount
                    })
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
