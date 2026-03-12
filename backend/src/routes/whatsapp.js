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
                replyText = `✅ Welcome, *${user.fullName}*! You are now logged in.\n\nYou can now use the *"report"* command to flag a stolen device.`;
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
                await prisma.device.update({
                    where: { imei },
                    data: { status: 'STOLEN', riskScore: 0 }
                });
                replyText = `🚨 *STOLEN REPORTED!* Your ${device.brand} ${device.model} (${imei}) has been marked as STOLEN in the National Registry. Authorities and vendors have been alerted.`;
            }
        } catch (e) {
            console.error(e);
            replyText = "Error processing report. Please try again.";
        }
        updateSession('WHATSAPP', from, 'LOGGED_IN');
        await sendWhatsAppMessage(phoneNumberId, from, replyText);
        return res.sendStatus(200);
    }

    // == END CONVERSATIONAL REGISTRATION FLOW ==

    // ORIGINAL LOGIC: Scan message for a 15-digit IMEI
    const imeiMatch = msgBody.match(/\b\d{15}\b/);

    if (!imeiMatch) {
        replyText = `Hello there! 👋 Barka da zuwa! I am the *PTS Sentinel (Vexel AI)*. 🇳🇬\n\nI can help you verify a fairly used phone before you buy it at Farm Centre or anywhere else in Kano.\n\nCould you please send me the *15-digit IMEI* of the device? If you're not sure how to find it, just dial *#06#* on the phone.\n\nCommands:\n- Type *login* to access your account\n- Type *report* to flag your registered device as stolen\n\nDan Allah, tura IMEI mai lamba 15 don dubawa. I'm ready when you are! 😊`;
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
                // Check Fraud Engine for Cloned IMEI Velocity
                const anomalyWarning = await detectClonedImeiAnomaly(imei, "WHATSAPP", from);

                const aiResponse = await generateLocalizedOracleResponse(
                    device.status,
                    device.brand,
                    device.model,
                    device.riskScore,
                    msgBody,
                    anomalyWarning
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

module.exports = router;
module.exports.sendWhatsAppMessage = sendWhatsAppMessage;
module.exports.sendWhatsAppImage = sendWhatsAppImage;
