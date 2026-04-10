const prisma = require('../db');
const logger = require('../utils/logger');

/**
 * Fetches global stats for the admin dashboard.
 */
const getDashboardStats = async () => {
    const [totalUsers, totalDevices, totalIncidents, totalSuspects, pendingVendors] = await Promise.all([
        prisma.user.count(),
        prisma.device.count(),
        prisma.incidentReport.count(),
        prisma.suspect.count(),
        prisma.user.count({ where: { role: 'VENDOR', vendorStatus: 'PENDING' } })
    ]);

    const usersByRole = await prisma.user.groupBy({ by: ['role'], _count: true });
    const devicesByStatus = await prisma.device.groupBy({ by: ['status'], _count: true });

    return {
        stats: { totalUsers, totalDevices, totalIncidents, totalSuspects, pendingVendors },
        usersByRole: usersByRole.map(r => ({ role: r.role, count: r._count })),
        devicesByStatus: devicesByStatus.map(d => ({ status: d.status, count: d._count }))
    };
};

/**
 * Fetches map data for surveillance.
 */
const getMapData = async () => {
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
    const seenImeis = new Set(obsPings.map(p => p.device?.imei));

    for (const log of trackingLogs) {
        if (!seenImeis.has(log.deviceImei)) {
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

    return { vendors, pings };
};

module.exports = {
    getDashboardStats,
    getMapData
};
