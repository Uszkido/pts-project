const TelegramBot = require('node-telegram-bot-api');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { generateLocalizedOracleResponse, transcribeAudio, generateCrimeInsights, generateAffidavitSummary, extractImeiFromImage, generateVendorTrustSummary, analyzeSmugglingRisk } = require('./aiService');
const { detectClonedImeiAnomaly } = require('./fraudEngine');
const { getSession, updateSession, clearSession } = require('./botState');
const bcrypt = require('bcryptjs');
const { uploadFromUrl } = require('./imageUploader');
const { startRegistration, finalizeRegistration } = require('./userService');

let telegramBotInstance = null;

const initTelegramOracle = () => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    console.log('Bot Token Length:', token ? token.length : 0);

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
        const resp = `Hello there! 👋 I am the *PTS Sentinel (Vexel AI)*. 🇳🇬\n\nBarka da zuwa! I'm here to help you verify the phone you are buying anywhere in Nigeria.\n\nCommands:\n- Type *register* to create your Sentinel Identity\n- Type *login* to access your account\n- Type *report* to flag a stolen device\n- Type *panic* to selectively lock stolen devices\n- Type *legal [question]* for NPF Legal Guidance\n- Type *scam [message]* to check for phishing\n- Type *safety* to see AI security hotspots\n- Type *language* to switch (ENG, HAU, YOR, IGB, PID)`;
        bot.sendMessage(chatId, resp, { parse_mode: 'Markdown' });
    });

    // Listen for any standard message and try to extract an IMEI inside it
    // Listen for any standard message or voice command
    bot.on('message', async (msg) => {
        console.log('📩 Received message from:', msg.from?.username || msg.from?.id, '| Text:', msg.text);
        const chatId = msg.chat.id;
        let text = msg.text || '';
        const session = getSession('TELEGRAM', chatId);
        console.log('Current session state:', session.state);

        // == VOICE COMMAND HANDLING ==
        if (msg.voice) {
            bot.sendChatAction(chatId, 'typing');
            try {
                const fileId = msg.voice.file_id;
                const fileUrl = await bot.getFileLink(fileId);
                const response = await fetch(fileUrl);
                const buffer = Buffer.from(await response.arrayBuffer());

                // Transcribe using Gemini
                const transcribedText = await transcribeAudio(buffer, 'audio/ogg');
                if (transcribedText) {
                    text = transcribedText;
                    bot.sendMessage(chatId, `🎤 *Voice Recognized:* "${text}"`, { parse_mode: 'Markdown' });
                } else {
                    return bot.sendMessage(chatId, "Sorry, I couldn't understand that voice message. Could you try typing it?");
                }
            } catch (err) {
                console.error("Telegram Voice Error:", err);
                return bot.sendMessage(chatId, "I had trouble processing your voice command. Please try again or type.");
            }
        }

        if (!text) return;
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

        // == SAFETY INSIGHTS ==
        if (text.toLowerCase() === 'safety') {
            bot.sendChatAction(chatId, 'typing');
            try {
                const recentReports = await prisma.incidentReport.findMany({
                    take: 20,
                    orderBy: { createdAt: 'desc' },
                    select: { type: true, location: true }
                });
                const insights = await generateCrimeInsights(recentReports);
                bot.sendMessage(chatId, `🚨 *National Security Insights*\n\n${insights}`, { parse_mode: 'Markdown' });
            } catch (e) {
                bot.sendMessage(chatId, "Security insights temporarily unavailable.");
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
                    const report = await prisma.incidentReport.create({
                        data: {
                            deviceId: device.id,
                            reporterId: session.data.userId,
                            type: 'STOLEN',
                            description: 'Reported via Telegram Bot',
                            status: 'OPEN'
                        }
                    });

                    await prisma.device.update({
                        where: { imei },
                        data: { status: 'STOLEN', riskScore: 0 }
                    });

                    const affidavitSummary = await generateAffidavitSummary(report);

                    bot.sendMessage(chatId, `🚨 *STOLEN REPORTED!*\n\nYour ${device.brand} ${device.model} (${imei}) is now flagged NATIONWIDE.\n\n📄 *Digital Affidavit Summary:*\n${affidavitSummary}\n\nKeep this chat as proof of verification. Authorities and vendors have been notified.`, { parse_mode: 'Markdown' });
                }
            } catch (e) {
                console.error(e);
                bot.sendMessage(chatId, "Error processing report. Please try again.");
            }
            updateSession('TELEGRAM', chatId, 'LOGGED_IN'); // Return to logged in state
            return;
        }

        // == PANIC PROTOCOL (TARGETED LOCK) ==
        if (text.toLowerCase() === 'panic') {
            if (session.state !== 'LOGGED_IN') {
                bot.sendMessage(chatId, "You need to be logged in to activate Panic Protocol.");
                return;
            }
            try {
                const devices = await prisma.device.findMany({ where: { registeredOwnerId: session.data.userId } });
                if (devices.length === 0) {
                    bot.sendMessage(chatId, "You have no registered devices in your vault.");
                    return;
                }

                if (devices.length === 1) {
                    const dev = devices[0];
                    bot.sendMessage(chatId, `🚨 *Confirm Panic Protocol*\n\nDo you want to flag your *${dev.brand} ${dev.model}* (${dev.imei.slice(-4)}) as STOLEN across the National Registry?`, {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🚩 YES - FLAG STOLEN', callback_data: `PANIC_LOCK_${dev.id}` }],
                                [{ text: '❌ CANCEL', callback_data: 'PANIC_CANCEL' }]
                            ]
                        }
                    });
                } else {
                    const keyboard = devices.map(d => ([{ text: `🚫 ${d.brand} ${d.model} (...${d.imei.slice(-4)})`, callback_data: `PANIC_CONFIRM_${d.id}` }]));
                    keyboard.push([{ text: '❌ CANCEL', callback_data: 'PANIC_CANCEL' }]);

                    bot.sendMessage(chatId, "🚨 *Panic Protocol: Select Device*\n\nWhich of your registered devices was stolen? Select to flag it NATIONWIDE.", {
                        parse_mode: 'Markdown',
                        reply_markup: { inline_keyboard: keyboard }
                    });
                }
            } catch (e) {
                bot.sendMessage(chatId, "Failed to access your vault for Panic Protocol.");
            }
            return;
        }

        // == LANGUAGE ORACLE ==
        if (text.toLowerCase() === 'language') {
            bot.sendMessage(chatId, "Please select your preferred Sentinel Oracle language:", {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'English 🇬🇧', callback_data: 'LANG_ENGLISH' }, { text: 'Hausa 🇳🇬', callback_data: 'LANG_HAUSA' }],
                        [{ text: 'Yoruba 🇳🇬', callback_data: 'LANG_YORUBA' }, { text: 'Igbo 🇳🇬', callback_data: 'LANG_IGBO' }],
                        [{ text: 'Pidgin 🇳🇬', callback_data: 'LANG_PIDGIN' }]
                    ]
                }
            });
            return;
        }

        // == LEGAL ADVISOR ==
        if (text.toLowerCase().startsWith('legal')) {
            const query = text.substring(6).trim();
            if (!query) {
                bot.sendMessage(chatId, "⚖️ *Sentinel Legal Advisor*\n\nPlease provide a question. Example: 'legal what happens if I buy a stolen phone?'", { parse_mode: 'Markdown' });
                return;
            }
            bot.sendChatAction(chatId, 'typing');
            const advice = await getLegalAdvice(query, session.data.language || 'ENGLISH');
            bot.sendMessage(chatId, `⚖️ *Legal Guidance (PTS):*\n\n${advice}`, { parse_mode: 'Markdown' });
            return;
        }

        // == SCAM / PHISHING SHIELD ==
        if (text.toLowerCase().startsWith('scam')) {
            const scamMsg = text.substring(5).trim();
            if (!scamMsg) {
                bot.sendMessage(chatId, "🛡️ *Security Shield*\n\nPlease paste the message you want me to analyze for fraud.", { parse_mode: 'Markdown' });
                return;
            }
            bot.sendChatAction(chatId, 'typing');
            const result = await analyzePhishingMessage(scamMsg);
            const statusEmoji = result.isScam ? '🚫' : '✅';
            bot.sendMessage(chatId, `${statusEmoji} *Analysis Results:*\n\n*Scam Type:* ${result.scamType || 'None'}\n*Confidence:* ${result.confidence}%\n*Warning:* ${result.warning}\n\n💡 *Action:* ${result.action}`, { parse_mode: 'Markdown' });
            return;
        }

        // == MAINTENANCE AUDIT ==
        if (text.toLowerCase() === 'audit') {
            updateSession('TELEGRAM', chatId, 'AWAITING_AUDIT_DATA');
            bot.sendMessage(chatId, "🔧 *Maintenance Integrity Auditor*\n\nPlease enter the component serials in this format:\n`Screen: [number], Battery: [number]`\n\nI will check if any are harvested from stolen devices.", { parse_mode: 'Markdown' });
            return;
        }

        if (session.state === 'AWAITING_AUDIT_DATA') {
            bot.sendChatAction(chatId, 'typing');
            const screenMatch = text.match(/Screen:\s*(\w+)/i);
            const batteryMatch = text.match(/Battery:\s*(\w+)/i);

            const results = await analyzeMaintenanceParts({
                screenSerial: screenMatch ? screenMatch[1] : null,
                batterySerial: batteryMatch ? batteryMatch[1] : null
            });

            bot.sendMessage(chatId, `${results.alert}\n\n${results.details}`, { parse_mode: 'Markdown' });
            updateSession('TELEGRAM', chatId, 'LOGGED_IN');
            return;
        }

        // == TRANSFER FLOW ==
        if (text.toLowerCase() === 'transfer') {
            if (session.state !== 'LOGGED_IN') {
                bot.sendMessage(chatId, "You need to be logged in to transfer ownership. Please type *login* first.", { parse_mode: 'Markdown' });
                return;
            }
            updateSession('TELEGRAM', chatId, 'AWAITING_TRANSFER_BUYER_EMAIL');
            bot.sendMessage(chatId, "🤝 *Safe-Hand Transfer Initiated*\n\nPlease enter the *Email Address* of the person you are selling this phone to.", { parse_mode: 'Markdown' });
            return;
        }

        if (session.state === 'AWAITING_TRANSFER_BUYER_EMAIL') {
            updateSession('TELEGRAM', chatId, 'AWAITING_TRANSFER_IMEI', { buyerEmail: text });
            bot.sendMessage(chatId, "Got it. Now enter the *15-digit IMEI* of the device you want to transfer legally.", { parse_mode: 'Markdown' });
            return;
        }

        if (session.state === 'AWAITING_TRANSFER_IMEI') {
            const imeiMatch = text.match(/\b\d{15}\b/);
            if (!imeiMatch) {
                bot.sendMessage(chatId, "Invalid IMEI. Please send 15 digits.");
                return;
            }
            try {
                const device = await prisma.device.findUnique({ where: { imei: imeiMatch[0] } });
                const buyer = await prisma.user.findUnique({ where: { email: session.data.buyerEmail } });

                if (device && buyer && device.registeredOwnerId === session.data.userId) {
                    await prisma.device.update({
                        where: { id: device.id },
                        data: { registeredOwnerId: buyer.id }
                    });
                    bot.sendMessage(chatId, `✅ *Transfer Complete!*\n\nOwnership of ${device.brand} ${device.model} has been legally moved to *${buyer.fullName}*. A new DDOC has been issued to their vault.`, { parse_mode: 'Markdown' });
                } else {
                    bot.sendMessage(chatId, "❌ Transfer failed. Ensure you own the device and the buyer is registered.");
                }
            } catch (e) {
                bot.sendMessage(chatId, "Transfer error. Try again.");
            }
            updateSession('TELEGRAM', chatId, 'LOGGED_IN');
            return;
        }

        // == VENDOR TRUST BADGE ==
        if (text.toLowerCase() === 'badge') {
            bot.sendChatAction(chatId, 'typing');
            try {
                const vendor = await prisma.user.findFirst({
                    where: { telegramChatId: String(chatId), role: 'VENDOR' },
                    include: { registeredDevices: true, vendorTrustScore: true }
                });

                if (!vendor) {
                    bot.sendMessage(chatId, "This command is only for *Verified Verified Vendors*.");
                    return;
                }

                const trustData = {
                    companyName: vendor.companyName,
                    tier: vendor.vendorTier,
                    totalSales: vendor.registeredDevices.length
                };

                const aiSummary = await generateVendorTrustSummary(trustData);
                bot.sendMessage(chatId, `🛡️ *Sentinel Guard Vendor Badge*\n\n*Merchant:* ${vendor.companyName}\n*Status:* ${vendor.vendorTrustScore?.score > 80 ? 'Elite Trusted' : 'Verified'}\n\n_${aiSummary}_`, { parse_mode: 'Markdown' });
            } catch (e) {
                bot.sendMessage(chatId, "Failed to generate badge.");
            }
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

            // 1.6. Smuggling Detector
            if (device.status === 'STOLEN') {
                // == AUTOMATIC PTS REPORTING ==
                try {
                    const reporterId = session.data.userId || (await prisma.user.findFirst({ where: { role: 'ADMIN' } }))?.id || (await prisma.user.findFirst())?.id;
                    await prisma.incidentReport.create({
                        data: {
                            deviceId: device.id,
                            reporterId: reporterId,
                            type: 'STOLEN_PROBE',
                            description: `🚨 *STOLEN DEVICE PROBE:* A user on Telegram (@${msg.from?.username || msg.from?.id}) just queried this stolen ${device.brand} ${device.model}. Potential illegal sale in progress.`,
                            status: 'OPEN'
                        }
                    });
                    console.log(`🚩 Stolen device ${imei} queried. PTS Report created.`);
                } catch (reportErr) {
                    console.error("Failed to create auto PTS report:", reportErr);
                }

                if (device.lastKnownLocation) {
                    const smuggling = await analyzeSmugglingRisk(device.lastKnownLocation, "Detected Terminal", device.status);
                    if (smuggling.isSmuggled) {
                        bot.sendMessage(chatId, `🚩 *SYNDICATE ALERT:* ${smuggling.warning}`);
                    }
                }
            }

            // 2. AI Translation / Localization
            const aiResponse = await generateLocalizedOracleResponse(
                device.status,
                device.brand,
                device.model,
                device.riskScore,
                text,
                anomalyWarning,
                session.data.language || 'ENGLISH'
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

            // == VISION SCAN (FALLBACK) ==
            if (session.state === 'IDLE' || !session.state) {
                bot.sendChatAction(chatId, 'typing');
                bot.sendMessage(chatId, "📸 *Vision AI Scan initiated...* extracting device identity from your photo.");
                const imei = await extractImeiFromImage(cloudinaryUrl);
                if (imei) {
                    bot.sendMessage(chatId, `🤖 IMEI Detected: *${imei}*. Checking registry...`, { parse_mode: 'Markdown' });
                    // Trigger the IMEI check flow manually by recursing or mimicking message
                    // For now, just send the IMEI back as text to the message handler
                    return bot.emit('message', { chat: { id: chatId }, text: imei });
                } else {
                    return bot.sendMessage(chatId, "Sorry, my Vision AI couldn't find a clear IMEI in that photo. Please try one with better light or type it manually.");
                }
            }

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

        if (data.startsWith('LANG_')) {
            const lang = data.replace('LANG_', '');
            updateSession('TELEGRAM', chatId, session.state, { language: lang });
            bot.answerCallbackQuery(query.id);
            bot.sendMessage(chatId, `Oracle language set to: *${lang}* 🇳🇬`, { parse_mode: 'Markdown' });
        }

        if (data.startsWith('PANIC_CONFIRM_')) {
            const deviceId = data.replace('PANIC_CONFIRM_', '');
            bot.answerCallbackQuery(query.id);
            prisma.device.findUnique({ where: { id: deviceId } }).then(dev => {
                bot.sendMessage(chatId, `🚩 *Confirming Panic Protocol* for *${dev.brand} ${dev.model}*.\n\nAre you sure you want to flag this specific device as STOLEN?`, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🚩 YES - FLAG NOW', callback_data: `PANIC_LOCK_${deviceId}` }],
                            [{ text: '❌ CANCEL', callback_data: 'PANIC_CANCEL' }]
                        ]
                    }
                });
            });
        }

        if (data.startsWith('PANIC_LOCK_')) {
            const deviceId = data.replace('PANIC_LOCK_', '');
            bot.answerCallbackQuery(query.id, { text: "Activating Panic Protocol..." });
            prisma.device.update({
                where: { id: deviceId },
                data: { status: 'STOLEN', riskScore: 0 }
            }).then(dev => {
                bot.sendMessage(chatId, `🚨 *PANIC PROTOCOL ACTIVATED!*\n\nYour *${dev.brand} ${dev.model}* (${dev.imei}) has been flagged as STOLEN across the National Registry. All authorities have been alerted.`, { parse_mode: 'Markdown' });
            }).catch(err => {
                bot.sendMessage(chatId, "⚠️ Failed to activate Panic Protocol. Please try using the *report* command.");
            });
        }

        if (data === 'PANIC_CANCEL') {
            bot.answerCallbackQuery(query.id, { text: "Panic Protocol cancelled." });
            bot.sendMessage(chatId, "✅ Panic Protocol cancelled. No changes were made to your devices.");
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
