const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const prisma = new PrismaClient();
const JWT_SECRET = 'supersecret_pts_dev_key';

const { sendWhatsAppMessage } = require('./whatsapp');
const { sendTelegramMessage } = require('../services/telegramOracle');

// Email Transporter (Update these with actual credentials in .env later)
const transporter = nodemailer.createTransport({
    service: 'gmail', // Or your preferred email service
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendOtpViaBots = async (user, otp) => {
    const text = `🔐 *PTS National Registry*\n\nYour Verification OTP is: *${otp}*\n\nPlease use this to verify your account.`;

    // 1. Send via WhatsApp
    if (user.phoneNumber) {
        let cleanNum = user.phoneNumber.replace(/[\+\s\-()]/g, '');
        if (!cleanNum.startsWith('234') && cleanNum.startsWith('0')) {
            cleanNum = '234' + cleanNum.substring(1);
        }
        await sendWhatsAppMessage(null, cleanNum, text);
    }

    // 2. Send via Telegram
    if (user.email && user.email.endsWith('@telegram.local')) {
        const chatId = user.email.replace('@telegram.local', '');
        await sendTelegramMessage(chatId, text);
    }

    // 3. 📧 Automatically Send via Email
    if (user.email && !user.email.endsWith('.local')) {
        const mailOptions = {
            from: `"PTS National Registry" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: 'Verification OTP - PTS National Registry',
            text: `Your Verification OTP is: ${otp}`,
            html: `<div style="font-family: Arial, sans-serif; border: 1px solid #ddd; padding: 20px; border-radius: 10px;">
                    <h2 style="color: #2e7d32;">PTS National Registry</h2>
                    <p>Hello <b>${user.fullName || 'User'}</b>,</p>
                    <p>Your Verification OTP is:</p>
                    <div style="font-size: 24px; font-weight: bold; background: #f4f4f4; padding: 10px; display: inline-block; border-radius: 5px;">${otp}</div>
                    <p>Please use this to verify your account. If you did not request this, please ignore this email.</p>
                    <p style="color: #777; font-size: 12px; margin-top: 20px;">&copy; 2026 PTS National Registry Nigeria.</p>
                   </div>`
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`✅ Email OTP sent to ${user.email}`);
        } catch (error) {
            console.error('❌ Failed to send email OTP:', error);
        }
    }
};

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
                shopLatitude: finalRole === 'VENDOR' && shopLatitude && !isNaN(parseFloat(shopLatitude)) ? parseFloat(shopLatitude) : null,
                shopLongitude: finalRole === 'VENDOR' && shopLongitude && !isNaN(parseFloat(shopLongitude)) ? parseFloat(shopLongitude) : null,
                shopPhotoUrl: finalRole === 'VENDOR' ? shopPhotoUrl : null,
                businessRegNo: finalRole === 'VENDOR' ? businessRegNo : null,
                vendorStatus: finalRole === 'VENDOR' ? 'PENDING' : 'APPROVED',
                phoneNumber,
                address,
                isEmailConfirmed: false,
                emailVerificationOtp: otp
            }
        });

        // 🤖 Send OTP via Bots
        await sendOtpViaBots(user, otp);

        res.status(201).json({
            message: finalRole === 'VENDOR'
                ? 'Vendor registration submitted. An OTP has been sent via WhatsApp/Telegram (if provided), or check with admin to verify your email.'
                : 'User registered. An OTP has been sent via WhatsApp/Telegram, or check with admin to verify.',
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
            // Generate and send a fresh OTP if they try to login while unverified
            const newOtp = generateOTP();
            await prisma.user.update({
                where: { id: user.id },
                data: { emailVerificationOtp: newOtp }
            });
            await sendOtpViaBots(user, newOtp);

            return res.status(403).json({ error: 'Please confirm your email. A new OTP has been sent to your WhatsApp/Telegram (or check with admin).', requiresOtp: true });
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

        // 🤖 Send Reset OTP via Bots
        await sendOtpViaBots(user, otp);

        res.json({ message: 'Password reset request submitted. An OTP has been sent to your WhatsApp/Telegram, or contact your administrator.', requiresOtp: true });
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
