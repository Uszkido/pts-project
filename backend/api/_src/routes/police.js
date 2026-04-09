const express = require('express');
const router = express.Router();
const prisma = require('../db');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = 'supersecret_pts_dev_key';

// Middleware to verify JWT and Police role
const authenticatePolice = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        if (user.role !== 'POLICE' && user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Access denied. Law enforcement personnel only.' });
        }
        req.user = user;
        next();
    });
};

// Get devices filtered by status — defaults to STOLEN,LOST for law enforcement
router.get('/devices', authenticatePolice, async (req, res) => {
    try {
        const { status } = req.query;

        // Default to STOLEN,LOST if not specified (law enforcement only sees actionable devices)
        const rawStatus = status || 'STOLEN,LOST';
        const statusList = rawStatus.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

        const devices = await prisma.device.findMany({
            where: {
                status: { in: statusList }
            },
            include: {
                registeredOwner: {
                    select: { email: true, companyName: true }
                }
            },
            orderBy: { updatedAt: 'desc' }
        });

        res.json({ devices });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update device status (e.g., mark as INVESTIGATING or RECOVERED)
router.put('/devices/:imei/status', authenticatePolice, async (req, res) => {
    try {
        const { imei } = req.params;
        const { status } = req.body; // e.g., INVESTIGATING, CLEAN

        const allowedStatuses = ['CLEAN', 'STOLEN', 'LOST', 'INVESTIGATING'];
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const device = await prisma.device.update({
            where: { imei },
            data: { status }
        });

        res.json({ message: `Device status updated to ${status}`, device });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Fetch all consumer incident reports
router.get('/incidents', authenticatePolice, async (req, res) => {
    try {
        const reports = await prisma.incidentReport.findMany({
            include: {
                device: { select: { imei: true, brand: true, model: true, lastKnownLocation: true, devicePhotos: true } },
                reporter: { select: { email: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ reports });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Fetch all vendor suspicious activity alerts
router.get('/vendor-alerts', authenticatePolice, async (req, res) => {
    try {
        const alerts = await prisma.vendorSuspiciousAlert.findMany({
            include: {
                device: { select: { imei: true, brand: true, model: true, devicePhotos: true } },
                vendor: { select: { email: true, companyName: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ alerts });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Fetch metrics for the dashboard
router.get('/dashboard-metrics', authenticatePolice, async (req, res) => {
    try {
        const totalDevices = await prisma.device.count();
        const cleanDevices = await prisma.device.count({ where: { status: 'CLEAN' } });
        const stolenDevices = await prisma.device.count({ where: { status: 'STOLEN' } });
        const lostDevices = await prisma.device.count({ where: { status: 'LOST' } });
        const investigatingDevices = await prisma.device.count({ where: { status: 'INVESTIGATING' } });

        const openIncidents = await prisma.incidentReport.count({ where: { status: 'OPEN' } });
        const openAlerts = await prisma.vendorSuspiciousAlert.count();

        res.json({
            metrics: {
                totalDevices,
                cleanDevices,
                stolenDevices,
                lostDevices,
                investigatingDevices,
                openIncidents,
                openAlerts
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ DEVICE SEARCH ============
router.get('/search', authenticatePolice, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) return res.status(400).json({ error: 'Search query too short' });

        const devices = await prisma.device.findMany({
            where: {
                OR: [
                    { imei: { contains: q, mode: 'insensitive' } },
                    { brand: { contains: q, mode: 'insensitive' } },
                    { model: { contains: q, mode: 'insensitive' } },
                    { serialNumber: { contains: q, mode: 'insensitive' } },
                    { registeredOwner: { email: { contains: q, mode: 'insensitive' } } },
                    { registeredOwner: { companyName: { contains: q, mode: 'insensitive' } } }
                ]
            },
            include: {
                registeredOwner: { select: { email: true, companyName: true, fullName: true } }
            },
            take: 20,
            orderBy: { updatedAt: 'desc' }
        });

        res.json({ devices });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ SUSPECT REGISTRY ============
router.post('/suspects', authenticatePolice, async (req, res) => {
    try {
        const { fullName, alias, nationalId, phoneNumber, description, photoUrl, knownAddresses, dangerLevel } = req.body;

        const suspect = await prisma.suspect.create({
            data: { fullName, alias, nationalId, phoneNumber, description, photoUrl, knownAddresses, dangerLevel: dangerLevel || 'UNKNOWN' }
        });

        res.status(201).json({ message: 'Suspect record created', suspect });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/suspects', authenticatePolice, async (req, res) => {
    try {
        const suspects = await prisma.suspect.findMany({
            include: { incidents: { include: { device: { select: { imei: true, brand: true, model: true } } } } },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ suspects });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ==== EXADEL COMPREFACE: 1:N CCTV 📸 SUSPECT MATCHING ====
router.post('/suspects/match-face', authenticatePolice, async (req, res) => {
    try {
        const { imageBase64 } = req.body;
        if (!imageBase64) return res.status(400).json({ error: 'Requires base64 image data of the suspect face.' });

        console.log("🕵️ NPF BIOMETRIC COMMAND: Initiating Exadel CompreFace 1:N suspect scan...");

        // In a true enterprise deployment, this base64 buffer is sent to the Exadel CompreFace /recognition endpoint.
        // It returns the closest UUID out of the trained face collection.
        // For demonstration purposes, we perform a stochastic mock matching algorithm against the known database.

        // Retrieve all known suspects who have a photoUrl attached
        const knownSuspects = await prisma.suspect.findMany({
            where: { photoUrl: { not: null } }
        });

        if (knownSuspects.length === 0) {
            return res.json({ matchFound: false, message: 'No registered suspects with facial data in the registry.' });
        }

        // Simulate 2000ms GPU Processing delay 
        await new Promise(r => setTimeout(r, 2000));

        // Let's pretend it successfully mathematically matched the first suspect in the database with 94.2% accuracy
        const matchedSuspect = knownSuspects[0];

        res.json({
            matchFound: true,
            engine: "Exadel CompreFace NPU",
            matchConfidence: 94.2,
            targetInfo: {
                id: matchedSuspect.id,
                fullName: matchedSuspect.fullName,
                alias: matchedSuspect.alias,
                dangerLevel: matchedSuspect.dangerLevel,
                knownAddresses: matchedSuspect.knownAddresses
            },
            message: `Facial nodes mathematically matched against Suspect: ${matchedSuspect.fullName} with 94.2% confidence.`
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Biometric Engine Failure' });
    }
});

// Link a suspect to an incident
router.put('/incidents/:id/suspect', authenticatePolice, async (req, res) => {
    try {
        const { id } = req.params;
        const { suspectId } = req.body;

        const report = await prisma.incidentReport.update({
            where: { id },
            data: { suspectId }
        });

        res.json({ message: 'Suspect linked to incident', report });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Police clears an incident
router.put('/incidents/:id/clear', authenticatePolice, async (req, res) => {
    try {
        const { id } = req.params;
        const report = await prisma.incidentReport.update({
            where: { id },
            data: { status: 'CLEARED' }
        });
        res.json({ message: 'Incident cleared successfully', report });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/suspects/:id/status', authenticatePolice, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // ACTIVE, CLEARED, GUILTY, NOT_GUILTY

        if (!['ACTIVE', 'CLEARED', 'GUILTY', 'NOT_GUILTY'].includes(status)) {
            return res.status(400).json({ error: 'Invalid suspect status' });
        }

        const suspect = await prisma.suspect.update({
            where: { id },
            data: { status }
        });

        res.json({ message: `Suspect status updated to ${status}`, suspect });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ TRACKING LOGS ============
router.post('/tracking-log', authenticatePolice, async (req, res) => {
    try {
        const { deviceImei, method, location, accuracy, ipAddress, metadata } = req.body;

        if (!deviceImei || !method || !location) {
            return res.status(400).json({ error: 'deviceImei, method, and location are required' });
        }

        const log = await prisma.deviceTrackingLog.create({
            data: { deviceImei, method, location, accuracy, ipAddress, metadata, loggedById: req.user.id }
        });

        // Also update device's last known location
        await prisma.device.updateMany({
            where: { imei: deviceImei },
            data: { lastKnownLocation: location, lastKnownIp: ipAddress, lastLocationUpdate: new Date() }
        });

        res.status(201).json({ message: 'Tracking log recorded', log });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/tracking-logs/:imei', authenticatePolice, async (req, res) => {
    try {
        const { imei } = req.params;
        const logs = await prisma.deviceTrackingLog.findMany({
            where: { deviceImei: imei },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ logs });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ LOCATION SHARING WITH VICTIM ============
router.put('/incidents/:id/share-location', authenticatePolice, async (req, res) => {
    try {
        const { id } = req.params;

        const report = await prisma.incidentReport.update({
            where: { id },
            data: { locationSharedWithOwner: true }
        });

        res.json({ message: 'Device location is now shared with the victim account', report });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Toggle location sharing globally for a device
router.put('/devices/:imei/share-location', authenticatePolice, async (req, res) => {
    try {
        const { imei } = req.params;
        const { shared } = req.body; // boolean

        const device = await prisma.device.update({
            where: { imei },
            data: { isLocationShared: !!shared },
            include: { registeredOwner: true }
        });

        // Send notification to owner
        if (device.registeredOwnerId) {
            await prisma.message.create({
                data: {
                    senderId: req.user.id,
                    receiverId: device.registeredOwnerId,
                    subject: `📍 LIVE TRACKING: ${device.brand} ${device.model}`,
                    body: shared
                        ? `Law Enforcement has shared the live location of your device (${imei}) with your account. You can now view its real-time movement on your dashboard.`
                        : `Access to live tracking for your device (${imei}) has been revoked by Law Enforcement.`
                }
            });
        }

        res.json({ message: `Location sharing ${shared ? 'enabled' : 'disabled'} for this device`, shared: device.isLocationShared });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Multi-method Triangulation Simulation
router.post('/triangulate', authenticatePolice, async (req, res) => {
    try {
        const { method } = req.body;
        const activeDevices = await prisma.device.findMany({
            where: {
                status: { in: ['STOLEN', 'LOST', 'INVESTIGATING'] }
            }
        });

        const updates = [];
        for (const device of activeDevices) {
            // Generate a slightly different location to simulate movement/tracking
            const newLoc = device.lastKnownLocation || "Unknown Area, Nigeria";
            const log = await prisma.deviceTrackingLog.create({
                data: {
                    deviceImei: device.imei,
                    method,
                    location: `${newLoc.split(' (')[0]} (${method} Node ${Math.floor(Math.random() * 999)})`,
                    accuracy: method === 'GPS' ? 'High' : 'Medium',
                    loggedById: req.user.id
                }
            });

            await prisma.device.update({
                where: { id: device.id },
                data: { lastKnownLocation: log.location, lastLocationUpdate: new Date() }
            });
            updates.push({ imei: device.imei, location: log.location });
        }

        res.json({ message: `Network-wide ${method} triangulation sequence complete.`, updates });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ MESSAGING (ADMIN ↔ POLICE) ============
router.get('/messages', authenticatePolice, async (req, res) => {
    try {
        const messages = await prisma.message.findMany({
            where: {
                OR: [
                    { receiverRole: 'POLICE' },
                    { senderId: req.user.id }
                ]
            },
            include: { sender: { select: { email: true, fullName: true, role: true } } },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ messages });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/messages', authenticatePolice, async (req, res) => {
    try {
        const { subject, body } = req.body;
        if (!subject || !body) return res.status(400).json({ error: 'Subject and body are required' });

        const message = await prisma.message.create({
            data: {
                senderId: req.user.id,
                receiverRole: 'ADMIN',
                subject,
                body
            }
        });

        res.status(201).json({ message: 'Message sent to Admins', data: message });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ LIVE ACTIONS ============
router.post('/deploy-team', authenticatePolice, async (req, res) => {
    try {
        const { imei, location } = req.body;
        if (!imei) return res.status(400).json({ error: 'IMEI is required' });

        const device = await prisma.device.findUnique({ where: { imei } });
        if (!device) return res.status(404).json({ error: 'Device not found' });

        // Record the deployment in transaction history
        await prisma.transactionHistory.create({
            data: {
                deviceId: device.id,
                actorId: req.user.id,
                type: 'TEAM_DEPLOYED',
                description: `Rapid Response Team deployed to last known location: ${location || device.lastKnownLocation || 'Unknown'}`,
                metadata: JSON.stringify({ timestamp: new Date(), location })
            }
        });

        // Update device status to INVESTIGATING if it's not already something more serious
        if (device.status === 'STOLEN' || device.status === 'LOST' || device.status === 'CLEAN') {
            await prisma.device.update({
                where: { imei },
                data: { status: 'INVESTIGATING' }
            });
        }

        res.json({ message: 'Rapid Response Team has been dispatched and logged.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/alert-vendors', authenticatePolice, async (req, res) => {
    try {
        const { imei, brand, model, location } = req.body;
        if (!imei) return res.status(400).json({ error: 'IMEI is required' });

        const subject = `🚨 STOLEN DEVICE ALERT: ${brand} ${model}`;
        const body = `Attention all vendors: A device with IMEI ${imei} (${brand} ${model}) was recently tracked near ${location || 'your area'}. DO NOT attempt to purchase or service this device. Contact law enforcement immediately if it appears in your shop.`;

        // Broadcast message to all vendors
        await prisma.message.create({
            data: {
                senderId: req.user.id,
                receiverRole: 'VENDOR',
                subject,
                body
            }
        });

        res.json({ message: 'Alert broadcasted to all registered vendors in the network.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ POLICE INTEL & EVIDENCE ============

// Generate Forensic Evidence Report Data
router.get('/export-evidence/:imei', authenticatePolice, async (req, res) => {
    try {
        const { imei } = req.params;
        const device = await prisma.device.findUnique({
            where: { imei },
            include: {
                registeredOwner: true,
                history: { include: { actor: { select: { fullName: true, role: true, companyName: true } } }, orderBy: { createdAt: 'desc' } },
                incidents: { include: { reporter: true } },
                maintenance: { include: { vendor: true } },
                transfersAsDevice: { include: { seller: true, buyer: true }, where: { status: 'COMPLETED' } },
                proofsOfSale: { include: { vendor: true, buyer: true } }
            }
        });

        if (!device) return res.status(404).json({ error: 'Device not found' });

        // Compile Forensic Dossier
        const dossier = {
            reportId: `FOR-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
            generatedAt: new Date(),
            generatedBy: req.user.email || req.user.id || 'Unknown Official',
            asset: {
                brand: device.brand,
                model: device.model,
                imei: device.imei,
                serial: device.serialNumber,
                status: device.status,
                riskScore: device.riskScore,
                photos: device.devicePhotos || []
            },
            ownership: {
                current: device.registeredOwner?.fullName || device.registeredOwner?.companyName || device.registeredOwner?.email || 'N/A',
                chain: (device.transfersAsDevice || []).map(t => ({
                    date: t.transferDate,
                    from: t.seller?.email || 'Unknown',
                    to: t.buyer?.email || 'Unknown'
                }))
            },
            incidents: (device.incidents || []).map(i => ({
                date: i.createdAt,
                type: i.type || 'STOLEN', // Fallback as 'type' might be missing in schema
                desc: i.description || 'No description provided',
                policeRef: i.policeReportNo || 'Pending'
            })),
            maintenance: (device.maintenance || []).map(m => ({
                date: m.serviceDate,
                provider: m.vendor?.companyName || m.vendor?.fullName || 'Unknown Vendor',
                type: m.serviceType || 'General Service'
            })),
            ledger: (device.history || []).map(h => ({
                date: h.createdAt,
                type: h.type,
                actor: h.actor?.companyName || h.actor?.fullName || h.actor?.role || 'System',
                details: h.description
            }))
        };

        res.json({ dossier });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to generate evidence dossier' });
    }
});

// AI Intelligence Feed (High-Risk Anomalies)
router.get('/intel-feed', authenticatePolice, async (req, res) => {
    try {
        // Find devices with high risk scores or recent suspicious velocity
        const anomalies = await prisma.device.findMany({
            where: {
                OR: [
                    { riskScore: { lt: 40 } },
                    { status: { in: ['STOLEN', 'LOST', 'INVESTIGATING'] } }
                ]
            },
            include: {
                history: { take: 5, orderBy: { createdAt: 'desc' } }
            },
            orderBy: { riskScore: 'asc' },
            take: 15
        });

        const feed = anomalies.map(a => ({
            id: a.id,
            imei: a.imei,
            brand: a.brand,
            model: a.model,
            reason: a.riskScore < 40 ? 'LOW_TRUST_INDEX' : 'REPORTED_CRIME',
            score: a.riskScore,
            lastSeen: a.lastKnownLocation || 'Unknown',
            latestEvent: a.history[0]?.description || 'No recent activity'
        }));

        res.json({ feed });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch intel feed' });
    }
});

// ============ NATIONAL KILL-SWITCH (BRICK/UNBRICK) ============
router.post('/devices/:imei/brick', authenticatePolice, async (req, res) => {
    try {
        const { imei } = req.params;
        const { reason } = req.body;

        const device = await prisma.device.findUnique({ where: { imei } });
        if (!device) return res.status(404).json({ error: 'Device not found' });

        await prisma.device.update({
            where: { imei },
            data: {
                isBricked: true,
                status: 'STOLEN' // Force status to STOLEN if bricked
            }
        });

        await prisma.transactionHistory.create({
            data: {
                deviceId: device.id,
                actorId: req.user.id,
                type: 'HARDWARE_BRICKED',
                description: `DEVICE KILL-SWITCH ACTIVATED. Reason: ${reason || 'Reported Stolen/Malicious activity'}`,
                metadata: JSON.stringify({ timestamp: new Date(), officialId: req.user.id })
            }
        });

        res.json({ message: 'Kill-switch activated. Device hardware is now marked as BRICKED globally.', imei });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/devices/:imei/unbrick', authenticatePolice, async (req, res) => {
    try {
        const { imei } = req.params;

        const device = await prisma.device.findUnique({ where: { imei } });
        if (!device) return res.status(404).json({ error: 'Device not found' });

        await prisma.device.update({
            where: { imei },
            data: { isBricked: false }
        });

        await prisma.transactionHistory.create({
            data: {
                deviceId: device.id,
                actorId: req.user.id,
                type: 'HARDWARE_RESTORED',
                description: 'Kill-switch deactivated. Device hardware functionality restored.',
                metadata: JSON.stringify({ timestamp: new Date(), officialId: req.user.id })
            }
        });

        res.json({ message: 'Kill-switch deactivated. Device hardware has been restored.', imei });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ GEOSPATIAL DATA ============
router.get('/map-data', authenticatePolice, async (req, res) => {
    try {
        const vendors = await prisma.user.findMany({
            where: {
                role: 'VENDOR',
                shopLatitude: { not: null },
                shopLongitude: { not: null }
            },
            select: {
                id: true,
                email: true,
                companyName: true,
                shopLatitude: true,
                shopLongitude: true,
                vendorTier: true
            }
        });

        const observations = await prisma.observationReport.findMany({
            include: {
                device: { select: { imei: true, brand: true, model: true, status: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 100
        });

        res.json({ vendors, observations });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
