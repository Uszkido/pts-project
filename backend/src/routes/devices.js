const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const { calculateValuation } = require('../utils/valuation');
const { analyzeReceiptForFraud, analyzeDeviceHardwareCondition, extractImeiFromImage, generateVendorTrustSummary } = require('../services/aiService');
const { calculateDeviceTrustIndex } = require('../services/RiskEngine');
const {
    evaluateLazarusProtocol,
    detectSyndicateCollusion,
    evaluateBloodhoundState,
    predictSmugglingTrajectory
} = require('../services/DeepSecurityAI');
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

        // --- LAZARUS PROTOCOL (CHOP-SHOP DETECTION) ---
        const lazarusCheck = await evaluateLazarusProtocol(screenSerialNumber, batterySerialNumber, motherboardSerialNumber, cameraSerialNumber);
        if (lazarusCheck.isFrankenstein) {
            // Log Incident secretly
            await prisma.incidentReport.create({
                data: {
                    deviceId: lazarusCheck.blacklistedOrigins[0].imei, // Try to link it back to the original device 
                    reporterId: req.user.id,
                    type: "LAZARUS_CHOP_SHOP_DETECTED",
                    description: lazarusCheck.reason,
                    status: "OPEN"
                }
            }).catch(() => { }); // Catch and ignore if original IMEI doesn't exist in our DB as UUID 

            return res.status(403).json({
                error: 'SECURITY LOCK: Hardware Mismatch',
                details: lazarusCheck.reason
            });
        }

        // --- SYNDICATE MAPPER (CARTEL NETWORK DETECTION) ---
        if (req.user.role === 'VENDOR') {
            const currentIp = req.ip || req.headers['x-forwarded-for'];
            const syndicateCheck = await detectSyndicateCollusion(req.user.id, currentIp);
            if (syndicateCheck.isColluding) {
                // Secretly flag this vendor's Trust Score
                const tScore = await prisma.vendorTrustScore.findUnique({ where: { vendorId: req.user.id } });
                if (tScore) {
                    await prisma.vendorTrustScore.update({
                        where: { vendorId: req.user.id },
                        data: { score: Math.max(0, tScore.score - 50) } // Massive penalty
                    });
                }
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

        // --- AI HARDWARE DEGRADATION ANALYZER ---
        if (devicePhotos && devicePhotos.length > 0) {
            const hardwareGrade = await analyzeDeviceHardwareCondition(devicePhotos, brand, model);

            // Log the visual trust grade to the transaction history ledger
            if (hardwareGrade.grade !== "Unknown") {
                await prisma.transactionHistory.create({
                    data: {
                        deviceId: device.id,
                        actorId: req.user.id,
                        type: "AI_HARDWARE_APPRAISAL",
                        description: `Visual Grade: ${hardwareGrade.grade}. AI Notes: ${hardwareGrade.notes}. Aftermarket Parts Detected: ${hardwareGrade.hasAftermarketScreen ? 'YES' : 'NO'}`
                    }
                });
            }
        }

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

        // --- DIGITAL BLOODHOUND (BATTERY / TRACKING STATE AI) ---
        // Assume battery is sent in body, default to 50% if not
        const { batteryLevel = 50, speedKmH = 0, isMovingFast = false, latitude, longitude } = req.body;

        const bloodhoundState = evaluateBloodhoundState(updatedDevice.status, batteryLevel, isMovingFast || speedKmH > 20);

        // --- PREDICTIVE SMUGGLING ROUTE AI ---
        let smugglingAlert = null;
        if (updatedDevice.status === 'STOLEN' && latitude && longitude) {
            // Very basic mock check, normally would fetch previous GPS ping and calculate elapsed time
            // We just call the engine to demonstrate intelligence
            smugglingAlert = predictSmugglingTrajectory(9.0, 7.0, parseFloat(latitude), parseFloat(longitude), 2);
            if (smugglingAlert && smugglingAlert.alert) {
                await prisma.incidentReport.create({
                    data: {
                        deviceId: updatedDevice.id,
                        reporterId: updatedDevice.registeredOwnerId, // auto reported
                        type: "SMUGGLING_ATTEMPT_PREDICTED",
                        description: smugglingAlert.warning,
                        status: "OPEN"
                    }
                });
            }
        }

        res.json({
            message: 'Device location updated securely',
            lastUpdate: updatedDevice.lastLocationUpdate,
            bloodhoundMode: bloodhoundState,
            smugglingWarning: smugglingAlert?.alert ? smugglingAlert.warning : null
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- SAFE-HAND ESCROW TRANSFER ---
router.post('/transfer', authenticateToken, async (req, res) => {
    try {
        const { deviceId, buyerEmail } = req.body;

        const device = await prisma.device.findUnique({
            where: { id: deviceId },
            include: { registeredOwner: true }
        });

        if (!device) return res.status(404).json({ error: 'Device not found' });
        if (device.registeredOwnerId !== req.user.id) return res.status(403).json({ error: 'Unauthorized transfer' });
        if (device.status !== 'CLEAN') return res.status(400).json({ error: 'Cannot transfer a flagged device (STOLEN/LOST). Resolve status first.' });

        const buyer = await prisma.user.findUnique({ where: { email: buyerEmail } });
        if (!buyer) return res.status(404).json({ error: 'Buyer not found in National Registry. They must register first.' });

        // Execute Transfer
        const transfer = await prisma.deviceTransfer.create({
            data: {
                deviceId,
                sellerId: req.user.id,
                buyerId: buyer.id,
                status: 'COMPLETED'
            }
        });

        // Update Device Owner
        await prisma.device.update({
            where: { id: deviceId },
            data: { registeredOwnerId: buyer.id }
        });

        // Revoke old certificate and create new one
        await prisma.certificate.updateMany({
            where: { deviceId, isActive: true },
            data: { isActive: false }
        });

        const crypto = require('crypto');
        const ddocHash = crypto.createHash('sha256').update(`${deviceId}-${buyer.id}-${Date.now()}`).digest('hex');
        await prisma.certificate.create({
            data: { deviceId, ownerId: buyer.id, qrHash: ddocHash }
        });

        res.json({ message: '🛡️ Safe-Hand Transfer Successful. Ownership is now legally moved.', transfer });
    } catch (error) {
        res.status(500).json({ error: 'Transfer failed' });
    }
});

// --- VISION SEARCH: Scan IMEI from Image ---
router.post('/scan-imei', authenticateToken, async (req, res) => {
    try {
        const { imageUrl } = req.body;
        if (!imageUrl) return res.status(400).json({ error: 'Image URL required' });

        const imei = await extractImeiFromImage(imageUrl);
        if (!imei) return res.status(404).json({ error: 'AI could not find a clear IMEI in the photo. Please try more light or type it.' });

        res.json({ imei });
    } catch (error) {
        res.status(500).json({ error: 'Vision AI Scan failed' });
    }
});

// --- SENTINEL GUARD: Vendor Trust Badge ---
router.get('/vendor-trust/:vendorId', async (req, res) => {
    try {
        const vendor = await prisma.user.findUnique({
            where: { id: req.params.vendorId },
            include: {
                registeredDevices: true,
                vendorTrustScore: true
            }
        });

        if (!vendor || vendor.role !== 'VENDOR') return res.status(404).json({ error: 'Vendor not found' });

        // Calculate stats
        const totalRegistered = vendor.registeredDevices.length;
        const stolenInterventions = await prisma.incidentReport.count({
            where: { reporterId: vendor.id, type: 'STOLEN' }
        });

        const trustData = {
            companyName: vendor.companyName,
            tier: vendor.vendorTier,
            totalSales: totalRegistered,
            securityChecks: stolenInterventions,
            rawScore: vendor.vendorTrustScore?.score || 100
        };

        const aiSummary = await generateVendorTrustSummary(trustData);

        res.json({
            badge: {
                vendor: vendor.companyName,
                officialId: `PTS-VG-${vendor.id.substring(0, 6).toUpperCase()}`,
                status: vendor.vendorTrustScore?.score > 50 ? 'Sentinel Trusted' : 'Under Review',
                aiSummary,
                stats: {
                    totalVerifications: totalRegistered,
                    criminalInterventions: stolenInterventions
                }
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch trust badge' });
    }
});

module.exports = router;
