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

const resetPassword = async (req, res, next) => {
    try {
        const { email, newPassword } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return sendError(res, 'User not found in registry', 404);

        const hashedPass = await bcrypt.hash(newPassword, 10);
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        await prisma.passwordResetRequest.create({
            data: {
                userId: user.id,
                newPasswordHash: hashedPass,
                otp,
                status: 'PENDING'
            }
        });

        // Background dispatch
        sendOtp(user, otp, "reset");

        sendSuccess(res, { email, requiresOtp: true }, 'Reset request initialized. OTP sent.', 200);
    } catch (err) {
        next(err);
    }
};

const verifyResetOtp = async (req, res, next) => {
    try {
        const { email, otp } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return sendError(res, 'User not found', 404);

        const request = await prisma.passwordResetRequest.findFirst({
            where: { userId: user.id, otp, status: 'PENDING' },
            orderBy: { createdAt: 'desc' }
        });

        if (!request) return sendError(res, 'Invalid or expired OTP', 400);

        // Update user password
        await prisma.user.update({
            where: { id: user.id },
            data: { password: request.newPasswordHash }
        });

        // Finalize request
        await prisma.passwordResetRequest.update({
            where: { id: request.id },
            data: { status: 'COMPLETED' }
        });

        sendSuccess(res, null, 'Password reset successful. You can now login.');
    } catch (err) {
        next(err);
    }
};

module.exports = {
    registerStart,
    registerVerify,
    login,
    resetPassword,
    verifyResetOtp
};
