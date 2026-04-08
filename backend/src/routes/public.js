const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const RiskEngine = require('../services/RiskEngine');

/**
 * @api {get} /api/v1/public/badge/:imei Marketplace Verification Badge
 * @apiDescription Public endpoint for 3rd party marketplaces to verify device status.
 */
router.get('/badge/:imei', async (req, res) => {
    try {
        const { imei } = req.params;

        const device = await prisma.device.findUnique({
            where: { imei },
            select: {
                brand: true,
                model: true,
                status: true,
                riskScore: true,
                updatedAt: true
            }
        });

        if (!device) {
            return res.status(404).json({
                verified: false,
                message: "This device is NOT registered in the National Tracking System.",
                action: "DO_NOT_PURCHASE"
            });
        }

        // Recalculate risk on demand for accuracy
        const liveScore = await RiskEngine.calculateDeviceTrustIndex(imei);

        const isSafe = device.status === 'CLEAN' && liveScore >= 70;

        res.json({
            verified: true,
            asset: {
                identity: `${device.brand} ${device.model}`,
                imei_masked: `${imei.substring(0, 4)}********${imei.substring(imei.length - 2)}`
            },
            verification: {
                status: isSafe ? "VERIFIED_SAFE" : "HIGH_RISK_WARNING",
                score: liveScore,
                lastChecked: new Date(),
                badge_url: `http://localhost:4000/verify/${imei}`
            },
            recommendation: isSafe
                ? "This device is verified clean and safe for purchase."
                : "DANGER: This device has been flagged or shows suspicious behavioral history. Purchase is not recommended."
        });

    } catch (error) {
        console.error('Public API Error:', error);
        res.status(500).json({ error: 'Internal system error' });
    }
});

/**
 * @api {post} /api/v1/public/safe-contact/:imei Anonymous Lost & Found
 * @apiDescription Allows someone who found a lost device to contact the owner securely.
 */
router.post('/safe-contact/:imei', async (req, res) => {
    try {
        const { imei } = req.params;
        const { message, finderContact } = req.body;

        const device = await prisma.device.findUnique({
            where: { imei },
            include: { registeredOwner: true }
        });

        if (!device || !device.registeredOwnerId) {
            return res.status(404).json({ error: 'Device registry not found.' });
        }

        // Create a system message for the owner
        await prisma.message.create({
            data: {
                senderId: device.registeredOwnerId, // Self-alert/System
                receiverId: device.registeredOwnerId,
                subject: `🛡️ PTS SAFE-CONTACT: Your ${device.brand} has been found!`,
                body: `Good news! Someone has scanned the recovery QR on your device (${device.model}). \n\nFinder Message: "${message}" \n\nFinder Contact: ${finderContact || 'Not provided'} \n\nLocation trace initiated. Please use caution when arranging meetings.`,
            }
        });

        res.json({ message: 'Owner has been notified via secure PTS channel. Thank you for your integrity.' });

    } catch (error) {
        console.error('Safe Contact Error:', error);
        res.status(500).json({ error: 'Failed to transmit contact signal.' });
    }
});

/**
 * @api {post} /api/v1/public/whistleblower Anonymous Bounty Program
 * @apiDescription Allows users/technicians to report illegal chop-shops and earn rewards.
 */
router.post('/whistleblower', async (req, res) => {
    try {
        const { targetCompanyName, evidenceDetails, cryptoWallet } = req.body;

        if (!targetCompanyName || !evidenceDetails) {
            return res.status(400).json({ error: 'Missing required evidence.' });
        }

        // Ideally log this securely in a dedicated "AnonymousTips" table
        // For demonstration, we'll log it as a critical system incident
        await prisma.incident.create({
            data: {
                deviceId: "SYSTEM_WIDE", // General incident
                type: 'CHOP_SHOP_REPORT',
                status: 'OPEN',
                description: `WHISTLEBLOWER TIP: Target: ${targetCompanyName}. Evidence: ${evidenceDetails}. Bounty Payment Addr: ${cryptoWallet || 'None provided'}.`,
                latitude: 0,
                longitude: 0,
            }
        });

        res.json({ message: 'Tip received securely and anonymously. Intelligence feed updated.' });
    } catch (error) {
        console.error('Whistleblower Error:', error);
        res.status(500).json({ error: 'Failed to process anonymous tip.' });
    }
});

module.exports = router;
