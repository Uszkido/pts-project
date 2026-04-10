const adminService = require('../services/adminService');
const { sendSuccess } = require('../utils/response');

const getDashboard = async (req, res, next) => {
    try {
        const stats = await adminService.getDashboardStats();
        sendSuccess(res, stats, 'Dashboard stats retrieved');
    } catch (err) {
        next(err);
    }
};

const getMap = async (req, res, next) => {
    try {
        const data = await adminService.getMapData();
        sendSuccess(res, data, 'Map data retrieved');
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getDashboard,
    getMap
};
