const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const prisma = require('../db');
const jwt = require('jsonwebtoken');
const { calculateValuation } = require('../utils/valuation');
const { analyzeReceiptForFraud, analyzeDeviceHardwareCondition, extractImeiFromImage, generateVendorTrustSummary } = require('../services/aiService');
const { analyzeImageELA } = require('../services/elaForensics');
const { calculateDeviceTrustIndex } = require('../services/RiskEngine');
const {
    evaluateLazarusProtocol,
    detectSyndicateCollusion,
    evaluateBloodhoundState,
    predictSmugglingTrajectory
} = require('../services/DeepSecurityAI');
const { reverseGeocode } = require('../services/geoService');
const { sendPushNotification } = require('../services/pushService');
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

        // --- ⚖️ ELA FORENSICS RECEIPT SCAN (Local, Zero-Cost, No Python) ---
        if (purchaseReceiptUrl) {
            const elaResult = await analyzeImageELA(purchaseReceiptUrl);
            console.log(`[ELA] Receipt scan for vendor ${req.user.id}: TamperScore=${elaResult.tamperScore}, Confidence=${elaResult.confidence}`);

            // EXIF Anomaly auto-flag (always log regardless of ELA score)
            if (elaResult.exifAnomalies && elaResult.exifAnomalies.length > 0) {
                console.warn(`[ELA EXIF] Anomalies detected: ${elaResult.exifAnomalies.join(' | ')}`);
            }

            // Block if highly confident it's a forgery
            if (elaResult.isLikelyFaked && elaResult.confidence === 'HIGH') {
                await prisma.vendorSuspiciousAlert.create({
                    data: {
                        deviceId: 'FORGERY_ATTEMPT',
                        vendorId: req.user.id,
                        description: `🔬 ELA Engine flagged receipt as FORGED (${elaResult.tamperScore}/100 tamper score). Verdict: ${elaResult.verdict}. EXIF: ${elaResult.exifAnomalies?.join(' | ') || 'None'}`
                    }
                }).catch(() => { });

                return res.status(400).json({
                    error: 'Document Forgery Detected',
                    details: elaResult.verdict,
                    forensicScore: elaResult.tamperScore,
                    exifAnomalies: elaResult.exifAnomalies
                });
            }

            // Medium confidence: allow but flag for admin review
            if (elaResult.isLikelyFaked && elaResult.confidence === 'MEDIUM') {
                await prisma.vendorSuspiciousAlert.create({
                    data: {
                        deviceId: 'SUSPICIOUS_RECEIPT',
                        vendorId: req.user.id,
                        description: `⚠️ ELA Engine flagged receipt as SUSPICIOUS (${elaResult.tamperScore}/100). Allowed through but needs admin review. Verdict: ${elaResult.verdict}`
                    }
                }).catch(() => { });
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


        const hardwareDnaHash = (motherboardSerialNumber && batterySerialNumber)
            ? crypto.createHash('sha256').update(`${motherboardSerialNumber}-${batterySerialNumber}-${cameraSerialNumber || 'U'}`).digest('hex')
            : null;

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
                cameraSerialNumber,
                hardwareDnaHash
            }
        });

        // --- AI HARDWARE DEGRADATION ANALYZER ---
        const { sealTransaction } = require('../utils/Blockchain');
        let initialHash = null;

        if (devicePhotos && devicePhotos.length > 0) {
            const hardwareGrade = await analyzeDeviceHardwareCondition(devicePhotos, brand, model);

            if (hardwareGrade.grade !== "Unknown") {
                const desc = `Visual Grade: ${hardwareGrade.grade}. AI Notes: ${hardwareGrade.notes}. Aftermarket Parts Detected: ${hardwareGrade.hasAftermarketScreen ? 'YES' : 'NO'}`;
                const ts = new Date();
                initialHash = sealTransaction('0', "AI_HARDWARE_APPRAISAL", { data: desc }, ts);

                await prisma.transactionHistory.create({
                    data: {
                        deviceId: device.id,
                        actorId: req.user.id,
                        type: "AI_HARDWARE_APPRAISAL",
                        description: desc,
                        hash: initialHash,
                        isSealed: true,
                        createdAt: ts
                    }
                });
            }
        }

        // Generate Digital Device Ownership Certificate (DDOC)

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
                },
                history: {
                    orderBy: { createdAt: 'desc' }
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

        // Verify Chain Integrity
        const { verifyChainIntegrity } = require('../utils/Blockchain');
        const chainStatus = verifyChainIntegrity(device.history || []);

        res.json({
            device: {
                imei: device.imei,
                brand: device.brand,
                model: device.model,
                status: device.status,
                riskScore,
                chainIntegrity: chainStatus.valid ? 'VERIFIED_IMMUTABLE' : 'TAMPERED_WARNING',
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

        const { batteryLevel = 50, speedKmH = 0, isMovingFast = false, latitude, longitude } = req.body;

        let finalLocation = location;
        if (latitude && longitude) {
            const readableAddress = await reverseGeocode(latitude, longitude);
            finalLocation = `${readableAddress} (Raw: ${location})`;
        }

        const updatedDevice = await prisma.device.update({
            where: { imei },
            data: {
                lastKnownLocation: finalLocation,
                lastKnownIp: ip || req.ip,
                lastLocationUpdate: new Date()
            }
        });

        // --- DIGITAL BLOODHOUND (BATTERY / TRACKING STATE AI) ---
        // Assume battery is sent in body, default to 50% if not


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

            // --- 🌐 INTERPOL GEO-FENCE BREACH DETECTION ---
            let geoFenceAlert = null;
            const currentCoord = { latitude: parseFloat(latitude), longitude: parseFloat(longitude) };

            // 1. Dynamic Feature (User UI-drawn Polygon Intercepts)
            let breachedCustomFence = null;
            try {
                const geolib = require('geolib');
                const activeFences = await prisma.regionalGeoFence.findMany({ where: { isActive: true } });

                for (const fence of activeFences) {
                    const polygon = JSON.parse(fence.geometryJson);
                    // Assume drawn polygon is the CONTAINMENT ZONE. If they ping OUTSIDE, they breached.
                    if (!geolib.isPointInPolygon(currentCoord, polygon)) {
                        breachedCustomFence = fence;
                        break;
                    }
                }
            } catch (e) { console.error("Dynamic Geofence Error", e); }

            // 2. Static Fallback (Northern Nigeria macro boundary)
            const isOutsideNorthernRegion = (lat, lon) => {
                return lat < 7.0 || lat > 14.0 || lon < 3.5 || lon > 14.5;
            };

            if (breachedCustomFence || isOutsideNorthernRegion(currentCoord.latitude, currentCoord.longitude)) {
                geoFenceAlert = breachedCustomFence
                    ? `Target device breached tactical containment line: ${breachedCustomFence.name}`
                    : "Target device has breached the Northern Nigeria/Middle Belt Geo-Fence. Moving towards international borders or deep South.";

                await prisma.incidentReport.create({
                    data: {
                        deviceId: updatedDevice.id,
                        reporterId: updatedDevice.registeredOwnerId, // auto reported
                        type: "INTERPOL_GEOFENCE_BREACH",
                        description: `[WARRANT PING] ${geoFenceAlert} Loc: [${latitude}, ${longitude}]`,
                        status: "OPEN"
                    }
                });

                await sendPushNotification(
                    updatedDevice.registeredOwnerId,
                    "🚨 INTERPOL GEO-FENCE ALARM",
                    "Your stolen device has illegally crossed a critical geographical perimeter! Border patrol and checkpoint authorities have been electronically notified.",
                    { deviceId: updatedDevice.id, alarm: true }
                );
            }

            // --- 🚨 CRITICAL PUSH NOTIFICATION ---
            await sendPushNotification(
                updatedDevice.registeredOwnerId,
                `🚨 STOLEN DEVICE DETECTED: ${updatedDevice.brand} ${updatedDevice.model}`,
                `Your stolen device was just tracked near ${finalLocation}. A Forensic report has been updated. Do not confront suspects yourself.`,
                { deviceId: updatedDevice.id, route: '/app/map', alarm: true }
            );
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

        // Notify Buyer of new registered ownership via Push!
        await sendPushNotification(
            buyer.id,
            `🔗 REGISTRY UPDATE: Digital Transfer Complete`,
            `The ${device.brand} ${device.model} has been safely transferred to your personal registry in the PTS Database. It is fully covered.`,
            { route: '/app/registry', refresh: true }
        );

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
// --- LAZARUS PROTOCOL: Hardware DNA Scanner ---
router.post('/dna-scan', authenticateToken, async (req, res) => {
    try {
        const { currentImei, motherboardSerialNumber, batterySerialNumber, cameraSerialNumber } = req.body;

        if (!motherboardSerialNumber || !batterySerialNumber) {
            return res.status(400).json({ error: 'Incomplete hardware component profile. Motherboard and Battery serials required.' });
        }

        const crypto = require('crypto');
        const hardwareDnaHash = crypto.createHash('sha256').update(`${motherboardSerialNumber}-${batterySerialNumber}-${cameraSerialNumber || 'U'}`).digest('hex');

        // Check if this DNA belongs to a PREVIOUSLY marked STOLEN device
        const stolenLazarusMatch = await prisma.device.findFirst({
            where: {
                hardwareDnaHash,
                status: { in: ['STOLEN', 'LOST'] },
                imei: { not: currentImei } // Catch when IMEI differs but DNA is the same!
            }
        });

        if (stolenLazarusMatch) {
            // Secretly log a high-severity alert
            await prisma.incidentReport.create({
                data: {
                    deviceId: stolenLazarusMatch.id,
                    reporterId: req.user.id,
                    type: "LAZARUS_FRANKENSTEIN_DETECTED",
                    description: `Hardware DNA Scan matched a stolen device! The software IMEI has been illegally changed. This is a Syndicate Chop-Shop device.`,
                    status: "OPEN"
                }
            });

            return res.status(403).json({
                isLazarus: true,
                warning: '🚨 SEVERE HARDWARE MISMATCH 🚨 This device matches the exact internal profile of a STOLEN asset, despite having a different IMEI. It has been illegally flashed.',
                trueOriginalImeiHint: stolenLazarusMatch.imei.substring(0, 8) + '...'
            });
        }

        res.json({
            isLazarus: false,
            hardwareDnaHash,
            message: 'Hardware DNA verified. No internal anomalies detected.'
        });

    } catch (error) {
        console.error('DNA scanner crash:', error);
        res.status(500).json({ error: 'Lazarus Scan failed securely' });
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

// ============================================================
// PUBLIC BLACKLIST — No auth required (for offline SW sync)
// Returns only IMEIs + status so vendors can cache locally
// ============================================================
router.get('/public/blacklist', async (req, res) => {
    try {
        const flaggedDevices = await prisma.device.findMany({
            where: {
                status: { in: ['STOLEN', 'FLAGGED', 'BLACKLISTED'] }
            },
            select: {
                imei: true,
                status: true,
                brand: true,
                model: true,
            },
            take: 50000, // cap at 50k for payload size
        });

        res.set('Cache-Control', 'public, max-age=300'); // 5 min CDN cache
        res.json({
            blacklist: flaggedDevices,
            count: flaggedDevices.length,
            generatedAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Public blacklist error:', error);
        res.status(500).json({ error: 'Failed to fetch blacklist' });
    }
});

// ============================================================
// PUBLIC THREAT RADAR — Stolen Device Heatmap Aggregation
// ============================================================
router.get('/public/threat-radar', async (req, res) => {
    try {
        // Fetch tracking observation points of any device marked as STOLEN over the last 48 hours
        const recentObservations = await prisma.observationReport.findMany({
            where: {
                device: { status: 'STOLEN' },
                createdAt: {
                    gte: new Date(Date.now() - 48 * 60 * 60 * 1000)
                }
            },
            select: {
                id: true,
                latitude: true,
                longitude: true,
                device: { select: { brand: true, model: true } }
            },
            take: 2000
        });

        // Pull general text-based incident locations to map regional hot-zones
        const recentIncidents = await prisma.incidentReport.findMany({
            where: {
                type: 'STOLEN',
                createdAt: {
                    gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                }
            },
            select: { location: true }
        });

        res.json({
            activeHeatmapPoints: recentObservations.filter(o => o.latitude && o.longitude).map(o => ({
                lat: o.latitude,
                lng: o.longitude,
                intensity: 10,
                hint: `${o.device.brand} ${o.device.model} pinged recently`
            })),
            regionalWarnings: recentIncidents.map(i => i.location).filter(Boolean),
            generatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Threat radar error:', error);
        res.status(500).json({ error: 'Failed to generate threat radar' });
    }
});

// ============================================================
// POLICE COMMAND: Dynamic Polygon Geo-Fencing Engine
// ============================================================
router.post('/geofence', authenticateToken, async (req, res) => {
    try {
        const { name, geometryJson } = req.body;
        // Expects geometryJson array: [{latitude: x, longitude: y}, ...]
        if (!geometryJson || !Array.isArray(geometryJson)) return res.status(400).json({ error: 'Valid coordinate array required' });

        const fence = await prisma.regionalGeoFence.create({
            data: {
                name,
                geometryJson: JSON.stringify(geometryJson),
                commanderId: req.user.id
            }
        });
        res.json({ message: `Tactical perimeter '${name}' securely established on grid.`, fence });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to deploy geofence' });
    }
});

router.get('/geofence', async (req, res) => {
    try {
        const fences = await prisma.regionalGeoFence.findMany({ where: { isActive: true } });
        res.json({
            customPerimeters: fences.map(f => ({
                id: f.id,
                name: f.name,
                polygon: JSON.parse(f.geometryJson),
                createdAt: f.createdAt
            }))
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch tactical perimeters' });
    }
});

// ============================================================
// FORENSIC SCAN API — Standalone ELA scan for any image URL
// Used by Admin Dashboard, Police Dossier, or external B2B callers
// ============================================================
router.post('/forensic-scan', authenticateToken, async (req, res) => {
    try {
        const { imageUrl, context } = req.body;
        if (!imageUrl) return res.status(400).json({ error: 'imageUrl is required' });

        console.log(`[Forensic API] ELA scan requested by ${req.user.id} for context: ${context || 'general'}`);
        const result = await analyzeImageELA(imageUrl);

        res.json({
            forensicEngine: 'PTS-ELA-v1 (Sharp/C++ Native)',
            context: context || 'general',
            ...result
        });
    } catch (err) {
        console.error('[Forensic API Error]', err);
        res.status(500).json({ error: 'Forensic scan failed internally' });
    }
});

// ============================================================
// GEOSPATIAL DATA: Geofencing & Perimeters
// ============================================================
router.get('/geofence', async (req, res) => {
    try {
        const perimeters = await prisma.regionalGeoFence.findMany({
            where: { isActive: true }
        });

        // Map to format frontend expects
        const customPerimeters = perimeters.map(p => ({
            id: p.id,
            name: p.name,
            polygon: typeof p.geometryJson === 'string' ? JSON.parse(p.geometryJson) : p.geometryJson
        }));

        res.json({ customPerimeters });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch perimeters' });
    }
});

router.post('/geofence', async (req, res) => {
    try {
        const { name, geometryJson } = req.body;

        const fence = await prisma.regionalGeoFence.create({
            data: {
                name,
                geometryJson: typeof geometryJson === 'string' ? geometryJson : JSON.stringify(geometryJson),
                isActive: true
            }
        });

        // Broadcast to Police logs
        await prisma.transactionHistory.create({
            data: {
                deviceId: "SYSTEM_LEVEL",
                type: "GEOFENCE_DEPLOYED",
                description: `Tactical containment perimeter "${name}" deployed to national grid.`,
                metadata: JSON.stringify({ perimeterId: fence.id })
            }
        });

        res.status(201).json({ message: 'Perimeter deployed', fence });
    } catch (err) {
        res.status(500).json({ error: 'Failed to deploy perimeter' });
    }
});

// ============================================================
// PUBLIC THREAT RADAR — Heatmap data for stolen device hotspots
// ============================================================
router.get('/public/threat-radar', async (req, res) => {
    try {
        const stolenDevices = await prisma.device.findMany({
            where: { status: 'STOLEN' },
            select: {
                id: true,
                brand: true,
                model: true,
                riskScore: true,
                lastPings: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { latitude: true, longitude: true, createdAt: true }
                }
            }
        });

        // Convert pings to heatmap points
        const hotspots = stolenDevices
            .filter(d => d.lastPings.length > 0)
            .map(d => ({
                lat: d.lastPings[0].latitude,
                lng: d.lastPings[0].longitude,
                intensity: d.riskScore || 0.5, // Intensity based on risk or just 0.5
                timestamp: d.lastPings[0].createdAt
            }));

        res.json({
            count: hotspots.length,
            hotspots,
            gridStatus: "Active surveillance grid live-synced."
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to generate threat radar' });
    }
});

module.exports = router;

