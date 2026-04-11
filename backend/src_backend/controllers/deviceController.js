const deviceService = require('../services/deviceService');
const { sendSuccess, sendError } = require('../utils/response');

const createDevice = async (req, res, next) => {
    try {
        const vendorId = req.user.userId;
        const ip = req.ip || req.headers['x-forwarded-for'];
        const result = await deviceService.registerDevice(vendorId, req.body, ip);
        sendSuccess(res, result, 'Device registered successfully', 201);
    } catch (err) {
        next(err);
    }
};

const verifyDevice = async (req, res, next) => {
    try {
        const { imei } = req.params;
        const device = await deviceService.getDeviceDetails(imei);

        if (!device) {
            return res.status(404).json({ message: 'Device not found in registry. Status unknown.' });
        }

        const { calculateValuation } = require('../utils/valuation');

        sendSuccess(res, {
            device: {
                imei: device.imei,
                brand: device.brand,
                model: device.model,
                status: device.status,
                riskScore: device.riskScore,
                chainIntegrity: device.chainIntegrity,
                registeredBy: device.registeredOwner.companyName || 'Private Owner',
                devicePhotos: device.devicePhotos,
                estimatedValue: calculateValuation({ ...device }),
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
        }, 'Device verified');
    } catch (err) {
        next(err);
    }
};

const reportDevice = async (req, res, next) => {
    try {
        const { imei } = req.params;
        const { status } = req.body;
        const userId = req.user.userId;

        const updatedDevice = await deviceService.reportDevice(userId, imei, status);
        sendSuccess(res, updatedDevice, `Device marked as ${status}`);
    } catch (err) {
        next(err);
    }
};

module.exports = {
    createDevice,
    verifyDevice,
    reportDevice
};
