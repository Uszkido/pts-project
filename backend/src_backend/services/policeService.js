const prisma = require('../db');
const logger = require('../utils/logger');
const crypto = require('crypto');

/**
 * Fetches devices based on status.
 */
const getDevices = async (status) => {
    const rawStatus = status || 'STOLEN,LOST';
    const statusList = rawStatus.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

    return await prisma.device.findMany({
        where: { status: { in: statusList } },
        include: { registeredOwner: { select: { email: true, companyName: true } } },
        orderBy: { updatedAt: 'desc' }
    });
};

/**
 * Updates a device's status as part of law enforcement actions.
 */
const updateDeviceStatus = async (imei, status) => {
    const allowedStatuses = ['CLEAN', 'STOLEN', 'LOST', 'INVESTIGATING'];
    if (!allowedStatuses.includes(status)) throw new Error('Invalid status');

    return await prisma.device.update({
        where: { imei },
        data: { status }
    });
};

/**
 * Returns metrics for the police dashboard.
 */
const getMetrics = async () => {
    const [total, clean, stolen, lost, investigating, openIncidents, openAlerts] = await Promise.all([
        prisma.device.count(),
        prisma.device.count({ where: { status: 'CLEAN' } }),
        prisma.device.count({ where: { status: 'STOLEN' } }),
        prisma.device.count({ where: { status: 'LOST' } }),
        prisma.device.count({ where: { status: 'INVESTIGATING' } }),
        prisma.incidentReport.count({ where: { status: 'OPEN' } }),
        prisma.vendorSuspiciousAlert.count()
    ]);

    return {
        totalDevices: total,
        cleanDevices: clean,
        stolenDevices: stolen,
        lostDevices: lost,
        investigatingDevices: investigating,
        openIncidents,
        openAlerts
    };
};

/**
 * Compiles a forensic dossier for a device.
 */
const getForensicDossier = async (imei, officialEmail) => {
    const device = await prisma.device.findUnique({
        where: { imei },
        include: {
            registeredOwner: true,
            history: { include: { actor: { select: { fullName: true, role: true, companyName: true } } }, orderBy: { createdAt: 'desc' } },
            incidents: { include: { reporter: true } },
            maintenance: { include: { vendor: true } },
            transfersAsDevice: { include: { seller: true, buyer: true }, where: { status: 'COMPLETED' } }
        }
    });

    if (!device) return null;

    return {
        reportId: `FOR-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        generatedAt: new Date(),
        generatedBy: officialEmail,
        asset: {
            brand: device.brand, model: device.model, imei: device.imei,
            serial: device.serialNumber, status: device.status, riskScore: device.riskScore,
            photos: device.devicePhotos || []
        },
        ownership: {
            current: device.registeredOwner?.fullName || device.registeredOwner?.companyName || device.registeredOwner?.email || 'N/A',
            chain: (device.transfersAsDevice || []).map(t => ({
                date: t.transferDate, from: t.seller?.email || 'Unknown', to: t.buyer?.email || 'Unknown'
            }))
        },
        incidents: (device.incidents || []).map(i => ({
            date: i.createdAt, type: i.type || 'STOLEN', desc: i.description || 'No description provided'
        })),
        maintenance: (device.maintenance || []).map(m => ({
            date: m.serviceDate, provider: m.vendor?.companyName || 'Unknown Vendor', type: m.serviceType || 'General Service'
        })),
        ledger: (device.history || []).map(h => ({
            date: h.createdAt, type: h.type, actor: h.actor?.role || 'System', details: h.description
        }))
    };
};

/**
 * Activates hardware kill-switch.
 */
const brickDevice = async (imei, userId, reason) => {
    const device = await prisma.device.findUnique({ where: { imei } });
    if (!device) return null;

    await prisma.device.update({
        where: { imei },
        data: { isBricked: true, status: 'STOLEN' }
    });

    await prisma.transactionHistory.create({
        data: {
            deviceId: device.id,
            actorId: userId,
            type: 'HARDWARE_BRICKED',
            description: `DEVICE KILL-SWITCH ACTIVATED. Reason: ${reason || 'Reported Stolen/Malicious activity'}`,
            metadata: JSON.stringify({ timestamp: new Date(), officialId: userId })
        }
    });

    return device;
};

/**
 * Deactivates hardware kill-switch.
 */
const unbrickDevice = async (imei, userId) => {
    const device = await prisma.device.findUnique({ where: { imei } });
    if (!device) return null;

    await prisma.device.update({
        where: { imei },
        data: { isBricked: false }
    });

    await prisma.transactionHistory.create({
        data: {
            deviceId: device.id,
            actorId: userId,
            type: 'HARDWARE_RESTORED',
            description: 'Kill-switch deactivated. Device hardware functionality restored.',
            metadata: JSON.stringify({ timestamp: new Date(), officialId: userId })
        }
    });

    return device;
};

module.exports = {
    getDevices,
    updateDeviceStatus,
    getMetrics,
    getForensicDossier,
    brickDevice,
    unbrickDevice
};
