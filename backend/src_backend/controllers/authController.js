const prisma = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { startRegistration, finalizeRegistration } = require('../services/userService');
const { sendOtp } = require('../services/notificationService');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_pts_dev_key';

const registerStart = async (req, res, next) => {
    try {
        const result = await startRegistration(req.body);

        // Background dispatch
        sendOtp(result.pending, result.otp, "registration");

        sendSuccess(res, { email: result.pending.email }, 'Registration started. OTP sent.', 200);
    } catch (err) {
        next(err);
    }
};

const registerVerify = async (req, res, next) => {
    try {
        const { email, otp } = req.body;
        const user = await finalizeRegistration(email, otp);
        sendSuccess(res, { user: { id: user.id, email: user.email, role: user.role } }, 'Registration complete. You can now login.', 200);
    } catch (err) {
        next(err);
    }
};

const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return sendError(res, 'Invalid credentials', 401);
        }

        const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

        logger.info(`User logged in: ${user.email}`);

        sendSuccess(res, {
            token,
            user: { id: user.id, email: user.email, role: user.role, fullName: user.fullName }
        }, 'Login successful');
    } catch (err) {
        next(err);
    }
};

module.exports = {
    registerStart,
    registerVerify,
    login
};
