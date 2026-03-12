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
        const resp = `Hello there! 👋 I am the *PTS National Registry AI Oracle*. 🇳🇬\n\nBarka da zuwa! I'm here to help you verify fairly used phones before you buy them at Farm Centre or anywhere else in Kano, so you don't end up with a stolen device.\n\nJust send me the *15-digit IMEI* of the phone you want to check, and I'll take a look for you! 😊\n\n*(Or, if you want to register a new account and device, just reply with the word "register")*`;
        bot.sendMessage(chatId, resp, { parse_mode: 'Markdown' });
    });

    // Listen for any standard message and try to extract an IMEI inside it
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text || '';
        const session = getSession('TELEGRAM', chatId);

        // Ignore start slash command so it doesnt double trigger
        if (text.startsWith('/start')) return;

        // == CONVERSATIONAL REGISTRATION FLOW ==
        if (text.toLowerCase() === 'register') {
            updateSession('TELEGRAM', chatId, 'AWAITING_ROLE');
            bot.sendMessage(chatId, "Great! Let's get you registered.\n\nAre you registering as a *Regular User* or a *Vendor*? (Reply with 'user' or 'vendor')", { parse_mode: 'Markdown' });
            return;
        }

        if (session.state === 'AWAITING_ROLE') {
            const role = text.toLowerCase() === 'vendor' ? 'VENDOR' : 'PUBLIC';
            updateSession('TELEGRAM', chatId, 'AWAITING_NAME', { role });
            bot.sendMessage(chatId, "Got it! First, please reply with your *Full Name*.", { parse_mode: 'Markdown' });
            return;
        }

        if (session.state === 'AWAITING_NAME') {
            updateSession('TELEGRAM', chatId, 'AWAITING_EMAIL', { fullName: text });
            bot.sendMessage(chatId, "Thanks! Now, please reply with your *Email Address* (or type 'skip' if you don't have one).", { parse_mode: 'Markdown' });
            return;
        }

        if (session.state === 'AWAITING_EMAIL') {
            const email = text.toLowerCase() === 'skip' ? `${chatId}@telegram.local` : text;
            updateSession('TELEGRAM', chatId, 'AWAITING_USER_SELFIE', { email });
            bot.sendMessage(chatId, "Please *upload a selfie* for identity verification.", { parse_mode: 'Markdown' });
            return;
        }

        if (session.state === 'AWAITING_USER_SELFIE') {
            if (!msg.photo || msg.photo.length === 0) {
                bot.sendMessage(chatId, "Please upload a photo (your selfie).");
                return;
            }
            const selfieUrl = `telegram-file://${msg.photo[msg.photo.length - 1].file_id}`;
            updateSession('TELEGRAM', chatId, session.data.role === 'VENDOR' ? 'AWAITING_CAC_CERT' : 'CREATING_USER', { facialDataUrl: selfieUrl });

            if (session.data.role === 'VENDOR') {
                bot.sendMessage(chatId, "Great! Since you are a Vendor, please *upload a photo of your CAC Certificate*.", { parse_mode: 'Markdown' });
                return;
            }
            session.state = 'CREATING_USER';
        }

        if (session.state === 'AWAITING_CAC_CERT') {
            if (!msg.photo || msg.photo.length === 0) {
                bot.sendMessage(chatId, "Please upload a photo of your CAC Certificate.");
                return;
            }
            updateSession('TELEGRAM', chatId, 'AWAITING_SHOP_PHOTO', { cacCertificateUrl: `telegram-file://${msg.photo[msg.photo.length - 1].file_id}` });
            bot.sendMessage(chatId, "Thanks! Finally for your vendor details, please *upload a photo of your shop*.", { parse_mode: 'Markdown' });
            return;
        }

        if (session.state === 'AWAITING_SHOP_PHOTO') {
            if (!msg.photo || msg.photo.length === 0) {
                bot.sendMessage(chatId, "Please upload a photo of your shop.");
                return;
            }
            updateSession('TELEGRAM', chatId, 'CREATING_USER', { shopPhotoUrl: `telegram-file://${msg.photo[msg.photo.length - 1].file_id}` });
            session.state = 'CREATING_USER';
        }

        if (session.state === 'CREATING_USER') {
            const plainPassword = Math.random().toString(36).slice(-8);
            const hashedPassword = await bcrypt.hash(plainPassword, 10);

            try {
                const user = await prisma.user.create({
                    data: {
                        fullName: session.data.fullName,
                        email: session.data.email,
                        password: hashedPassword,
                        role: session.data.role,
                        facialDataUrl: session.data.facialDataUrl,
                        cacCertificateUrl: session.data.cacCertificateUrl || null,
                        shopPhotoUrl: session.data.shopPhotoUrl || null,
                        vendorStatus: session.data.role === 'VENDOR' ? 'PENDING' : 'APPROVED'
                    }
                });
                updateSession('TELEGRAM', chatId, 'AWAITING_DEVICE_IMEI', { userId: user.id });
                bot.sendMessage(chatId, `🎉 Account created successfully!\n\nYour temporary password is: *${plainPassword}*\n\nNow, let's register your device. Please reply with the *15-digit IMEI* of the device (dial *#06#* to find it).`, { parse_mode: 'Markdown' });
            } catch (e) {
                console.error(e);
                bot.sendMessage(chatId, "Oops, failed to create account. Registration cancelled.");
                clearSession('TELEGRAM', chatId);
            }
            return;
        }

        if (session.state === 'AWAITING_DEVICE_IMEI') {
            const imeiMatch = text.match(/\b\d{15}\b/);
            if (!imeiMatch) {
                bot.sendMessage(chatId, "That doesn't look like a 15-digit IMEI. Please dial *#06#* and send the 15 digits.", { parse_mode: 'Markdown' });
                return;
            }
            const existing = await prisma.device.findUnique({ where: { imei: imeiMatch[0] } });
            if (existing) {
                bot.sendMessage(chatId, "This IMEI is already registered! If this is a mistake, please contact support. Registration cancelled.");
                clearSession('TELEGRAM', chatId);
                return;
            }
            updateSession('TELEGRAM', chatId, 'AWAITING_DEVICE_BRAND', { imei: imeiMatch[0] });
            bot.sendMessage(chatId, "Got it! What is the *Brand* of the device? (e.g., Apple, Samsung, Tecno)", { parse_mode: 'Markdown' });
            return;
        }

        if (session.state === 'AWAITING_DEVICE_BRAND') {
            updateSession('TELEGRAM', chatId, 'AWAITING_DEVICE_MODEL', { brand: text });
            bot.sendMessage(chatId, "And what is the *Model*? (e.g., iPhone 13 Pro, Galaxy S21)", { parse_mode: 'Markdown' });
            return;
        }

        if (session.state === 'AWAITING_DEVICE_MODEL') {
            updateSession('TELEGRAM', chatId, 'AWAITING_DEVICE_PHOTO', { model: text });
            bot.sendMessage(chatId, "Almost done! Please *upload a photo of the device itself*.", { parse_mode: 'Markdown' });
            return;
        }

        if (session.state === 'AWAITING_DEVICE_PHOTO') {
            if (!msg.photo || msg.photo.length === 0) {
                bot.sendMessage(chatId, "Please upload a photo of the device.");
                return;
            }
            const photoUrl = `telegram-file://${msg.photo[msg.photo.length - 1].file_id}`;
            updateSession('TELEGRAM', chatId, 'AWAITING_DEVICE_CARTON', { devicePhoto: photoUrl });
            bot.sendMessage(chatId, "Awesome! Now please *upload a photo of the device carton*.", { parse_mode: 'Markdown' });
            return;
        }

        if (session.state === 'AWAITING_DEVICE_CARTON') {
            if (!msg.photo || msg.photo.length === 0) {
                bot.sendMessage(chatId, "Please upload a photo of the device carton.");
                return;
            }
            const cartonUrl = `telegram-file://${msg.photo[msg.photo.length - 1].file_id}`;
            updateSession('TELEGRAM', chatId, 'AWAITING_DEVICE_RECEIPT', { cartonPhotoUrl: cartonUrl });
            bot.sendMessage(chatId, "Almost finished! Finally, *upload a photo of the purchase receipt*.", { parse_mode: 'Markdown' });
            return;
        }

        if (session.state === 'AWAITING_DEVICE_RECEIPT') {
            if (!msg.photo || msg.photo.length === 0) {
                bot.sendMessage(chatId, "Please upload a photo of the purchase receipt.");
                return;
            }
            const receiptUrl = `telegram-file://${msg.photo[msg.photo.length - 1].file_id}`;

            try {
                await prisma.device.create({
                    data: {
                        imei: session.data.imei,
                        brand: session.data.brand,
                        model: session.data.model,
                        registeredOwnerId: session.data.userId,
                        devicePhotos: [session.data.devicePhoto],
                        cartonPhotoUrl: session.data.cartonPhotoUrl,
                        purchaseReceiptUrl: receiptUrl,
                        status: 'CLEAN'
                    }
                });
                bot.sendMessage(chatId, `✅ Registration Complete!\n\nYour *${session.data.brand} ${session.data.model}* (${session.data.imei}) is now fully secured on the National Registry.`, { parse_mode: 'Markdown' });
            } catch (e) {
                bot.sendMessage(chatId, "Failed to register device. Please try again.");
            }
            clearSession('TELEGRAM', chatId);
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
            });

            if (!device) {
                bot.sendMessage(chatId, `❌ I couldn't find this IMEI (${imei}) in our National Registry.\n\nThis means the device isn't registered yet, or the IMEI might be compromised. \n\nIf you own this device, you can register it right here! Just reply with the word *"register"* to begin.\n\nPlease exercise caution when buying unregistered devices. A kiyaye siyayya babu tabbaci.`, { parse_mode: 'Markdown' });
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

            // 3. Send final AI generated response to the person on Telegram
            bot.sendMessage(chatId, `" ${aiResponse} "`);

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
