const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/register/start', authController.registerStart);
router.post('/register/verify', authController.registerVerify);
router.post('/register', authController.registerStart); // Compatibility alias
router.post('/verify-email', authController.registerVerify); // Compatibility alias
router.post('/login', authController.login);
router.post('/reset-password', authController.resetPassword);
router.post('/verify-reset-otp', authController.verifyResetOtp);

module.exports = router;
