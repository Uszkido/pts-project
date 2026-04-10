const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/register/start', authController.registerStart);
router.post('/register/verify', authController.registerVerify);
router.post('/login', authController.login);

module.exports = router;
