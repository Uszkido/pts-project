const express = require('express');
const router = express.Router();
const prisma = require('../db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = 'supersecret_pts_dev_key';

// Admin auth middleware
const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        if (user.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });
        req.user = user;
        next();
    });
};

// ============ ADMIN DASHBOARD ============
router.get('/dashboard', authenticateAdmin, async (req, res) => {
    try {
        const [totalUsers, totalDevices, totalIncidents, totalSuspects, pendingVendors] = await Promise.all([
            prisma.user.count(),
            prisma.device.count(),
            prisma.incidentReport.count(),
            prisma.suspect.count(),
            prisma.user.count({ where: { role: 'VENDOR', vendorStatus: 'PENDING' } })
        ]);

        const usersByRole = await prisma.user.groupBy({ by: ['role'], _count: true });
        const devicesByStatus = await prisma.device.groupBy({ by: ['status'], _count: true });

        res.json({
            stats: { totalUsers, totalDevices, totalIncidents, totalSuspects, pendingVendors },
            usersByRole: usersByRole.map(r => ({ role: r.role, count: r._count })),
            devicesByStatus: devicesByStatus.map(d => ({ status: d.status, count: d._count }))
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/map-data', authenticateAdmin, async (req, res) => {
    try {
        const [vendors, obsPings, trackingLogs] = await Promise.all([
            prisma.user.findMany({
                where: { role: 'VENDOR', shopLatitude: { not: null } },
                select: { id: true, companyName: true, shopLatitude: true, shopLongitude: true, vendorTier: true }
            }),
            prisma.observationReport.findMany({
                orderBy: { createdAt: 'desc' },
                include: { device: { select: { brand: true, model: true, imei: true, status: true } } }
            }),
            prisma.deviceTrackingLog.findMany({
                orderBy: { createdAt: 'desc' }
            })
        ]);

        const pings = [...obsPings];

        // Deduplicate tracking logs per IMEI so we only show the latest known location
        const seenImeis = new Set(obsPings.map(p => p.device?.imei));

        for (const log of trackingLogs) {
            if (!seenImeis.has(log.deviceImei)) {
                // Parse "lat, lng" out of the string like "6.5244, 3.3792 (GPS Node)"
                const match = log.location && log.location.match(/([+-]?[0-9]*\.?[0-9]+)\s*,\s*([+-]?[0-9]*\.?[0-9]+)/);
                if (match) {
                    pings.push({
                        latitude: parseFloat(match[1]),
                        longitude: parseFloat(match[2]),
                        device: { brand: "Device", model: "Log", imei: log.deviceImei, status: "KNOWN" }
                    });
                    seenImeis.add(log.deviceImei);
                }
            }
        }

        res.json({ vendors, pings });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch map surveillance data' });
    }
});

// ============ AI INTELLIGENCE & ANALYTICS ============
const { generateCrimeInsights } = require('../services/aiService');

router.get('/intelligence/briefing', authenticateAdmin, async (req, res) => {
    try {
        const recentIncidents = await prisma.incidentReport.findMany({
            take: 20,
            orderBy: { createdAt: 'desc' },
            select: { type: true, location: true, createdAt: true, description: true }
        });
        const briefing = await generateCrimeInsights(recentIncidents);
        res.json({ briefing, analyzedAt: new Date() });
    } catch (error) {
        res.status(500).json({ error: 'AI Brain is currently processing. Try again later.' });
    }
});

router.get('/analytics/trends', authenticateAdmin, async (req, res) => {
    try {
        // Group by month (SQLite/Postgres logic)
        // For simplicity in this demo, we'll return structured data for charts
        const theftStats = await prisma.incidentReport.groupBy({
            by: ['type'],
            _count: true
        });

        const brandStats = await prisma.device.groupBy({
            by: ['brand'],
            _count: true
        });

        // Generate synthetic monthly data for the line chart (Real data would be time-grouped)
        const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
        const monthlyTrends = labels.map((label, idx) => ({
            name: label,
            thefts: 10 + Math.floor(Math.random() * 20),
            recoveries: 5 + Math.floor(Math.random() * 10)
        }));

        res.json({
            theftStats: theftStats.map(s => ({ name: s.type, value: s._count })),
            brandStats: brandStats.map(s => ({ name: s.brand, value: s._count })),
            monthlyTrends
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate trend reports' });
    }
});

// ============ USER MANAGEMENT ============
router.get('/users', authenticateAdmin, async (req, res) => {
    try {
        const { role, vendorStatus } = req.query;
        const where = {};
        if (role) where.role = role;
        if (vendorStatus) where.vendorStatus = vendorStatus;

        const users = await prisma.user.findMany({
            where,
            select: {
                id: true, email: true, role: true, fullName: true, companyName: true,
                vendorTier: true, vendorStatus: true, status: true, nationalId: true,
                businessAddress: true, shopLatitude: true, shopLongitude: true,
                shopPhotoUrl: true, businessRegNo: true, cacCertificateUrl: true,
                createdAt: true, isEmailConfirmed: true, emailVerificationOtp: true,
                _count: { select: { devices: true, incidentsReported: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ users });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin creates any user account
router.post('/users', authenticateAdmin, async (req, res) => {
    try {
        const { email, password, role, fullName, companyName, nationalId } = req.body;
        if (!email || !password || !role) {
            return res.status(400).json({ error: 'Email, password, and role are required' });
        }
        if (!['ADMIN', 'VENDOR', 'CONSUMER', 'POLICE', 'INSURANCE', 'TELECOM'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) return res.status(400).json({ error: 'User already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                email, password: hashedPassword, role, fullName, nationalId,
                companyName: role === 'VENDOR' ? companyName : null,
                vendorStatus: 'APPROVED'
            }
        });
        res.status(201).json({ message: `${role} account created`, user: { id: user.id, email: user.email, role: user.role } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Change user role
router.put('/users/:id/role', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;
        if (!['ADMIN', 'VENDOR', 'CONSUMER', 'POLICE', 'INSURANCE', 'TELECOM'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }
        const user = await prisma.user.update({ where: { id }, data: { role } });
        res.json({ message: `User role updated to ${role}`, user: { id: user.id, email: user.email, role: user.role } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Approve / Reject / Suspend vendor
router.put('/users/:id/vendor-status', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { vendorStatus } = req.body;
        if (!['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'].includes(vendorStatus)) {
            return res.status(400).json({ error: 'Invalid vendor status' });
        }
        const vendorTier = vendorStatus === 'APPROVED' ? 2 : vendorStatus === 'REJECTED' ? 4 : undefined;
        const user = await prisma.user.update({
            where: { id },
            data: { vendorStatus, ...(vendorTier !== undefined ? { vendorTier } : {}) }
        });
        res.json({ message: `Vendor status updated to ${vendorStatus}`, user: { id: user.id, email: user.email, vendorStatus: user.vendorStatus } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete user
router.delete('/users/:id', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.user.delete({ where: { id } });
        res.json({ message: 'User deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Change user status (Suspend/Activate)
router.put('/users/:id/status', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!['ACTIVE', 'SUSPENDED'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status. Must be ACTIVE or SUSPENDED.' });
        }

        // Prevent admin from suspending themselves
        if (id === req.user.id) {
            return res.status(403).json({ error: 'You cannot suspend your own admin account.' });
        }

        const user = await prisma.user.update({ where: { id }, data: { status } });
        res.json({ message: `User account is now ${status}`, user: { id: user.id, email: user.email, status: user.status } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get full user details (including devices)
router.get('/users/:id/details', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const user = await prisma.user.findUnique({
            where: { id },
            include: {
                devices: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!user) return res.status(404).json({ error: 'User not found' });

        // Remove password hash from response
        const { password, ...userWithoutPassword } = user;
        res.json({ user: userWithoutPassword });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update user details
router.put('/users/:id/details', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { email, fullName, companyName, nationalId } = req.body;

        const existingEmail = await prisma.user.findUnique({ where: { email } });
        if (existingEmail && existingEmail.id !== id) {
            return res.status(400).json({ error: 'Email already in use by another account' });
        }

        const user = await prisma.user.update({
            where: { id },
            data: { email, fullName, companyName, nationalId }
        });
        res.json({ message: 'User details updated successfully', user: { id: user.id, email: user.email } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Reset user password
router.put('/users/:id/password', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id },
            data: { password: hashedPassword }
        });

        res.json({ message: 'User password reset successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/devices', authenticateAdmin, async (req, res) => {
    try {
        const { status } = req.query;
        const where = status ? { status } : {};
        const devices = await prisma.device.findMany({
            where,
            include: { registeredOwner: { select: { email: true, companyName: true, fullName: true } } },
            orderBy: { updatedAt: 'desc' },
            take: 100
        });
        res.json({ devices });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin Bulk Import (Telecom / Enterprise Scale)
router.post('/devices/bulk-import', authenticateAdmin, async (req, res) => {
    try {
        const { devices } = req.body; // Array of { imei, brand, model, registeredOwnerId }

        if (!Array.isArray(devices) || devices.length === 0) {
            return res.status(400).json({ error: 'Payload must contain a non-empty array of devices.' });
        }

        if (devices.length > 50000) {
            return res.status(413).json({ error: 'Bulk import limit is 50,000 devices per batch to prevent database lockups.' });
        }

        console.log(`📦 B2B BULK LOAD: Admin initializing parallel import of ${devices.length} devices.`);

        // Efficiently chunk and create many devices in one transaction using Prisma createMany (requires PostgreSQL)
        const batchPayload = devices.map(d => ({
            imei: String(d.imei).trim(),
            brand: d.brand || 'Unknown',
            model: d.model || 'Unknown',
            registeredOwnerId: d.registeredOwnerId || req.user.id, // Fallback to Admin's ID if no owner is provided
            status: d.status || 'CLEAN',
            riskScore: d.riskScore || 100
        }));

        const result = await prisma.device.createMany({
            data: batchPayload,
            skipDuplicates: true // Prevents crashing if some IMEIs already exist
        });

        res.status(201).json({
            message: `Bulk operation completed successfully.`,
            importedCount: result.count,
            skippedCount: devices.length - result.count
        });
    } catch (error) {
        console.error('Bulk Import Error:', error);
        res.status(500).json({ error: 'Database error during mass injection batch.' });
    }
});

router.get('/devices/:id/details', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const device = await prisma.device.findUnique({
            where: { id },
            include: {
                registeredOwner: { select: { id: true, email: true, fullName: true, companyName: true, phoneNumber: true, address: true } },
                certificates: { orderBy: { issueDate: 'desc' } },
                incidents: { orderBy: { createdAt: 'desc' }, include: { reporter: { select: { email: true } } } },
                history: { orderBy: { createdAt: 'desc' }, include: { actor: { select: { email: true, role: true } } } }
            }
        });

        if (!device) return res.status(404).json({ error: 'Device not found' });

        res.json({ device });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin updates device status
router.put('/devices/:id/status', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!['CLEAN', 'STOLEN', 'INVESTIGATING', 'RECOVERED', 'FROZEN', 'BLACKLISTED'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        const device = await prisma.device.update({ where: { id }, data: { status } });
        res.json({ message: `Device status updated to ${status}`, device: { id: device.id, imei: device.imei, status: device.status } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin manually edits device risk score
router.put('/devices/:id/risk-score', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { riskScore } = req.body;

        if (typeof riskScore !== 'number' || riskScore < 0 || riskScore > 100) {
            return res.status(400).json({ error: 'riskScore must be a number between 0 and 100' });
        }

        const device = await prisma.device.update({
            where: { id },
            data: { riskScore: Math.round(riskScore) }
        });

        res.json({ message: `Device risk score updated to ${device.riskScore}`, device: { id: device.id, imei: device.imei, riskScore: device.riskScore } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Admin transfers device ownership
router.put('/devices/:id/owner', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { newOwnerEmail } = req.body;
        const newOwner = await prisma.user.findUnique({ where: { email: newOwnerEmail } });
        if (!newOwner) return res.status(404).json({ error: 'New owner not found by email' });
        const device = await prisma.device.update({ where: { id }, data: { registeredOwnerId: newOwner.id } });
        res.json({ message: `Device ownership transferred to ${newOwnerEmail}`, device: { id: device.id, imei: device.imei } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Toggle location sharing globally for a device
router.put('/devices/:id/share-location', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { shared } = req.body; // boolean

        const device = await prisma.device.update({
            where: { id },
            data: { isLocationShared: !!shared },
            include: { registeredOwner: true }
        });

        // Send notification to owner
        if (device.registeredOwnerId) {
            await prisma.message.create({
                data: {
                    senderId: req.user.id,
                    receiverId: device.registeredOwnerId,
                    subject: `📍 SYSTEM TRACKING: ${device.brand} ${device.model}`,
                    body: shared
                        ? `The System Administrator has authorized live location sharing for your device (${device.imei}) with your account. Access is now active on your dashboard.`
                        : `Live tracking access for your device (${device.imei}) has been deactivated by the Administrator.`
                }
            });
        }

        res.json({ message: `Location sharing ${shared ? 'enabled' : 'disabled'} for this device`, shared: device.isLocationShared });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin deletes device
router.delete('/devices/:id', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        // Cascade triggers will remove associated certificates, logs, etc
        await prisma.device.delete({ where: { id } });
        res.json({ message: 'Device deleted recursively from the network.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ INCIDENT OVERVIEW ============
router.get('/incidents', authenticateAdmin, async (req, res) => {
    try {
        const incidents = await prisma.incidentReport.findMany({
            include: {
                device: { select: { imei: true, brand: true, model: true, status: true } },
                reporter: { select: { email: true, fullName: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 100
        });
        res.json({ incidents });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin clears an incident
router.put('/incidents/:id/clear', authenticateAdmin, async (req, res) => {
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

// ============ SUSPECT MANAGEMENT ============
router.get('/suspects', authenticateAdmin, async (req, res) => {
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

router.put('/suspects/:id/status', authenticateAdmin, async (req, res) => {
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

// ============ GLOBAL SEARCH ============
router.get('/search', authenticateAdmin, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) return res.status(400).json({ error: 'Search query too short' });

        const [users, devices] = await Promise.all([
            prisma.user.findMany({
                where: {
                    OR: [
                        { email: { contains: q, mode: 'insensitive' } },
                        { fullName: { contains: q, mode: 'insensitive' } },
                        { companyName: { contains: q, mode: 'insensitive' } }
                    ]
                },
                select: { id: true, email: true, fullName: true, companyName: true, role: true },
                take: 10
            }),
            prisma.device.findMany({
                where: {
                    OR: [
                        { imei: { contains: q, mode: 'insensitive' } },
                        { brand: { contains: q, mode: 'insensitive' } },
                        { model: { contains: q, mode: 'insensitive' } }
                    ]
                },
                select: { id: true, imei: true, brand: true, model: true, status: true, devicePhotos: true },
                take: 10
            })
        ]);

        res.json({ results: { users, devices } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ DOCUMENT VIEWER ============
router.get('/documents', authenticateAdmin, async (req, res) => {
    try {
        const usersWithDocs = await prisma.user.findMany({
            where: {
                OR: [
                    { NOT: { cacCertificateUrl: null } },
                    { NOT: { shopPhotoUrl: null } },
                    { NOT: { facialDataUrl: null } },
                    { NOT: { biodataUrl: null } }
                ]
            },
            select: {
                id: true, email: true, fullName: true, companyName: true, role: true,
                cacCertificateUrl: true, shopPhotoUrl: true, facialDataUrl: true, biodataUrl: true
            },
            orderBy: { createdAt: 'desc' }
        });

        const devicesWithDocs = await prisma.device.findMany({
            where: {
                OR: [
                    { NOT: { devicePhotos: { equals: [] } } },
                    { NOT: { purchaseReceiptUrl: null } },
                    { NOT: { cartonPhotoUrl: null } }
                ]
            },
            select: {
                id: true, imei: true, brand: true, model: true,
                devicePhotos: true, purchaseReceiptUrl: true, cartonPhotoUrl: true,
                registeredOwner: { select: { email: true, fullName: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({
            userDocuments: usersWithDocs || [],
            deviceDocuments: devicesWithDocs || []
        });
    } catch (error) {
        console.error('Document Retrieval Error:', error);
        res.status(500).json({ error: 'Internal server error while retrieving document registry' });
    }
});

// ============ MESSAGING ============
router.get('/messages', authenticateAdmin, async (req, res) => {
    try {
        const messages = await prisma.message.findMany({
            where: {
                OR: [
                    { receiverRole: 'ADMIN' },
                    { senderId: req.user.id }
                ]
            },
            include: { sender: { select: { email: true, fullName: true, role: true } }, receiver: { select: { email: true } } },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ messages });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/messages', authenticateAdmin, async (req, res) => {
    try {
        const { subject, body, receiverRole, receiverId } = req.body;

        if (!subject || !body || (!receiverRole && !receiverId)) {
            return res.status(400).json({ error: 'Subject, body, and either receiverRole or receiverId are required' });
        }

        const messageData = {
            senderId: req.user.id,
            subject,
            body
        };

        if (receiverId) {
            messageData.receiverId = receiverId;
        } else if (receiverRole) {
            messageData.receiverRole = receiverRole;
        }

        const message = await prisma.message.create({
            data: messageData
        });

        res.status(201).json({ message: 'Message sent', data: message });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin deletes a message
router.delete('/messages/:id', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.message.delete({ where: { id } });
        res.json({ message: 'Message deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ AUTH REQUESTS ============
router.get('/password-reset-requests', authenticateAdmin, async (req, res) => {
    try {
        const requests = await prisma.passwordResetRequest.findMany({
            include: { user: { select: { id: true, email: true, role: true, fullName: true } } },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ requests });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/password-reset-requests/:id/approve', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const resetRequest = await prisma.passwordResetRequest.findUnique({ where: { id } });
        if (!resetRequest) return res.status(404).json({ error: 'Request not found' });
        if (resetRequest.status !== 'PENDING') return res.status(400).json({ error: 'Request already processed' });

        await prisma.$transaction([
            prisma.user.update({
                where: { id: resetRequest.userId },
                data: { password: resetRequest.newPasswordHash }
            }),
            prisma.passwordResetRequest.update({
                where: { id },
                data: { status: 'APPROVED' }
            })
        ]);

        res.json({ message: 'Password reset approved and updated.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/password-reset-requests/:id/reject', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;
        await prisma.passwordResetRequest.update({
            where: { id },
            data: { status: 'REJECTED', adminNotes: notes }
        });
        res.json({ message: 'Password reset rejected.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
