const TelegramBot = require('node-telegram-bot-api');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { generateLocalizedOracleResponse } = require('./aiService');
const { detectClonedImeiAnomaly } = require('./fraudEngine');
const { getSession, updateSession, clearSession } = require('./botState');
const bcrypt = require('bcryptjs');

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
        const resp = `Hello there! 👋 I am the *PTS National Registry AI Oracle*. 🇳🇬\n\nBarka da zuwa! I'm here to help you verify fairly used phones before you buy them at Farm Centre or anywhere else in Kano, so you don't end up with a stolen device.\n\nJust send me the *15-digit IMEI* of the phone you want to check, and I'll take a look for you! 😊\n\nCommands:\n- Type *login* to access your account\n- Type *report* to flag your registered device as stolen`;
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

        // == END CONVERSATIONAL REGISTRATION FLOW ==

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
