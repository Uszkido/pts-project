const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

router.post('/register/start', authLimiter, authController.registerStart);
router.post('/register/verify', authLimiter, authController.registerVerify);
router.post('/register', authLimiter, authController.registerStart);
router.post('/verify-email', authLimiter, authController.registerVerify);
router.post('/login', authLimiter, authController.login);
router.post('/reset-password', authLimiter, authController.resetPassword);
router.post('/verify-reset-otp', authLimiter, authController.verifyResetOtp);

module.exports = router;
