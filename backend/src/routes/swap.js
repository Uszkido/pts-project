const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

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

/**
 * @api {post} /api/v1/swap/initiate Initiate Device Upgrade/Swap
 * Initiated by Vendor. Creates a dual-transfer request.
 */
router.post('/initiate', authenticateToken, verifyVendorRole, async (req, res) => {
    try {
        const { userEmail, userDeviceId, vendorDeviceId, tradeInValue, additionalPayment } = req.body;

        const vendorId = req.user.id;
        const user = await prisma.user.findUnique({ where: { email: userEmail } });
        if (!user) return res.status(404).json({ error: 'Customer not found. They must register with PTS first.' });

        // 1. Verify User Device (Old Phone)
        const userDevice = await prisma.device.findUnique({ where: { id: userDeviceId } });
        if (!userDevice || userDevice.registeredOwnerId !== user.id) {
            return res.status(400).json({ error: 'Device does not belong to this customer.' });
        }
        if (userDevice.status !== 'CLEAN') {
            return res.status(400).json({ error: 'Device is flagged or restricted. Swap blocked.' });
        }

        // 2. Verify Vendor Device (New Phone)
        const vendorDevice = await prisma.device.findUnique({ where: { id: vendorDeviceId } });
        if (!vendorDevice || vendorDevice.registeredOwnerId !== vendorId) {
            return res.status(400).json({ error: 'Upgrade device not found in your inventory.' });
        }

        const handoverCode = crypto.randomBytes(3).toString('hex').toUpperCase();

        // 3. Create Dual Transfers in Transaction
        const result = await prisma.$transaction(async (tx) => {
            // A. Transfer 1: User -> Vendor (Old Device)
            const t1 = await tx.ownershipTransfer.create({
                data: {
                    deviceId: userDeviceId,
                    sellerId: user.id,
                    buyerId: vendorId,
                    handoverCode,
                    status: 'PENDING',
                    price: tradeInValue, // Valuation of the trade-in
                }
            });

            // B. Transfer 2: Vendor -> User (New Device)
            const t2 = await tx.ownershipTransfer.create({
                data: {
                    deviceId: vendorDeviceId,
                    sellerId: vendorId,
                    buyerId: user.id,
                    handoverCode,
                    status: 'PENDING',
                    price: (parseFloat(tradeInValue) + parseFloat(additionalPayment)).toString(),
                }
            });

            // C. Create System Message for User
            await tx.message.create({
                data: {
                    senderId: vendorId,
                    receiverId: user.id,
                    subject: '🔄 SWAP OFFER: Upgrade your device',
                    body: `Vendor ${req.user.companyName} has initiated a swap request. \n\nTrade-in: ${userDevice.brand} ${userDevice.model} \nUpgrade to: ${vendorDevice.brand} ${vendorDevice.model} \nTrade-in Value: ₦${tradeInValue} \nAdditional Payment: ₦${additionalPayment} \n\nVerify the details and provide the code "${handoverCode}" to the vendor if you agree.`,
                }
            });

            return { t1, t2, handoverCode };
        });

        res.status(201).json({
            message: 'Swap workflow initialized. Customer has been notified.',
            handoverCode: result.handoverCode,
            transfers: [result.t1.id, result.t2.id]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to initiate swap.' });
    }
});

/**
 * @api {post} /api/v1/swap/accept-bulk Bulk Accept Swap
 * Customer provides ONE code to complete BOTH transfers.
 */
router.post('/accept-bulk', authenticateToken, async (req, res) => {
    try {
        const { transferIds, handoverCode } = req.body;

        if (!transferIds || transferIds.length !== 2) {
            return res.status(400).json({ error: 'A swap requires exactly two transfer IDs.' });
        }

        const result = await prisma.$transaction(async (tx) => {
            const transfers = await tx.ownershipTransfer.findMany({
                where: { id: { in: transferIds } }
            });

            if (transfers.length !== 2) throw new Error('One or more transfers not found.');

            for (const t of transfers) {
                if (t.status !== 'PENDING') throw new Error('One leg is already completed or cancelled.');
                if (t.handoverCode !== handoverCode.toUpperCase()) throw new Error('Invalid Handover Code for swap leg ' + t.id);
            }

            // Execute all updates
            for (const t of transfers) {
                // 1. Update status
                await tx.ownershipTransfer.update({
                    where: { id: t.id },
                    data: { status: 'COMPLETED' }
                });

                // 2. Swapping ownership
                // Note: t.buyerId is the target owner
                await tx.device.update({
                    where: { id: t.deviceId },
                    data: { registeredOwnerId: t.buyerId }
                });

                // 3. Revoke old certificates
                await tx.certificate.updateMany({
                    where: { deviceId: t.deviceId, isActive: true },
                    data: { isActive: false }
                });

                // 4. Issue new certificates (Generic logic)
                const ddocHash = crypto.createHash('sha256').update(`${t.deviceId}-${t.buyerId}-${Date.now()}`).digest('hex');
                await tx.certificate.create({
                    data: { deviceId: t.deviceId, ownerId: t.buyerId, qrHash: ddocHash }
                });

                // 5. Audit
                await tx.transactionHistory.create({
                    data: {
                        deviceId: t.deviceId,
                        actorId: req.user.id,
                        type: 'TRANSFER',
                        description: `Trade-in swap transfer completed. New owner: ${t.buyerId}`,
                        metadata: JSON.stringify({ swapId: t.id })
                    }
                });
            }

            return { message: 'Swap Success' };
        });

        res.json({ message: 'Swap completed successfully. Both devices transferred.', result });

    } catch (error) {
        console.error(error);
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
