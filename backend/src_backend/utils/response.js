const sendSuccess = (res, data, message = 'Success', status = 200) => {
    res.status(status).json({
        success: true,
        message,
        data
    });
};

const sendError = (res, error, status = 500) => {
    const message = typeof error === 'string' ? error : error.message || 'Internal Server Error';
    const details = typeof error === 'object' ? error.details || null : null;

    res.status(status).json({
        success: false,
        error: message,
        details: details
    });
};

module.exports = { sendSuccess, sendError };
