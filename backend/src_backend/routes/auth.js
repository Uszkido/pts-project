const express = require('express');
const router = express.Router();
const prisma = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_pts_dev_key';

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
            // Use lazy require logic for circular safety if needed
            const wp = require('./whatsapp');
            if (wp.sendWhatsAppMessage) await wp.sendWhatsAppMessage(null, cleanNum, text);
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
            const mailOptions = {
                from: `"PTS National Registry" <${process.env.EMAIL_USER}>`,
                to: user.email,
                subject: aiContent.subject,
                html: aiContent.body
            };
            const transportInstance = getTransporter();
            if (transportInstance) await transportInstance.sendMail(mailOptions);
        }
    } catch (err) {
        console.error('⚠️ Bot/Email OTP dispatch failed:', err.message);
    }
};

router.post('/register/start', async (req, res) => {
    try {
        const result = await startRegistration(req.body);
        if (!result.success) return res.status(400).json(result);

        // Background dispatch
        sendOtpViaBots(result.user, result.otp, "registration");

        res.json({ message: 'Registration started. OTP sent.', email: result.user.email });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error starting registration' });
    }
});

router.post('/register/verify', async (req, res) => {
    try {
        const { email, otp } = req.body;
        const result = await finalizeRegistration(email, otp);
        if (!result.success) return res.status(400).json(result);
        res.json({ message: 'Registration complete. You can now login.', user: result.user });
    } catch (err) {
        res.status(500).json({ error: 'Server error verifying registration' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, email: user.email, role: user.role, fullName: user.fullName } });
    } catch (err) {
        res.status(500).json({ error: 'Server error during login' });
    }
});

module.exports = router;
