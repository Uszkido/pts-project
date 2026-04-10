const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const prisma = require('../db');
const { authenticate, authenticateToken } = require('../middleware/auth');
const deviceController = require('../controllers/deviceController');
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

// Register a new device (Vendors only)
router.post('/', authenticate, deviceController.createDevice);

// Verify device by IMEI (Public endpoint)
router.get('/verify/:imei', deviceController.verifyDevice);

// Report device as stolen (Owner only)
router.post('/:imei/report', authenticate, deviceController.reportDevice);

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

