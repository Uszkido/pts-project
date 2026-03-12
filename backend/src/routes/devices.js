const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const { calculateValuation } = require('../utils/valuation');
const { analyzeReceiptForFraud } = require('../services/aiService');
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
        const {
            imei, serialNumber, brand, model, devicePhotos, purchaseReceiptUrl, cartonPhotoUrl,
            screenSerialNumber, batterySerialNumber, motherboardSerialNumber, cameraSerialNumber
        } = req.body;

        if (!imei || !brand || !model) {
            return res.status(400).json({ error: 'IMEI, brand, and model are required' });
        }

        // Check if IMEI already exists
        const existingDevice = await prisma.device.findUnique({ where: { imei } });
        if (existingDevice) {
            return res.status(400).json({ error: 'Device with this IMEI already registered' });
        }

        // --- AI RECEIPT FRAUD DETECTION ---
        if (purchaseReceiptUrl) {
            const receiptAnalysis = await analyzeReceiptForFraud(purchaseReceiptUrl, brand, model);

            // If the AI is highly confident the receipt is a forgery:
            if (receiptAnalysis && receiptAnalysis.isLikelyFake && receiptAnalysis.confidenceScore > 80) {
                // Here we could proactively flag the Vendor or create a suspicious alert
                await prisma.vendorSuspiciousAlert.create({
                    data: {
                        deviceId: "FORGERY_ATTEMPT", // We don't have a device ID yet
                        vendorId: req.user.id,
                        description: `AI flagged purchase receipt as forged/tampered with ${receiptAnalysis.confidenceScore}% confidence. Reason: ${receiptAnalysis.reasonText}`
                    }
                });

                return res.status(400).json({
                    error: 'Receipt Analysis Failed',
                    details: 'The uploaded purchase receipt failed our AI authenticity checks. Please upload a clear, unaltered original receipt.'
                });
            }
        }

        const device = await prisma.device.create({
            data: {
                imei,
                serialNumber,
                brand,
                model,
                registeredOwnerId: req.user.id,
                devicePhotos: devicePhotos || [],
                purchaseReceiptUrl,
                cartonPhotoUrl,
                screenSerialNumber,
                batterySerialNumber,
                motherboardSerialNumber,
                cameraSerialNumber
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
                    select: { id: true, companyName: true, email: true }
                },
                maintenance: {
                    include: {
                        vendor: {
                            select: { vendorTier: true, companyName: true }
                        }
                    },
                    orderBy: { serviceDate: 'desc' }
                },
                incidents: {
                    where: { status: 'OPEN' },
                    select: { bounty: true, type: true }
                },
                transfersAsDevice: {
                    include: {
                        seller: { select: { id: true, companyName: true, email: true, role: true, fullName: true } },
                        buyer: { select: { id: true, companyName: true, email: true, role: true, fullName: true } }
                    },
                    orderBy: { transferDate: 'asc' }
                }
            }
        });

        if (!device) {
            return res.status(404).json({ message: 'Device not found in registry. Status unknown.' });
        }

        // --- REAL-TIME SCAN ALERT ---
        // Log this scan as a notification for the owner
        try {
            await prisma.message.create({
                data: {
                    senderId: device.registeredOwnerId, // System notification
                    receiverId: device.registeredOwnerId,
                    subject: '🚨 SECURITY SIGNAL: Registry Check',
                    body: `Target device ${device.brand} ${device.model} (IMEI: ${device.imei}) was just processed by a verification terminal. Timestamp: ${new Date().toLocaleString()}. Locations: IP Trace logged.`,
                }
            });
        } catch (msgErr) {
            console.error('Failed to log scan alert Message:', msgErr);
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
                registeredBy: device.registeredOwner.companyName || 'Private Owner',
                devicePhotos: device.devicePhotos,
                estimatedValue: calculateValuation({ ...device, riskScore }),
                maintenance: device.maintenance.map(m => ({
                    ...m,
                    isOfficialService: m.vendor.vendorTier <= 2,
                    vendorName: m.vendor.companyName
                })),
                provenance: device.transfersAsDevice.map(t => ({
                    date: t.transferDate,
                    from: t.seller?.companyName || t.seller?.fullName || t.seller?.email,
                    to: t.buyer?.companyName || t.buyer?.fullName || t.buyer?.email,
                    type: t.seller?.role === 'VENDOR' ? 'RETAIL_SALE' : 'P2P_TRANSFER'
                })),
                activeBounty: device.incidents.find(i => i.bounty > 0)?.bounty || null
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
        console.error('Forensic Status Update Failure:', error);
        res.status(500).json({ error: 'Internal server error while updating forensic status' });
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
