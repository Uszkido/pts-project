const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { generateLocalizedOracleResponse, transcribeAudio, generateCrimeInsights, generateAffidavitSummary, extractImeiFromImage, generateVendorTrustSummary, analyzeSmugglingRisk } = require('../services/aiService');
const { detectClonedImeiAnomaly } = require('../services/fraudEngine');
const { getSession, updateSession, clearSession } = require('../services/botState');
const bcrypt = require('bcryptjs');
const { uploadFromUrl } = require('../services/imageUploader');
const { startRegistration, finalizeRegistration } = require('../services/userService');

// 1. Webhook Verification (Meta requires this when you register your server URL)
router.get('/webhook', (req, res) => {
    const verify_token = process.env.WHATSAPP_VERIFY_TOKEN || "PTS_SECURE_TOKEN";
    let mode = req.query["hub.mode"];
    let token = req.query["hub.verify_token"];
    let challenge = req.query["hub.challenge"];

    if (mode && token) {
        if (mode === "subscribe" && token === verify_token) {
            console.log("✅ WhatsApp Webhook Verified with Meta");
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

// 2. Receiving Messages from WhatsApp Users
router.post('/webhook', async (req, res) => {
    const body = req.body;

    if (
        body.object !== "whatsapp_business_account" ||
        !body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]
    ) {
        return res.sendStatus(200);
    }

    const change = body.entry[0].changes[0].value;
    const phoneNumberId = change.metadata.phone_number_id;
    const from = change.messages[0].from;
    const msgType = change.messages[0]?.type;
    let msgBody = msgType === 'text' ? change.messages[0]?.text?.body || '' : '';

    // == VOICE COMMAND HANDLING ==
    if (msgType === 'audio') {
        const audioId = change.messages[0].audio.id;
        try {
            const audioUrl = await getWhatsAppMediaUrl(audioId);
            const response = await fetch(audioUrl, {
                headers: { 'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` }
            });
            const buffer = Buffer.from(await response.arrayBuffer());

            // Transcribe using Gemini
            const transcribedText = await transcribeAudio(buffer, 'audio/ogg');
            if (transcribedText) {
                msgBody = transcribedText;
                await sendWhatsAppMessage(phoneNumberId, from, `🎤 *Voice Recognized:* "${msgBody}"`);
            } else {
                await sendWhatsAppMessage(phoneNumberId, from, "Sorry, I couldn't understand that voice message. Could you try typing it?");
                return res.sendStatus(200);
            }
        } catch (err) {
            console.error("WhatsApp Voice Error:", err);
            await sendWhatsAppMessage(phoneNumberId, from, "Trouble processing voice. Please try typing.");
            return res.sendStatus(200);
        }
    }

    // Ignore unsupported types, but allow text, image, and processed audio
    if (msgType !== 'text' && msgType !== 'image' && msgType !== 'audio') {
        return res.sendStatus(200);
    }

    console.log(`📩 Received WhatsApp message from ${from}`);

    const session = getSession('WHATSAPP', from);
    let replyText = "";

    // == LOGIN FLOW ==
    if (msgBody.toLowerCase() === 'login') {
        updateSession('WHATSAPP', from, 'AWAITING_LOGIN_EMAIL');
        replyText = "Welcome back! Please enter your registered *Email Address*.";
        await sendWhatsAppMessage(phoneNumberId, from, replyText);
        return res.sendStatus(200);
    }

    if (session.state === 'AWAITING_LOGIN_EMAIL') {
        updateSession('WHATSAPP', from, 'AWAITING_LOGIN_PASSWORD', { email: msgBody });
        replyText = "Got it! Now please enter your *Password*.";
        await sendWhatsAppMessage(phoneNumberId, from, replyText);
        return res.sendStatus(200);
    }

    if (session.state === 'AWAITING_LOGIN_PASSWORD') {
        try {
            const user = await prisma.user.findUnique({ where: { email: session.data.email } });
            if (user && await bcrypt.compare(msgBody, user.password)) {
                updateSession('WHATSAPP', from, 'LOGGED_IN', { userId: user.id, fullName: user.fullName });
                replyText = `✅ Welcome, *${user.fullName}*! You are now logged in.\n\nCommands:\n- *report* (Flag stolen device)\n- *safety* (National security insights)`;
            } else {
                replyText = "❌ Invalid email or password. Please try again or type *login* to restart.";
                clearSession('WHATSAPP', from);
            }
        } catch (e) {
            console.error(e);
            replyText = "Error logging in. Please try again later.";
        }
        await sendWhatsAppMessage(phoneNumberId, from, replyText);
        return res.sendStatus(200);
    }

    // == SAFETY INSIGHTS ==
    if (msgBody.toLowerCase() === 'safety') {
        try {
            const recentReports = await prisma.incidentReport.findMany({
                take: 20,
                orderBy: { createdAt: 'desc' },
                select: { type: true, location: true }
            });
            replyText = await generateCrimeInsights(recentReports);
            await sendWhatsAppMessage(phoneNumberId, from, `🚨 *National Security Insights*\n\n${replyText}`);
        } catch (e) {
            await sendWhatsAppMessage(phoneNumberId, from, "Security insights temporarily unavailable.");
        }
        return res.sendStatus(200);
    }    // == TRANSFER FLOW ==
    if (msgBody.toLowerCase() === 'transfer') {
        if (session.state !== 'LOGGED_IN') {
            await sendWhatsAppMessage(phoneNumberId, from, "You need to be logged in to transfer ownership. Please type *login* first.");
            return res.sendStatus(200);
        }
        updateSession('WHATSAPP', from, 'AWAITING_TRANSFER_BUYER_EMAIL');
        await sendWhatsAppMessage(phoneNumberId, from, "🤝 *Safe-Hand Transfer Initiated*\n\nPlease enter the *Email Address* of the person you are selling this phone to.");
        return res.sendStatus(200);
    }

    if (session.state === 'AWAITING_TRANSFER_BUYER_EMAIL') {
        updateSession('WHATSAPP', from, 'AWAITING_TRANSFER_IMEI', { buyerEmail: msgBody });
        await sendWhatsAppMessage(phoneNumberId, from, "Got it. Now enter the *15-digit IMEI* of the device you want to transfer legally.");
        return res.sendStatus(200);
    }

    if (session.state === 'AWAITING_TRANSFER_IMEI') {
        const imeiMatch = msgBody.match(/\b\d{15}\b/);
        if (!imeiMatch) {
            await sendWhatsAppMessage(phoneNumberId, from, "Invalid IMEI. Please send 15 digits.");
            return res.sendStatus(200);
        }
        try {
            const device = await prisma.device.findUnique({ where: { imei: imeiMatch[0] } });
            const buyer = await prisma.user.findUnique({ where: { email: session.data.buyerEmail } });

            if (device && buyer && device.registeredOwnerId === session.data.userId) {
                await prisma.device.update({
                    where: { id: device.id },
                    data: { registeredOwnerId: buyer.id }
                });
                await sendWhatsAppMessage(phoneNumberId, from, `✅ *Transfer Complete!*\n\nOwnership of ${device.brand} ${device.model} has been legally moved to *${buyer.fullName}*.`);
            } else {
                await sendWhatsAppMessage(phoneNumberId, from, "❌ Transfer failed. Check device ownership or buyer registration.");
            }
        } catch (e) {
            await sendWhatsAppMessage(phoneNumberId, from, "Transfer error.");
        }
        updateSession('WHATSAPP', from, 'LOGGED_IN');
        return res.sendStatus(200);
    }

    // == VENDOR TRUST BADGE ==
    if (msgBody.toLowerCase() === 'badge') {
        try {
            const vendor = await prisma.user.findFirst({
                where: { phoneNumber: from, role: 'VENDOR' }, // Simple matching for demo
                include: { registeredDevices: true, vendorTrustScore: true }
            });

            if (!vendor) {
                await sendWhatsAppMessage(phoneNumberId, from, "This command is only for *Verified Vendors*.");
                return res.sendStatus(200);
            }

            const trustData = { companyName: vendor.companyName, tier: vendor.vendorTier, totalSales: vendor.registeredDevices.length };
            const aiSummary = await generateVendorTrustSummary(trustData);
            await sendWhatsAppMessage(phoneNumberId, from, `🛡️ *Sentinel Guard Vendor Badge*\n\n*Merchant:* ${vendor.companyName}\n\n_${aiSummary}_`);
        } catch (e) {
            await sendWhatsAppMessage(phoneNumberId, from, "Failed to generate badge.");
        }
        return res.sendStatus(200);
    }

    // == REPORT FLOW ==
    if (msgBody.toLowerCase() === 'report') {
        if (session.state !== 'LOGGED_IN') {
            replyText = "You need to be logged in to report a stolen device. Please type *login* first.";
            await sendWhatsAppMessage(phoneNumberId, from, replyText);
            return res.sendStatus(200);
        }
        updateSession('WHATSAPP', from, 'AWAITING_REPORT_IMEI');
        replyText = "Please send the *15-digit IMEI* of the device you want to report as STOLEN.";
        await sendWhatsAppMessage(phoneNumberId, from, replyText);
        return res.sendStatus(200);
    }

    if (session.state === 'AWAITING_REPORT_IMEI') {
        const imeiMatch = msgBody.match(/\b\d{15}\b/);
        if (!imeiMatch) {
            replyText = "That doesn't look like a 15-digit IMEI. Please dial *#06#* and send the 15 digits.";
            await sendWhatsAppMessage(phoneNumberId, from, replyText);
            return res.sendStatus(200);
        }
        const imei = imeiMatch[0];
        try {
            const device = await prisma.device.findUnique({ where: { imei } });

            if (!device) {
                replyText = "❌ We couldn't find a device with that IMEI in the registry.";
            } else if (device.registeredOwnerId !== session.data.userId) {
                replyText = "❌ You are not the registered owner of this device. Reporting is only allowed by the owner.";
            } else {
                const report = await prisma.incidentReport.create({
                    data: {
                        deviceId: device.id,
                        reporterId: session.data.userId,
                        type: 'STOLEN',
                        description: 'Reported via WhatsApp Bot',
                        status: 'OPEN'
                    }
                });

                await prisma.device.update({
                    where: { imei },
                    data: { status: 'STOLEN', riskScore: 0 }
                });

                const affidavitSummary = await generateAffidavitSummary(report);
                replyText = `🚨 *STOLEN REPORTED!*\n\nYour ${device.brand} ${device.model} (${imei}) is now flagged NATIONWIDE.\n\n📄 *Digital Affidavit Summary:*\n${affidavitSummary}\n\nAuthorities and vendors have been notified.`;
            }
        } catch (e) {
            console.error(e);
            replyText = "Error processing report. Please try again.";
        }
        updateSession('WHATSAPP', from, 'LOGGED_IN');
        await sendWhatsAppMessage(phoneNumberId, from, replyText);
        return res.sendStatus(200);
    }

    // == PANIC PROTOCOL ==
    if (msgBody.toLowerCase() === 'panic') {
        if (session.state !== 'LOGGED_IN') {
            await sendWhatsAppMessage(phoneNumberId, from, "You need to be logged in to activate Panic Protocol.");
            return res.sendStatus(200);
        }
        try {
            await prisma.device.updateMany({
                where: { registeredOwnerId: session.data.userId },
                data: { status: 'STOLEN' }
            });
            await sendWhatsAppMessage(phoneNumberId, from, "🚨 *PANIC PROTOCOL ACTIVATED!*\n\nAll your devices are now flagged as STOLEN NATIONWIDE. Digital Certificates revoked.");
        } catch (e) {
            await sendWhatsAppMessage(phoneNumberId, from, "Panic Protocol failed.");
        }
        return res.sendStatus(200);
    }

    // == LANGUAGE SETTINGS ==
    if (msgBody.toLowerCase() === 'language') {
        replyText = "Select Language:\n1. *ENGLISH*\n2. *HAUSA*\n3. *YORUBA*\n4. *IGBO*\n5. *PIDGIN*";
        updateSession('WHATSAPP', from, 'AWAITING_LANGUAGE');
        await sendWhatsAppMessage(phoneNumberId, from, replyText);
        return res.sendStatus(200);
    }

    if (session.state === 'AWAITING_LANGUAGE') {
        const langs = { '1': 'ENGLISH', '2': 'HAUSA', '3': 'YORUBA', '4': 'IGBO', '5': 'PIDGIN' };
        const selected = langs[msgBody] || msgBody.toUpperCase();
        updateSession('WHATSAPP', from, 'LOGGED_IN', { language: selected });
        await sendWhatsAppMessage(phoneNumberId, from, `Oracle language set to *${selected}* 🇳🇬`);
        return res.sendStatus(200);
    }

    // == REGISTRATION FLOW ==
    if (msgBody.toLowerCase() === 'register') {
        updateSession('WHATSAPP', from, 'AWAITING_REG_ROLE');
        replyText = "Great! Let's get you registered in the *PTS Sentinel National Registry*.\n\nPlease type your account type:\n1️⃣ *CONSUMER* (Device Owner)\n2️⃣ *VENDOR* (Shop Owner)";
        await sendWhatsAppMessage(phoneNumberId, from, replyText);
        return res.sendStatus(200);
    }

    if (session.state === 'AWAITING_REG_ROLE') {
        const choice = msgBody.toUpperCase();
        const role = choice.includes('CONSUMER') || choice === '1' ? 'CONSUMER' : choice.includes('VENDOR') || choice === '2' ? 'VENDOR' : null;
        if (!role) {
            replyText = "I didn't catch that. Please type:\n*1* for Consumer\n*2* for Vendor";
        } else {
            updateSession('WHATSAPP', from, 'AWAITING_REG_NAME', { role });
            replyText = `Understood. You are registering as a *${role}*.\n\nPlease enter your *Full Legal Name*.`;
        }
        await sendWhatsAppMessage(phoneNumberId, from, replyText);
        return res.sendStatus(200);
    }

    if (session.state === 'AWAITING_REG_NAME') {
        updateSession('WHATSAPP', from, 'AWAITING_REG_EMAIL', { fullName: msgBody });
        replyText = "Thank you. Now, please enter your *Email Address*.";
        await sendWhatsAppMessage(phoneNumberId, from, replyText);
        return res.sendStatus(200);
    }

    if (session.state === 'AWAITING_REG_EMAIL') {
        updateSession('WHATSAPP', from, 'AWAITING_REG_PASS', { email: msgBody });
        replyText = "Next, set a secure *Password* for your account.";
        await sendWhatsAppMessage(phoneNumberId, from, replyText);
        return res.sendStatus(200);
    }

    if (session.state === 'AWAITING_REG_PASS') {
        updateSession('WHATSAPP', from, 'AWAITING_REG_NIN', { password: msgBody });
        replyText = "Almost there! Please enter your *National ID Number (NIN)*.";
        await sendWhatsAppMessage(phoneNumberId, from, replyText);
        return res.sendStatus(200);
    }

    if (session.state === 'AWAITING_REG_NIN') {
        updateSession('WHATSAPP', from, 'AWAITING_REG_PHONE', { nationalId: msgBody });
        replyText = "Please confirm your *Phone Number* (starting with 234...).";
        await sendWhatsAppMessage(phoneNumberId, from, replyText);
        return res.sendStatus(200);
    }

    if (session.state === 'AWAITING_REG_PHONE') {
        updateSession('WHATSAPP', from, 'AWAITING_REG_ADDRESS', { phoneNumber: msgBody });
        replyText = "Please enter your *Physical Residential Address*.";
        await sendWhatsAppMessage(phoneNumberId, from, replyText);
        return res.sendStatus(200);
    }

    if (session.state === 'AWAITING_REG_ADDRESS') {
        updateSession('WHATSAPP', from, 'AWAITING_REG_PHOTO', { address: msgBody });
        replyText = "Verification Step: Please send a *Live Selfie (Photo)* of yourself for biometric identity verification.";
        await sendWhatsAppMessage(phoneNumberId, from, replyText);
        return res.sendStatus(200);
    }

    // Media Handling (Selfie, Shop Photo, CAC)
    if (msgType === 'image' && session.state.startsWith('AWAITING_REG_')) {
        const mediaId = change.messages[0].image.id;
        try {
            const mediaUrl = await getWhatsAppMediaUrl(mediaId);
            const cloudinaryUrl = await uploadFromUrl(mediaUrl);
            if (!cloudinaryUrl) return res.sendStatus(200);

            // == VISION SCAN (FALLBACK) ==
            if (session.state === 'IDLE' || !session.state) {
                await sendWhatsAppMessage(phoneNumberId, from, "📸 *Vision AI Scan initiated...* extracting device identity from your photo.");
                const imei = await extractImeiFromImage(cloudinaryUrl);
                if (imei) {
                    await sendWhatsAppMessage(phoneNumberId, from, `🤖 IMEI Detected: *${imei}*. Checking registry...`);
                    // Create a pseudo-event or just modify variables to trigger the IMEI flow
                    msgBody = imei;
                    // FALLTHROUGH to the IMEI check logic below
                } else {
                    await sendWhatsAppMessage(phoneNumberId, from, "Sorry, my Vision AI couldn't find a clear IMEI in that photo. Please try more light or type it.");
                    return res.sendStatus(200);
                }
            }

            // CONSUMER SELFIE
            if (session.state === 'AWAITING_REG_PHOTO') {
                if (session.data.role === 'CONSUMER') {
                    replyText = "⏳ Preparing your registration...";
                    await sendWhatsAppMessage(phoneNumberId, from, replyText);
                    const { pending, otp } = await startRegistration({ ...session.data, facialDataUrl: cloudinaryUrl });
                    const { sendOtpViaBots } = require('./auth');
                    await sendOtpViaBots(pending, otp, "verification");

                    updateSession('WHATSAPP', from, 'AWAITING_REG_OTP', { email: pending.email });
                    replyText = `📧 *One Last Step!*\n\nI've sent a 6-digit verification code to your email. Please **type it here** to complete your registration.`;
                } else {
                    updateSession('WHATSAPP', from, 'AWAITING_REG_BIZ_NAME', { facialDataUrl: cloudinaryUrl });
                    replyText = "Great! Now let's set up your business. What is your *Shop/Company Name*?";
                }
                await sendWhatsAppMessage(phoneNumberId, from, replyText);
                return res.sendStatus(200);
            }

            // VENDOR BUSINESS FIELDS handled via text, then photos
        } catch (err) {
            console.error(err);
            await sendWhatsAppMessage(phoneNumberId, from, "Sorry, I couldn't process that photo. Please try again.");
            return res.sendStatus(200);
        }
    }

    // Vendor Specific Fields (Text)
    if (session.state === 'AWAITING_REG_BIZ_NAME') {
        updateSession('WHATSAPP', from, 'AWAITING_REG_BIZ_ADDR', { companyName: msgBody });
        replyText = "What is the *Physical Address* of your shop?";
        await sendWhatsAppMessage(phoneNumberId, from, replyText);
        return res.sendStatus(200);
    }
    if (session.state === 'AWAITING_REG_BIZ_ADDR') {
        updateSession('WHATSAPP', from, 'AWAITING_REG_BIZ_REG', { businessAddress: msgBody });
        replyText = "Please enter your *CAC Registration Number*.";
        await sendWhatsAppMessage(phoneNumberId, from, replyText);
        return res.sendStatus(200);
    }
    if (session.state === 'AWAITING_REG_BIZ_REG') {
        updateSession('WHATSAPP', from, 'AWAITING_REG_SHOP_PHOTO', { businessRegNo: msgBody });
        replyText = "Verification: Please send a *Photo of your Shop Front*.";
        await sendWhatsAppMessage(phoneNumberId, from, replyText);
        return res.sendStatus(200);
    }

    if (session.state === 'AWAITING_REG_OTP') {
        try {
            await finalizeRegistration(session.data.email, msgBody);
            replyText = "✅ *Identity Verified & Account Registered!*\n\nYou can now use the *login* command to access your digital vault.";
            clearSession('WHATSAPP', from);
        } catch (err) {
            replyText = `❌ Verification Failed: ${err.message}. Please send the correct 6-digit code.`;
        }
        await sendWhatsAppMessage(phoneNumberId, from, replyText);
        return res.sendStatus(200);
    }

    // Media Handling for Vendor Shop and CAC
    if (msgType === 'image') {
        const mediaId = change.messages[0].image.id;
        try {
            const mediaUrl = await getWhatsAppMediaUrl(mediaId);
            const cloudinaryUrl = await uploadFromUrl(mediaUrl);

            if (session.state === 'AWAITING_REG_SHOP_PHOTO') {
                updateSession('WHATSAPP', from, 'AWAITING_REG_CAC_PHOTO', { shopPhotoUrl: cloudinaryUrl });
                replyText = "Finally, please send a *Photo of your CAC Certificate* to complete your application.";
                await sendWhatsAppMessage(phoneNumberId, from, replyText);
                return res.sendStatus(200);
            }
            if (session.state === 'AWAITING_REG_CAC_PHOTO') {
                replyText = "⏳ Preparing your Vendor Application...";
                await sendWhatsAppMessage(phoneNumberId, from, replyText);
                const { pending, otp } = await startRegistration({ ...session.data, cacCertificateUrl: cloudinaryUrl });
                const { sendOtpViaBots } = require('./auth');
                await sendOtpViaBots(pending, otp, "verification");

                updateSession('WHATSAPP', from, 'AWAITING_REG_OTP', { email: pending.email });
                replyText = `📧 *One Last Step!*\n\nI've sent a 6-digit verification code to your email. Please **type it here** to verify your identity and submit your business for review.`;
                await sendWhatsAppMessage(phoneNumberId, from, replyText);
                return res.sendStatus(200);
            }
        } catch (e) {
            console.error(e);
        }
    }

    // ORIGINAL LOGIC: Scan message for a 15-digit IMEI
    const imeiMatch = msgBody.match(/\b\d{15}\b/);

    if (!imeiMatch) {
        replyText = `Hello there! 👋 Barka da zuwa! I am the *PTS Sentinel (Vexel AI)*. 🇳🇬\n\nI can help you verify any phone in Nigeria.\n\nCommands:\n- Type *register* to create your identity\n- Type *login* to access your account\n- Type *report* to flag a stolen device\n- Type *panic* to lock ALL your devices (One-Click)\n- Type *language* to switch (ENG, HAU, YOR, IGB, PID)\n- Type *safety* for AI security alerts\n\nDan Allah, tura IMEI mai lamba 15 don dubawa. I'm ready! 😊`;
    } else {
        const imei = imeiMatch[0];
        try {
            const device = await prisma.device.findUnique({
                where: { imei },
                include: { registeredOwner: true }
            });

            if (!device) {
                replyText = `❌ I couldn't find this IMEI (${imei}) in our National Registry.\n\nThis means the device isn't registered yet, or it could be compromised.\n\nIf you are the owner, please log in and register it via the web dashboard.\n\nPlease be careful when buying unregistered devices. A kiyaye siyayya babu tabbaci (Do not buy without verification).`;
            } else {
                // 1.5. Fraud Engine Anomaly Check
                const anomalyWarning = await detectClonedImeiAnomaly(imei, "WHATSAPP", from);

                // 1.6. Smuggling Detector
                if (device.status === 'STOLEN' && device.lastKnownLocation) {
                    const smuggling = await analyzeSmugglingRisk(device.lastKnownLocation, "Detected Terminal", device.status);
                    if (smuggling.isSmuggled) {
                        await sendWhatsAppMessage(phoneNumberId, from, `🚩 *SYNDICATE ALERT:* ${smuggling.warning}`);
                    }
                }

                // 2. AI Translation / Localization
                const aiResponse = await generateLocalizedOracleResponse(
                    device.status,
                    device.brand,
                    device.model,
                    device.riskScore,
                    msgBody,
                    anomalyWarning,
                    session.data.language || 'ENGLISH'
                );

                const statusEmoji = device.status === 'CLEAN' ? '✅' : '🚨';
                const ownerName = device.registeredOwner?.fullName || 'Hidden/Unknown';
                replyText = `📱 *Device Details:*\n- *Status:* ${statusEmoji} ${device.status}\n- *Owner:* 👤 ${ownerName}\n- *Brand/Model:* ${device.brand} ${device.model}\n- *Risk Score:* ${device.riskScore}/100\n\n_" ${aiResponse} "_`;

                // If images exist, send the image + details as a caption
                if (device.devicePhotos && device.devicePhotos.length > 0) {
                    await sendWhatsAppImage(phoneNumberId, from, device.devicePhotos[0], replyText);
                    return res.sendStatus(200);
                }
            }
        } catch (error) {
            console.error("DB/AI Error in WhatsApp webhook:", error);
            replyText = "Oh no! 😟 It looks like our servers are a bit too busy right now and I can't connect.\n\nTuba, don Allah a sake jarrabawa an jima (Please try checking again in a little while).";
        }
    }

    // Send fallback text reply if no image flow was triggered
    await sendWhatsAppMessage(phoneNumberId, from, replyText);
    return res.sendStatus(200);
});

// Function to send an image with optional caption via WhatsApp Cloud API
async function sendWhatsAppImage(phoneNumberId, to, imageUrl, caption = "") {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const numId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!token) return console.warn("⚠️ WHATSAPP_ACCESS_TOKEN is missing.");

    try {
        const response = await fetch(`https://graph.facebook.com/v18.0/${numId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to: to,
                type: "image",
                image: {
                    link: imageUrl,
                    caption: caption
                }
            })
        });

        if (!response.ok) {
            const err = await response.json();
            console.error('WhatsApp Image API Error:', JSON.stringify(err));
        } else {
            console.log(`✅ WhatsApp image sent to ${to}`);
        }
    } catch (error) {
        console.error('Error sending WhatsApp image:', error);
    }
}

// Function to send a text message via WhatsApp Cloud API
async function sendWhatsAppMessage(phoneNumberId, to, text) {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const numId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!token) return console.warn("⚠️ WHATSAPP_ACCESS_TOKEN is missing.");

    try {
        const response = await fetch(`https://graph.facebook.com/v18.0/${numId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to: to,
                text: { body: text },
            })
        });

        if (!response.ok) {
            const err = await response.json();
            console.error('WhatsApp API Error:', JSON.stringify(err));
        } else {
            console.log(`✅ WhatsApp reply sent to ${to}`);
        }
    } catch (error) {
        console.error('Error sending WhatsApp message:', error);
    }
}

// Function to fetch the actual media URL from Meta using a Media ID
async function getWhatsAppMediaUrl(mediaId) {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    try {
        const response = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        return data.url; // This is the temporary URL to the media file
    } catch (error) {
        console.error('Error fetching WhatsApp media URL:', error);
        return null;
    }
}

module.exports = router;
module.exports.sendWhatsAppMessage = sendWhatsAppMessage;
module.exports.sendWhatsAppImage = sendWhatsAppImage;
