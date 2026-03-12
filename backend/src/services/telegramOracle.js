const TelegramBot = require('node-telegram-bot-api');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { generateLocalizedOracleResponse } = require('./aiService');
const { detectClonedImeiAnomaly } = require('./fraudEngine');
const { getSession, updateSession, clearSession } = require('./botState');
const bcrypt = require('bcryptjs');
const { uploadFromUrl } = require('./imageUploader');
const { startRegistration, finalizeRegistration } = require('./userService');

let telegramBotInstance = null;

const initTelegramOracle = () => {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
        console.warn('⚠️ TELEGRAM_BOT_TOKEN not provided in .env. Skipping PTS Telegram AI Oracle startup.');
        return;
    }

    // Uses polling to get updates. Safe for standard development.
    const bot = new TelegramBot(token, { polling: true });
    telegramBotInstance = bot;

    console.log('🤖 PTS Telegram AI Oracle is now active and polling for messages...');

    bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        clearSession('TELEGRAM', chatId);
        const resp = `Hello there! 👋 I am the *PTS Sentinel (Vexel AI)*. 🇳🇬\n\nBarka da zuwa! I'm here to help you verify the phone you are buying anywhere in Nigeria, so you don't end up with a stolen device.\n\nJust send me the *15-digit IMEI* of the phone you want to check, and I'll take a look for you! 😊\n\nCommands:\n- Type *register* to create your Sentinel Identity\n- Type *login* to access your account\n- Type *report* to flag your registered device as stolen`;
        bot.sendMessage(chatId, resp, { parse_mode: 'Markdown' });
    });

    // Listen for any standard message and try to extract an IMEI inside it
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text || '';
        const session = getSession('TELEGRAM', chatId);

        // Ignore start slash command so it doesnt double trigger
        if (text.startsWith('/start')) return;

        // == LOGIN FLOW ==
        if (text.toLowerCase() === 'login') {
            updateSession('TELEGRAM', chatId, 'AWAITING_LOGIN_EMAIL');
            bot.sendMessage(chatId, "Welcome back! Please enter your registered *Email Address*.", { parse_mode: 'Markdown' });
            return;
        }

        if (session.state === 'AWAITING_LOGIN_EMAIL') {
            updateSession('TELEGRAM', chatId, 'AWAITING_LOGIN_PASSWORD', { email: text });
            bot.sendMessage(chatId, "Got it! Now please enter your *Password*.", { parse_mode: 'Markdown' });
            return;
        }

        if (session.state === 'AWAITING_LOGIN_PASSWORD') {
            try {
                const user = await prisma.user.findUnique({ where: { email: session.data.email } });
                if (user && await bcrypt.compare(text, user.password)) {
                    updateSession('TELEGRAM', chatId, 'LOGGED_IN', { userId: user.id, fullName: user.fullName });
                    bot.sendMessage(chatId, `✅ Welcome, *${user.fullName}*! You are now logged in.\n\nYou can now use the *"report"* command to flag a stolen device.`, { parse_mode: 'Markdown' });
                } else {
                    bot.sendMessage(chatId, "❌ Invalid email or password. Please try again or type 'login' to restart.", { parse_mode: 'Markdown' });
                    clearSession('TELEGRAM', chatId);
                }
            } catch (e) {
                console.error(e);
                bot.sendMessage(chatId, "Error logging in. Please try again later.");
            }
            return;
        }

        // == REPORT FLOW ==
        if (text.toLowerCase() === 'report') {
            if (session.state !== 'LOGGED_IN') {
                bot.sendMessage(chatId, "You need to be logged in to report a stolen device. Please type *login* first.", { parse_mode: 'Markdown' });
                return;
            }
            updateSession('TELEGRAM', chatId, 'AWAITING_REPORT_IMEI');
            bot.sendMessage(chatId, "Please send the *15-digit IMEI* of the device you want to report as STOLEN.", { parse_mode: 'Markdown' });
            return;
        }

        if (session.state === 'AWAITING_REPORT_IMEI') {
            const imeiMatch = text.match(/\b\d{15}\b/);
            if (!imeiMatch) {
                bot.sendMessage(chatId, "That doesn't look like a 15-digit IMEI. Please dial *#06#* and send the 15 digits.", { parse_mode: 'Markdown' });
                return;
            }
            const imei = imeiMatch[0];
            try {
                const device = await prisma.device.findUnique({ where: { imei } });

                if (!device) {
                    bot.sendMessage(chatId, "❌ We couldn't find a device with that IMEI in the registry.", { parse_mode: 'Markdown' });
                } else if (device.registeredOwnerId !== session.data.userId) {
                    bot.sendMessage(chatId, "❌ You are not the registered owner of this device. Reporting is only allowed by the owner.", { parse_mode: 'Markdown' });
                } else {
                    await prisma.device.update({
                        where: { imei },
                        data: { status: 'STOLEN', riskScore: 0 }
                    });
                    bot.sendMessage(chatId, `🚨 *STOLEN REPORTED!* Your ${device.brand} ${device.model} (${imei}) has been marked as STOLEN in the National Registry. Authorities and vendors have been alerted.`, { parse_mode: 'Markdown' });
                }
            } catch (e) {
                console.error(e);
                bot.sendMessage(chatId, "Error processing report. Please try again.");
            }
            updateSession('TELEGRAM', chatId, 'LOGGED_IN'); // Return to logged in state
            return;
        }

        // == REGISTRATION FLOW ==
        if (text.toLowerCase() === 'register') {
            updateSession('TELEGRAM', chatId, 'AWAITING_REG_ROLE');
            bot.sendMessage(chatId, "Great! Let's get you registered in the National Registry.\n\nPlease select your *Account Type*:", {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '👤 Device Owner (Consumer)', callback_data: 'REG_ROLE_CONSUMER' }],
                        [{ text: '🏪 Shop Owner (Vendor)', callback_data: 'REG_ROLE_VENDOR' }]
                    ]
                }
            });
            return;
        }

        if (session.state === 'AWAITING_REG_NAME') {
            updateSession('TELEGRAM', chatId, 'AWAITING_REG_EMAIL', { fullName: text });
            bot.sendMessage(chatId, "Thank you. Now, please enter your *Email Address* (this will be your username).", { parse_mode: 'Markdown' });
            return;
        }

        if (session.state === 'AWAITING_REG_EMAIL') {
            updateSession('TELEGRAM', chatId, 'AWAITING_REG_PASS', { email: text });
            bot.sendMessage(chatId, "Next, set a secure *Password* for your account.", { parse_mode: 'Markdown' });
            return;
        }

        if (session.state === 'AWAITING_REG_PASS') {
            updateSession('TELEGRAM', chatId, 'AWAITING_REG_NIN', { password: text });
            bot.sendMessage(chatId, "Almost there! Please enter your *National ID Number (NIN)*.", { parse_mode: 'Markdown' });
            return;
        }

        if (session.state === 'AWAITING_REG_NIN') {
            updateSession('TELEGRAM', chatId, 'AWAITING_REG_PHONE', { nationalId: text });
            bot.sendMessage(chatId, "Please enter your *Phone Number* (starting with 234...).", { parse_mode: 'Markdown' });
            return;
        }

        if (session.state === 'AWAITING_REG_PHONE') {
            updateSession('TELEGRAM', chatId, 'AWAITING_REG_ADDRESS', { phoneNumber: text });
            bot.sendMessage(chatId, "Please enter your *Physical Residential Address*.", { parse_mode: 'Markdown' });
            return;
        }

        if (session.state === 'AWAITING_REG_ADDRESS') {
            updateSession('TELEGRAM', chatId, 'AWAITING_REG_PHOTO', { address: text });
            bot.sendMessage(chatId, "Verification Step: Please send a *Live Selfie (Photo)* of yourself for biometric identity verification.", { parse_mode: 'Markdown' });
            return;
        }

        // Vendor Specific Fields
        if (session.state === 'AWAITING_REG_BIZ_NAME') {
            updateSession('TELEGRAM', chatId, 'AWAITING_REG_BIZ_ADDR', { companyName: text });
            bot.sendMessage(chatId, "What is the *Physical Address* of your shop?", { parse_mode: 'Markdown' });
            return;
        }

        if (session.state === 'AWAITING_REG_BIZ_ADDR') {
            updateSession('TELEGRAM', chatId, 'AWAITING_REG_BIZ_REG', { businessAddress: text });
            bot.sendMessage(chatId, "Please enter your *CAC Registration Number* (if available).", { parse_mode: 'Markdown' });
            return;
        }

        if (session.state === 'AWAITING_REG_BIZ_REG') {
            updateSession('TELEGRAM', chatId, 'AWAITING_REG_SHOP_PHOTO', { businessRegNo: text });
            bot.sendMessage(chatId, "Verification: Please send a *Photo of your Shop Front*.", { parse_mode: 'Markdown' });
            return;
        }

        if (session.state === 'AWAITING_REG_OTP') {
            bot.sendMessage(chatId, "⏳ Verifying your OTP...");
            try {
                await finalizeRegistration(session.data.email, text);
                bot.sendMessage(chatId, "✅ *Identity Verified & Account Registered!*\n\nYou can now use the *login* command to access your digital vault.", { parse_mode: 'Markdown' });
                clearSession('TELEGRAM', chatId);
            } catch (err) {
                bot.sendMessage(chatId, `❌ Verification Failed: ${err.message}. Please send the correct 6-digit code.`);
            }
            return;
        }

        // ORIGINAL LOGIC: RegEx to find any standalone 15-digit number
        const imeiMatch = text.match(/\b\d{15}\b/);

        if (!imeiMatch) {
            // If we don't find a valid IMEI, gracefully respond in localized tone
            bot.sendMessage(chatId, "Oops, I couldn't see a valid *15-digit IMEI* in your message. 🤔\nIf you're not sure how to find it, just dial *#06#* on the phone and send the number back to me.\n\nDan Allah, tura IMEI mai lamba 15 don dubawa. I'm waiting! ⏳", { parse_mode: 'Markdown' });
            return;
        }

        const imei = imeiMatch[0];

        // Status update: tell user we are querying the Central Database
        bot.sendMessage(chatId, `🔍 Let me quickly check the National Registry for this IMEI: ${imei}...\n\nJust hold on a second for me! ⏱️`);

        try {
            // 1. Database Check
            const device = await prisma.device.findUnique({
                where: { imei },
                include: { registeredOwner: true }
            });

            if (!device) {
                bot.sendMessage(chatId, `❌ I couldn't find this IMEI (${imei}) in our National Registry.\n\nThis means the device isn't registered yet, or the IMEI might be compromised.\n\nIf you own this device, please log in or visit our web dashboard to register it.`, { parse_mode: 'Markdown' });
                return;
            }

            // 1.5. Fraud Engine Anomaly Check
            const anomalyWarning = await detectClonedImeiAnomaly(imei, "TELEGRAM", String(chatId));

            // 2. AI Translation / Localization
            const aiResponse = await generateLocalizedOracleResponse(
                device.status,
                device.brand,
                device.model,
                device.riskScore,
                text,
                anomalyWarning
            );

            // 3. Status Block with Owner Details
            const statusEmoji = device.status === 'CLEAN' ? '✅' : '🚨';
            const ownerName = device.registeredOwner?.fullName || 'Hidden/Unknown';
            const detailBlock = `📱 *Device Details:*\n- *Status:* ${statusEmoji} ${device.status}\n- *Owner:* 👤 ${ownerName}\n- *Brand/Model:* ${device.brand} ${device.model}\n- *Risk Score:* ${device.riskScore}/100\n\n_" ${aiResponse} "_`;

            // 4. Send Visual & Text Confirmation
            if (device.devicePhotos && device.devicePhotos.length > 0) {
                // Send the first official photo as the main visual proof
                bot.sendPhoto(chatId, device.devicePhotos[0], {
                    caption: detailBlock,
                    parse_mode: 'Markdown'
                });
            } else {
                bot.sendMessage(chatId, detailBlock, { parse_mode: 'Markdown' });
            }

        } catch (error) {
            console.error('Telegram Oracle Flow Error: ', error);
            bot.sendMessage(chatId, "Oh no! 😟 I'm having a little trouble connecting to the PTS server right now. Connections can be tricky sometimes.\n\nTuba, don Allah a sake jarrabawa an jima (Please give it another try a bit later).");
        }
    });

    // Handle Photos separately
    bot.on('photo', async (msg) => {
        const chatId = msg.chat.id;
        const session = getSession('TELEGRAM', chatId);
        if (session.state === 'IDLE') return;

        const photo = msg.photo[msg.photo.length - 1]; // Get highest res
        const fileId = photo.file_id;

        try {
            const fileUrl = await bot.getFileLink(fileId);
            const cloudinaryUrl = await uploadFromUrl(fileUrl);

            if (!cloudinaryUrl) throw new Error("Upload failed");

            // == CONSUMER SELFIE ==
            if (session.state === 'AWAITING_REG_PHOTO') {
                if (session.data.role === 'CONSUMER') {
                    // Finalize Consumer Registration
                    bot.sendMessage(chatId, "⏳ Preparing your registration...");
                    try {
                        const { pending, otp } = await startRegistration({ ...session.data, facialDataUrl: cloudinaryUrl });
                        const { sendOtpViaBots } = require('../routes/auth');
                        await sendOtpViaBots(pending, otp, "verification");

                        updateSession('TELEGRAM', chatId, 'AWAITING_REG_OTP', { email: pending.email });
                        bot.sendMessage(chatId, `📧 *One Last Step!*\n\nI've sent a 6-digit verification code to your email. Please **type it here** to complete your registration.`, { parse_mode: 'Markdown' });
                    } catch (err) {
                        bot.sendMessage(chatId, `❌ Error: ${err.message}`);
                        clearSession('TELEGRAM', chatId);
                    }
                } else {
                    // It's a Vendor, move to business info
                    updateSession('TELEGRAM', chatId, 'AWAITING_REG_BIZ_NAME', { facialDataUrl: cloudinaryUrl });
                    bot.sendMessage(chatId, "Great! Now let's set up your business. What is your *Shop/Company Name*?", { parse_mode: 'Markdown' });
                }
                return;
            }

            // == VENDOR SHOP PHOTO ==
            if (session.state === 'AWAITING_REG_SHOP_PHOTO') {
                updateSession('TELEGRAM', chatId, 'AWAITING_REG_CAC_PHOTO', { shopPhotoUrl: cloudinaryUrl });
                bot.sendMessage(chatId, "Finally, please send a *Photo of your CAC Certificate* to complete your application.", { parse_mode: 'Markdown' });
                return;
            }

            // == VENDOR CAC PHOTO ==
            if (session.state === 'AWAITING_REG_CAC_PHOTO') {
                bot.sendMessage(chatId, "⏳ Preparing your Vendor Application...");
                try {
                    const { pending, otp } = await startRegistration({ ...session.data, cacCertificateUrl: cloudinaryUrl });
                    const { sendOtpViaBots } = require('../routes/auth');
                    await sendOtpViaBots(pending, otp, "verification");

                    updateSession('TELEGRAM', chatId, 'AWAITING_REG_OTP', { email: pending.email });
                    bot.sendMessage(chatId, `📧 *One Last Step!*\n\nI've sent a 6-digit verification code to your email. Please **type it here** to verify your identity and submit your business for review.`, { parse_mode: 'Markdown' });
                } catch (err) {
                    bot.sendMessage(chatId, `❌ Error: ${err.message}`);
                    clearSession('TELEGRAM', chatId);
                }
                return;
            }

        } catch (e) {
            console.error(e);
            bot.sendMessage(chatId, "Sorry, I couldn't process your photo. Please try sending it again.");
        }
    });

    // Handle Callback Queries (Role Selection)
    bot.on('callback_query', (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        if (data.startsWith('REG_ROLE_')) {
            const role = data.replace('REG_ROLE_', '');
            updateSession('TELEGRAM', chatId, 'AWAITING_REG_NAME', { role });
            bot.answerCallbackQuery(query.id);
            bot.sendMessage(chatId, `Understood. You are registering as a *${role}*.\n\nPlease enter your *Full Legal Name*.`, { parse_mode: 'Markdown' });
        }
    });
};

const sendTelegramMessage = async (chatId, text) => {
    if (telegramBotInstance) {
        try {
            await telegramBotInstance.sendMessage(chatId, text, { parse_mode: 'Markdown' });
        } catch (e) {
            console.error('Error sending exported Telegram message:', e);
        }
    } else {
        console.warn('Telegram bot instance not initialized.');
    }
};

module.exports = { initTelegramOracle, sendTelegramMessage };
