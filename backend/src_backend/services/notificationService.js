const logger = require('../utils/logger');
const { sendWhatsAppMessage } = require('./whatsappService');
const { sendTelegramMessage } = require('./telegramOracle');
const { generateAiOtpEmailContent } = require('./aiService');
const nodemailer = require('nodemailer');

let transporter = null;
const getTransporter = () => {
    if (transporter) return transporter;
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        logger.warn("⚠️ Email credentials are not defined in .env. Email OTPs will fail.");
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

/**
 * Sends an OTP via multiple channels (WhatsApp, Telegram, Email)
 */
const sendOtp = async (user, otp, mode = "verification") => {
    logger.info(`📡 Attempting to send OTP (${otp}) to user ${user.email || user.id}`);
    const text = `🔐 *PTS National Registry - SOVEREIGN SECURITY NOTICE*\n\nYour Verification OTP is: *${otp}*\n\n⚠️ *CAUTION:* Never share this code with anyone. PTS officials will NEVER ask for your OTP. This code verifies your legal ownership of digital assets. If you did not request this, please contact the PTS Cyber-Response unit immediately.`;

    try {
        // 1. WhatsApp
        if (user.phoneNumber) {
            let cleanNum = user.phoneNumber.replace(/[\+\s\-()]/g, '');
            if (!cleanNum.startsWith('234') && cleanNum.startsWith('0')) {
                cleanNum = '234' + cleanNum.substring(1);
            }
            await sendWhatsAppMessage(null, cleanNum, text);
        }

        // 2. Telegram
        if (user.email && user.email.endsWith('@telegram.local')) {
            const chatId = user.email.replace('@telegram.local', '');
            await sendTelegramMessage(chatId, text);
        }

        // 3. Email
        if (user.email && !user.email.endsWith('.local')) {
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
        logger.error('⚠️ Bot/Email OTP dispatch failed:', err.message);
    }
};

module.exports = { sendOtp };
