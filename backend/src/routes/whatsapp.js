const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { generateLocalizedOracleResponse } = require('../services/aiService');
const { detectClonedImeiAnomaly } = require('../services/fraudEngine');
const { getSession, updateSession, clearSession } = require('../services/botState');
const bcrypt = require('bcryptjs');

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
    const msgBody = msgType === 'text' ? change.messages[0]?.text?.body || '' : '';

    // Ignore unsupported types, but allow text and image
    if (msgType !== 'text' && msgType !== 'image') {
        return res.sendStatus(200);
    }

    console.log(`📩 Received WhatsApp message from ${from}`);

    const session = getSession('WHATSAPP', from);
    let replyText = "";

    // == CONVERSATIONAL REGISTRATION FLOW ==
    if (msgBody.toLowerCase() === 'register') {
        updateSession('WHATSAPP', from, 'AWAITING_ROLE');
        replyText = "Great! Let's get you registered.\n\nAre you registering as a *Regular User* or a *Vendor*? (Reply with 'user' or 'vendor')";
        await sendWhatsAppMessage(phoneNumberId, from, replyText);
        return res.sendStatus(200);
    }

    if (session.state === 'AWAITING_ROLE') {
        const role = msgBody.toLowerCase() === 'vendor' ? 'VENDOR' : 'PUBLIC';
        updateSession('WHATSAPP', from, 'AWAITING_NAME', { role });
        replyText = "Got it! First, please reply with your *Full Name*.";
        await sendWhatsAppMessage(phoneNumberId, from, replyText);
        return res.sendStatus(200);
    }

    if (session.state === 'AWAITING_NAME') {
        updateSession('WHATSAPP', from, 'AWAITING_EMAIL', { fullName: msgBody });
        replyText = "Thanks! Now, please reply with your *Email Address* (or type 'skip' if you don't have one).";
        await sendWhatsAppMessage(phoneNumberId, from, replyText);
        return res.sendStatus(200);
    }

    if (session.state === 'AWAITING_EMAIL') {
        const email = msgBody.toLowerCase() === 'skip' ? `${from}@whatsapp.local` : msgBody;
        updateSession('WHATSAPP', from, 'AWAITING_USER_SELFIE', { email });
        replyText = "Please *upload a selfie* for identity verification.";
        await sendWhatsAppMessage(phoneNumberId, from, replyText);
        return res.sendStatus(200);
    }

    if (session.state === 'AWAITING_USER_SELFIE') {
        if (msgType !== 'image') {
            await sendWhatsAppMessage(phoneNumberId, from, "Please upload a photo (your selfie).");
            return res.sendStatus(200);
        }
        const selfieUrl = `whatsapp-media://${change.messages[0].image.id}`;
        updateSession('WHATSAPP', from, session.data.role === 'VENDOR' ? 'AWAITING_CAC_CERT' : 'CREATING_USER', { facialDataUrl: selfieUrl });

        if (session.data.role === 'VENDOR') {
            await sendWhatsAppMessage(phoneNumberId, from, "Great! Since you are a Vendor, please *upload a photo of your CAC Certificate*.");
            return res.sendStatus(200);
        }
        session.state = 'CREATING_USER';
    }

    if (session.state === 'AWAITING_CAC_CERT') {
        if (msgType !== 'image') {
            await sendWhatsAppMessage(phoneNumberId, from, "Please upload a photo of your CAC Certificate.");
            return res.sendStatus(200);
        }
        updateSession('WHATSAPP', from, 'AWAITING_SHOP_PHOTO', { cacCertificateUrl: `whatsapp-media://${change.messages[0].image.id}` });
        await sendWhatsAppMessage(phoneNumberId, from, "Thanks! Finally for your vendor details, please *upload a photo of your shop*.");
        return res.sendStatus(200);
    }

    if (session.state === 'AWAITING_SHOP_PHOTO') {
        if (msgType !== 'image') {
            await sendWhatsAppMessage(phoneNumberId, from, "Please upload a photo of your shop.");
            return res.sendStatus(200);
        }
        updateSession('WHATSAPP', from, 'CREATING_USER', { shopPhotoUrl: `whatsapp-media://${change.messages[0].image.id}` });
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
                    phoneNumber: from,
                    role: session.data.role,
                    facialDataUrl: session.data.facialDataUrl,
                    cacCertificateUrl: session.data.cacCertificateUrl || null,
                    shopPhotoUrl: session.data.shopPhotoUrl || null,
                    vendorStatus: session.data.role === 'VENDOR' ? 'PENDING' : 'APPROVED'
                }
            });
            updateSession('WHATSAPP', from, 'AWAITING_DEVICE_IMEI', { userId: user.id });
            replyText = `🎉 Account created successfully!\n\nYour temporary password is: *${plainPassword}*\n\nNow, let's register your device. Please reply with the *15-digit IMEI* of the device (dial *#06#* to find it).`;
        } catch (e) {
            console.error(e);
            replyText = "Oops, failed to create account. Registration cancelled.";
            clearSession('WHATSAPP', from);
        }
        if (replyText) {
            await sendWhatsAppMessage(phoneNumberId, from, replyText);
            return res.sendStatus(200);
        }
    }

    if (session.state === 'AWAITING_DEVICE_IMEI') {
        const imeiMatch = msgBody.match(/\b\d{15}\b/);
        if (!imeiMatch) {
            replyText = "That doesn't look like a 15-digit IMEI. Please dial *#06#* and send the 15 digits.";
            await sendWhatsAppMessage(phoneNumberId, from, replyText);
            return res.sendStatus(200);
        }
        const existing = await prisma.device.findUnique({ where: { imei: imeiMatch[0] } });
        if (existing) {
            replyText = "This IMEI is already registered! If this is a mistake, please contact support. Registration cancelled.";
            clearSession('WHATSAPP', from);
            await sendWhatsAppMessage(phoneNumberId, from, replyText);
            return res.sendStatus(200);
        }
        updateSession('WHATSAPP', from, 'AWAITING_DEVICE_BRAND', { imei: imeiMatch[0] });
        replyText = "Got it! What is the *Brand* of the device? (e.g., Apple, Samsung, Tecno)";
        await sendWhatsAppMessage(phoneNumberId, from, replyText);
        return res.sendStatus(200);
    }

    if (session.state === 'AWAITING_DEVICE_BRAND') {
        updateSession('WHATSAPP', from, 'AWAITING_DEVICE_MODEL', { brand: msgBody });
        replyText = "And what is the *Model*? (e.g., iPhone 13 Pro, Galaxy S21)";
        await sendWhatsAppMessage(phoneNumberId, from, replyText);
        return res.sendStatus(200);
    }

    if (session.state === 'AWAITING_DEVICE_MODEL') {
        updateSession('WHATSAPP', from, 'AWAITING_DEVICE_PHOTO', { model: msgBody });
        replyText = "Almost done! Please *upload a photo of the device itself*.";
        await sendWhatsAppMessage(phoneNumberId, from, replyText);
        return res.sendStatus(200);
    }

    if (session.state === 'AWAITING_DEVICE_PHOTO') {
        if (msgType !== 'image') {
            await sendWhatsAppMessage(phoneNumberId, from, "Please upload a photo of the device.");
            return res.sendStatus(200);
        }
        const photoUrl = `whatsapp-media://${change.messages[0].image.id}`;
        updateSession('WHATSAPP', from, 'AWAITING_DEVICE_CARTON', { devicePhoto: photoUrl });
        await sendWhatsAppMessage(phoneNumberId, from, "Awesome! Now please *upload a photo of the device carton*.");
        return res.sendStatus(200);
    }

    if (session.state === 'AWAITING_DEVICE_CARTON') {
        if (msgType !== 'image') {
            await sendWhatsAppMessage(phoneNumberId, from, "Please upload a photo of the device carton.");
            return res.sendStatus(200);
        }
        const cartonUrl = `whatsapp-media://${change.messages[0].image.id}`;
        updateSession('WHATSAPP', from, 'AWAITING_DEVICE_RECEIPT', { cartonPhotoUrl: cartonUrl });
        await sendWhatsAppMessage(phoneNumberId, from, "Almost finished! Finally, *upload a photo of the purchase receipt*.");
        return res.sendStatus(200);
    }

    if (session.state === 'AWAITING_DEVICE_RECEIPT') {
        if (msgType !== 'image') {
            await sendWhatsAppMessage(phoneNumberId, from, "Please upload a photo of the purchase receipt.");
            return res.sendStatus(200);
        }
        const receiptUrl = `whatsapp-media://${change.messages[0].image.id}`;

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
            replyText = `✅ Registration Complete!\n\nYour *${session.data.brand} ${session.data.model}* (${session.data.imei}) is now fully secured on the National Registry.`;
        } catch (e) {
            replyText = "Failed to register device. Please try again.";
        }
        clearSession('WHATSAPP', from);
        await sendWhatsAppMessage(phoneNumberId, from, replyText);
        return res.sendStatus(200);
    }
    // == END CONVERSATIONAL REGISTRATION FLOW ==

    // ORIGINAL LOGIC: Scan message for a 15-digit IMEI
    const imeiMatch = msgBody.match(/\b\d{15}\b/);

    if (!imeiMatch) {
        replyText = `Hello there! 👋 Barka da zuwa! I am your friendly PTS National Registry assistant. 🇳🇬\n\nI can help you verify a fairly used phone before you buy it at Farm Centre or anywhere else in Kano.\n\nCould you please send me the *15-digit IMEI* of the device? If you're not sure how to find it, just dial *#06#* on the phone.\n\n*(Or, if you want to register a new account and device, just reply with the word "register")*\n\nDan Allah, tura IMEI mai lamba 15 don dubawa. I'm ready when you are! 😊`;
    } else {
        const imei = imeiMatch[0];
        try {
            const device = await prisma.device.findUnique({ where: { imei } });

            if (!device) {
                replyText = `❌ I couldn't find this IMEI (${imei}) in our National Registry.\n\nThis means the device isn't registered yet, or it could be compromised.\n\nIf this is your device, you can securely register it right here! Just reply with the word *"register"* to begin taking ownership.\n\nPlease be careful when buying unregistered devices. A kiyaye siyayya babu tabbaci (Do not buy without verification).`;
            } else {
                // Check Fraud Engine for Cloned IMEI Velocity
                const anomalyWarning = await detectClonedImeiAnomaly(imei, "WHATSAPP", from);

                replyText = await generateLocalizedOracleResponse(
                    device.status,
                    device.brand,
                    device.model,
                    device.riskScore,
                    msgBody,
                    anomalyWarning
                );
            }
        } catch (error) {
            console.error("DB/AI Error in WhatsApp webhook:", error);
            replyText = "Oh no! 😟 It looks like our servers are a bit too busy right now and I can't connect.\n\nTuba, don Allah a sake jarrabawa an jima (Please try checking again in a little while).";
        }
    }

    // Send reply BEFORE ending the response so Vercel doesn't kill the function
    await sendWhatsAppMessage(phoneNumberId, from, replyText);

    // Only AFTER the reply is sent, acknowledge Meta's webhook request
    return res.sendStatus(200);
});

// Function to send a message via WhatsApp Cloud API
async function sendWhatsAppMessage(phoneNumberId, to, text) {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const numId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!token) {
        console.warn("⚠️ WHATSAPP_ACCESS_TOKEN is missing. Cannot send WhatsApp reply.");
        return;
    }

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

module.exports = router;
module.exports.sendWhatsAppMessage = sendWhatsAppMessage;
