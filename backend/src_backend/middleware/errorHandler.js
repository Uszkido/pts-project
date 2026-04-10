const { sendError } = require('../utils/response');
const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
    logger.error(`${req.method} ${req.url} - ${err.message}`, err.stack);

    if (err.name === 'UnauthorizedError') {
        return sendError(res, 'Unauthorized access', 401);
    }

    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';

    sendError(res, message, status);
};

module.exports = errorHandler;
