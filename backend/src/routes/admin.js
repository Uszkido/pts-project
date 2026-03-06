const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
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
                vendorTier: true, vendorStatus: true, nationalId: true,
                businessAddress: true, shopLatitude: true, shopLongitude: true,
                shopPhotoUrl: true, businessRegNo: true, cacCertificateUrl: true,
                createdAt: true,
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

// ============ DEVICE OVERVIEW ============
router.get('/devices', authenticateAdmin, async (req, res) => {
    try {
        const { status } = req.query;
        const where = status ? { status } : {};

        const devices = await prisma.device.findMany({
            where,
            include: {
                registeredOwner: { select: { email: true, companyName: true, fullName: true } }
            },
            orderBy: { updatedAt: 'desc' },
            take: 100
        });

        res.json({ devices });
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

module.exports = router;
