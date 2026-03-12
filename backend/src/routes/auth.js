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
const { generateAiOtpEmailContent } = require('../services/aiService');
const { startRegistration, finalizeRegistration } = require('../services/userService');

// Email Transporter (Lazy loaded to ensure env variables are loaded)
let transporter = null;
const getTransporter = () => {
    if (transporter) return transporter;
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn("⚠️ Email credentials are not defined in .env. Email OTPs will fail.");
        return null;
    }
    transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
    return transporter;
};

const sendOtpViaBots = async (user, otp, mode = "verification") => {
    console.log(`📡 Attempting to send OTP (${otp}) to user ${user.email || user.id}`);
    const text = `🔐 *PTS National Registry*\n\nYour Verification OTP is: *${otp}*\n\nPlease use this to verify your account.`;

    try {
        // 1. Send via WhatsApp
        if (user.phoneNumber) {
            console.log(`💬 WhatsApp: Cleaning phone ${user.phoneNumber}`);
            let cleanNum = user.phoneNumber.replace(/[\+\s\-()]/g, '');
            if (!cleanNum.startsWith('234') && cleanNum.startsWith('0')) {
                cleanNum = '234' + cleanNum.substring(1);
            }
            console.log(`💬 WhatsApp: Sending to ${cleanNum}`);
            await sendWhatsAppMessage(null, cleanNum, text);
        }

        // 2. Send via Telegram
        if (user.email && user.email.endsWith('@telegram.local')) {
            const chatId = user.email.replace('@telegram.local', '');
            console.log(`🤖 Telegram: Sending to chat ${chatId}`);
            await sendTelegramMessage(chatId, text);
        }

        // 3. 📧 Automatically Send via Email with AI Content
        if (user.email && !user.email.endsWith('.local')) {
            console.log(`📧 Email: Generating AI content for ${user.email}`);
            const aiContent = await generateAiOtpEmailContent(user.fullName || "Valued User", otp, mode);
            const currentTransporter = getTransporter();

            if (!currentTransporter) {
                console.error("❌ Cannot send email: Transporter not initialized.");
                return;
            }

            const mailOptions = {
                from: `"PTS Sentinel (Vexel AI)" <${process.env.EMAIL_USER}>`,
                to: user.email,
                subject: aiContent.subject,
                text: aiContent.body,
                html: `<div style="font-family: Arial, sans-serif; border: 1px solid #ddd; padding: 30px; border-radius: 12px; max-width: 600px; margin: auto; background-color: #ffffff; color: #333; text-align: center;">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <h1 style="color: #2e7d32; font-size: 28px; margin: 0;">🇳🇬 PTS Sentinel (Vexel AI)</h1>
                            <p style="color: #666; font-size: 14px; margin: 5px 0;">Sovereign Device Security System</p>
                        </div>
                        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; border-left: 5px solid #2e7d32; margin-bottom: 20px;">
                            <p style="font-size: 16px; line-height: 1.6; color: #444; margin: 0; text-align: left;">${aiContent.body}</p>
                        </div>
                        <div style="background-color: #e8f5e9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                            <p style="font-size: 14px; color: #2e7d32; margin: 0;"><b>Never share this code with anyone.</b> Authorities will never ask for your OTP.</p>
                        </div>
                        <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center;">🛡️ Managed by National Device Integrity Registry Nigeria <br><b>Powered by Vexel Innovations</b></p>
                       </div>`
            };

            console.log(`📧 Email: Sending SMTP request to ${user.email} from ${process.env.EMAIL_USER}`);
            await currentTransporter.sendMail(mailOptions);
            console.log(`✅ AI Personalized Email OTP sent to ${user.email}`);
        }
    } catch (err) {
        console.error('🛑 Critical Error in sendOtpViaBots:', err);
    }
};

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

router.post('/register', async (req, res) => {
    console.log(`📥 Registration START: ${req.body.email}`);
    try {
        const { pending, otp } = await startRegistration(req.body);

        // 🤖 Send OTP via Bots
        await sendOtpViaBots(pending, otp, "verification");

        res.status(201).json({
            message: 'Registration initiated. Please confirm the OTP sent to your Email/WhatsApp/Telegram to complete your account setup.',
            requiresOtp: true
        });
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: error.message });
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
            await sendOtpViaBots(user, newOtp, "verification");

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
        await sendOtpViaBots(user, otp, "reset");

        res.json({ message: 'Password reset request submitted. An OTP has been sent to your WhatsApp/Telegram, or contact your administrator.', requiresOtp: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/verify-email', async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await finalizeRegistration(email, otp);

        res.json({ message: 'Identity confirmed and account registered successfully! You can now log in.', userId: user.id });
    } catch (error) {
        res.status(400).json({ error: error.message });
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

router.sendOtpViaBots = sendOtpViaBots;
module.exports = router;
