const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = 'supersecret_pts_dev_key';

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

router.post('/register', async (req, res) => {
    try {
        const { email, password, companyName, role, fullName, nationalId, facialDataUrl, biodataUrl, cacCertificateUrl, businessAddress, shopLatitude, shopLongitude, shopPhotoUrl, businessRegNo, phoneNumber, address } = req.body;

        // Simple validation
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = generateOTP();

        const finalRole = role === 'CONSUMER' ? 'CONSUMER' : 'VENDOR';

        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                companyName: finalRole === 'VENDOR' ? companyName : null,
                role: finalRole,
                fullName,
                nationalId,
                facialDataUrl,
                biodataUrl,
                cacCertificateUrl: finalRole === 'VENDOR' ? cacCertificateUrl : null,
                businessAddress: finalRole === 'VENDOR' ? businessAddress : null,
                shopLatitude: finalRole === 'VENDOR' && shopLatitude ? parseFloat(shopLatitude) : null,
                shopLongitude: finalRole === 'VENDOR' && shopLongitude ? parseFloat(shopLongitude) : null,
                shopPhotoUrl: finalRole === 'VENDOR' ? shopPhotoUrl : null,
                businessRegNo: finalRole === 'VENDOR' ? businessRegNo : null,
                vendorStatus: finalRole === 'VENDOR' ? 'PENDING' : 'APPROVED',
                phoneNumber,
                address,
                isEmailConfirmed: false,
                emailVerificationOtp: otp
            }
        });

        res.status(201).json({
            message: finalRole === 'VENDOR' ? 'Vendor registration submitted. Please verify your email with the OTP from admin.' : 'User registered. Please verify your email with the OTP.',
            userId: user.id,
            requiresOtp: true
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (user.status === 'SUSPENDED') {
            return res.status(403).json({ error: 'Your account has been suspended. Please contact the administrator.' });
        }

        if (!user.isEmailConfirmed && !['ADMIN', 'POLICE', 'INSURANCE', 'TELECOM'].includes(user.role)) {
            return res.status(403).json({ error: 'Please confirm your email using the OTP before logging in.', requiresOtp: true });
        }

        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, role: user.role });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/reset-password', async (req, res) => {
    try {
        const { email, newPassword } = req.body;

        if (!email || !newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: 'Valid email and new password (min 6 characters) are required.' });
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            // Delay for security
            await new Promise(resolve => setTimeout(resolve, 500));
            return res.status(404).json({ error: 'No account found with that email address.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const otp = generateOTP();

        // Create request instead of updating directly
        await prisma.passwordResetRequest.create({
            data: {
                userId: user.id,
                newPasswordHash: hashedPassword,
                status: 'PENDING',
                otp: otp
            }
        });

        res.json({ message: 'Password reset request submitted. Please provide the OTP from the administrator to verify.', requiresOtp: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/verify-email', async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user || user.emailVerificationOtp !== otp) {
            return res.status(400).json({ error: 'Invalid OTP' });
        }

        await prisma.user.update({
            where: { id: user.id },
            data: { isEmailConfirmed: true, emailVerificationOtp: null }
        });

        res.json({ message: 'Email confirmed successfully. You can now log in.' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/verify-reset-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) return res.status(404).json({ error: 'User not found' });

        const request = await prisma.passwordResetRequest.findFirst({
            where: { userId: user.id, status: 'PENDING', otp: otp },
            orderBy: { createdAt: 'desc' }
        });

        if (!request) return res.status(400).json({ error: 'Invalid OTP' });

        res.json({ message: 'OTP verified. Awaiting final administrator approval.' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
