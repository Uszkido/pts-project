const policeService = require('../services/policeService');
const { sendSuccess, sendError } = require('../utils/response');

const getDevices = async (req, res, next) => {
    try {
        const devices = await policeService.getDevices(req.query.status);
        sendSuccess(res, { devices }, 'Devices retrieved');
    } catch (err) {
        next(err);
    }
};

const updateStatus = async (req, res, next) => {
    try {
        const { imei } = req.params;
        const { status } = req.body;
        const device = await policeService.updateDeviceStatus(imei, status);
        sendSuccess(res, { device }, `Device status updated to ${status}`);
    } catch (err) {
        next(err);
    }
};

const getMetrics = async (req, res, next) => {
    try {
        const metrics = await policeService.getMetrics();
        sendSuccess(res, { metrics }, 'Police metrics retrieved');
    } catch (err) {
        next(err);
    }
};

const getDossier = async (req, res, next) => {
    try {
        const { imei } = req.params;
        const dossier = await policeService.getForensicDossier(imei, req.user.email);
        if (!dossier) return sendError(res, 'Device not found', 404);
        sendSuccess(res, { dossier }, 'Forensic dossier generated');
    } catch (err) {
        next(err);
    }
};

const brick = async (req, res, next) => {
    try {
        const { imei } = req.params;
        const { reason } = req.body;
        const result = await policeService.brickDevice(imei, req.user.userId, reason);
        if (!result) return sendError(res, 'Device not found', 404);
        sendSuccess(res, { imei }, 'Kill-switch activated');
    } catch (err) {
        next(err);
    }
};

const unbrick = async (req, res, next) => {
    try {
        const { imei } = req.params;
        const result = await policeService.unbrickDevice(imei, req.user.userId);
        if (!result) return sendError(res, 'Device not found', 404);
        sendSuccess(res, { imei }, 'Kill-switch deactivated');
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getDevices,
    updateStatus,
    getMetrics,
    getDossier,
    brick,
    unbrick
};
