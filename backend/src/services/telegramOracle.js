const TelegramBot = require('node-telegram-bot-api');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { generateLocalizedOracleResponse } = require('./aiService');

const initTelegramOracle = () => {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
        console.warn('⚠️ TELEGRAM_BOT_TOKEN not provided in .env. Skipping PTS Telegram AI Oracle startup.');
        return;
    }

    // Uses polling to get updates. Safe for standard development.
    const bot = new TelegramBot(token, { polling: true });

    console.log('🤖 PTS Telegram AI Oracle is now active and polling for messages...');

    bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        const resp = `Welcome to the *PTS National Registry AI Oracle*. 🇳🇬\n\nBarka da zuwa! Before you purchase any fairly used phone at Farm Centre or elsewhere in Kano, verify its status here to ensure it is not stolen.\n\nPlease reply with the *15-digit IMEI* of the device:`;
        bot.sendMessage(chatId, resp, { parse_mode: 'Markdown' });
    });

    // Listen for any standard message and try to extract an IMEI inside it
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text || '';

        // Ignore start slash command so it doesnt double trigger
        if (text.startsWith('/start')) return;

        // RegEx to find any standalone 15-digit number
        const imeiMatch = text.match(/\b\d{15}\b/);

        if (!imeiMatch) {
            // If we don't find a valid IMEI, gracefully respond in localized tone
            bot.sendMessage(chatId, "I could not detect a valid *15-digit IMEI* in your message. You can dial *#06#* on the phone to find the IMEI, then send it to me.\n\nDan Allah, tura IMEI mai lamba 15 don dubawa.", { parse_mode: 'Markdown' });
            return;
        }

        const imei = imeiMatch[0];

        // Status update: tell user we are querying the Central Database
        bot.sendMessage(chatId, `🔍 Searching National Registry for IMEI: ${imei}...\n\nHold on a sec.`);

        try {
            // 1. Database Check
            const device = await prisma.device.findUnique({
                where: { imei },
            });

            if (!device) {
                bot.sendMessage(chatId, `❌ I did not find this IMEI (${imei}) in our National Registry.\n\nThis means the device is either completely new and unregistered, or the IMEI has been compromised. Please exercise caution. A kiyaye siyayya babu tabbaci.`);
                return;
            }

            // 2. AI Translation / Localization
            const aiResponse = await generateLocalizedOracleResponse(
                device.status,
                device.brand,
                device.model,
                device.riskScore,
                text
            );

            // 3. Send final AI generated response to the person on Telegram
            bot.sendMessage(chatId, `" ${aiResponse} "`);

        } catch (error) {
            console.error('Telegram Oracle Flow Error: ', error);
            bot.sendMessage(chatId, "Connection error! I am unable to connect to the PTS server right now. Tuba, don Allah a sake jarrabawa an jima (Please try again later).");
        }
    });
};

module.exports = { initTelegramOracle };
