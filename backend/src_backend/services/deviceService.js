const prisma = require('../db');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { analyzeImageELA } = require('./elaForensics');
const { evaluateLazarusProtocol, detectSyndicateCollusion } = require('./DeepSecurityAI');
const { analyzeDeviceHardwareCondition } = require('./aiService');
const { sealTransaction } = require('../utils/Blockchain');

/**
 * Registers a new device with forensic and hardware sequence checks.
 */
const registerDevice = async (vendorId, data, ip) => {
    const {
        imei, serialNumber, brand, model, devicePhotos, purchaseReceiptUrl, cartonPhotoUrl,
        screenSerialNumber, batterySerialNumber, motherboardSerialNumber, cameraSerialNumber
    } = data;

    if (!imei || !brand || !model) {
        throw new Error('IMEI, brand, and model are required');
    }

    // Check if IMEI already exists
    const existingDevice = await prisma.device.findUnique({ where: { imei } });
    if (existingDevice) throw new Error('Device with this IMEI already registered');

    // --- ELA Forensic Scan ---
    if (purchaseReceiptUrl) {
        const elaResult = await analyzeImageELA(purchaseReceiptUrl);
        logger.info(`[ELA] Receipt scan for vendor ${vendorId}: TamperScore=${elaResult.tamperScore}`);

        if (elaResult.isLikelyFaked && elaResult.confidence === 'HIGH') {
            await prisma.vendorSuspiciousAlert.create({
                data: {
                    deviceId: 'FORGERY_ATTEMPT',
                    vendorId: vendorId,
                    description: `🔬 ELA Engine flagged receipt as FORGED (${elaResult.tamperScore}/100). Verdict: ${elaResult.verdict}.`
                }
            }).catch(() => { });
            throw new Error(`Document Forgery Detected: ${elaResult.verdict}`);
        }
    }

    // --- Lazarus Protocol (Chop-Shop Detection) ---
    const lazarusCheck = await evaluateLazarusProtocol(screenSerialNumber, batterySerialNumber, motherboardSerialNumber, cameraSerialNumber);
    if (lazarusCheck.isFrankenstein) {
        throw new Error(`SECURITY LOCK: Hardware Mismatch - ${lazarusCheck.reason}`);
    }

    // --- Syndicate Mapper ---
    const syndicateCheck = await detectSyndicateCollusion(vendorId, ip);
    if (syndicateCheck.isColluding) {
        const tScore = await prisma.vendorTrustScore.findUnique({ where: { vendorId } });
        if (tScore) {
            await prisma.vendorTrustScore.update({
                where: { vendorId },
                data: { score: Math.max(0, tScore.score - 50) }
            });
        }
    }

    const hardwareDnaHash = (motherboardSerialNumber && batterySerialNumber)
        ? crypto.createHash('sha256').update(`${motherboardSerialNumber}-${batterySerialNumber}-${cameraSerialNumber || 'U'}`).digest('hex')
        : null;

    const device = await prisma.device.create({
        data: {
            imei, serialNumber, brand, model,
            registeredOwnerId: vendorId,
            devicePhotos: devicePhotos || [],
            purchaseReceiptUrl, cartonPhotoUrl,
            screenSerialNumber, batterySerialNumber, motherboardSerialNumber, cameraSerialNumber,
            hardwareDnaHash
        }
    });

    // --- AI Hardware Appraisal ---
    if (devicePhotos && devicePhotos.length > 0) {
        try {
            const hardwareGrade = await analyzeDeviceHardwareCondition(devicePhotos, brand, model);
            if (hardwareGrade.grade !== "Unknown") {
                const desc = `Visual Grade: ${hardwareGrade.grade}. AI Notes: ${hardwareGrade.notes}.`;
                const ts = new Date();
                const hash = sealTransaction('0', "AI_HARDWARE_APPRAISAL", { data: desc }, ts);
                await prisma.transactionHistory.create({
                    data: {
                        deviceId: device.id, actorId: vendorId,
                        type: "AI_HARDWARE_APPRAISAL", description: desc, hash, isSealed: true, createdAt: ts
                    }
                });
            }
        } catch (e) {
            logger.warn(`Hardware appraisal failed for device ${device.id}: ${e.message}`);
        }
    }

    // --- DDOC Certificate ---
    const ddocHash = crypto.createHash('sha256').update(`${device.id}-${vendorId}-${Date.now()}`).digest('hex');
    const certificate = await prisma.certificate.create({
        data: { deviceId: device.id, ownerId: vendorId, qrHash: ddocHash }
    });

    return { device, certificate };
};

/**
 * Fetches device details and calculates current risk.
 */
const getDeviceDetails = async (imei) => {
    const device = await prisma.device.findUnique({
        where: { imei },
        include: {
            registeredOwner: { select: { id: true, companyName: true, email: true } },
            maintenance: { include: { vendor: { select: { vendorTier: true, companyName: true } } }, orderBy: { serviceDate: 'desc' } },
            incidents: { where: { status: 'OPEN' }, select: { bounty: true, type: true } },
            transfersAsDevice: { include: { seller: { select: { id: true, companyName: true, email: true, role: true, fullName: true } }, buyer: { select: { id: true, companyName: true, email: true, role: true, fullName: true } } }, orderBy: { transferDate: 'asc' } },
            history: { orderBy: { createdAt: 'desc' } }
        }
    });

    if (!device) return null;

    // Log scan alert as a background process
    prisma.message.create({
        data: {
            senderId: device.registeredOwnerId,
            receiverId: device.registeredOwnerId,
            subject: '🚨 SECURITY SIGNAL: Registry Check',
            body: `Target device ${device.brand} ${device.model} (IMEI: ${device.imei}) was just processed by a verification terminal. Timestamp: ${new Date().toLocaleString()}.`
        }
    }).catch(err => logger.error('Failed to log scan alert:', err.message));

    const RiskEngine = require('./RiskEngine');
    const riskScore = await RiskEngine.calculateDeviceTrustIndex(imei);

    const { verifyChainIntegrity } = require('../utils/Blockchain');
    const chainStatus = verifyChainIntegrity(device.history || []);

    return {
        ...device,
        riskScore,
        chainIntegrity: chainStatus.valid ? 'VERIFIED_IMMUTABLE' : 'TAMPERED_WARNING'
    };
};

/**
 * Reports a device as stolen or lost.
 */
const reportDevice = async (userId, imei, status) => {
    if (!['STOLEN', 'LOST'].includes(status)) {
        throw new Error('Invalid status. Must be STOLEN or LOST');
    }

    const device = await prisma.device.findUnique({ where: { imei } });
    if (!device) throw new Error('Device not found');
    if (device.registeredOwnerId !== userId) throw new Error('Unauthorized to report this device');

    return await prisma.device.update({
        where: { imei },
        data: { status }
    });
};

module.exports = {
    registerDevice,
    getDeviceDetails,
    reportDevice
};
