const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { generateLocalizedOracleResponse } = require('../services/aiService');

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
        // Not a message event (e.g. a status update), just acknowledge it
        return res.sendStatus(200);
    }

    const change = body.entry[0].changes[0].value;
    const phoneNumberId = change.metadata.phone_number_id;
    const from = change.messages[0].from;
    const msgBody = change.messages[0]?.text?.body;

    if (!msgBody) {
        // Could be an image/audio message, not text — ignore for now
        return res.sendStatus(200);
    }

    console.log(`📩 Received WhatsApp message from ${from}: ${msgBody}`);

    // Scan message for a 15-digit IMEI
    const imeiMatch = msgBody.match(/\b\d{15}\b/);
    let replyText = "";

    if (!imeiMatch) {
        replyText = "Barka da zuwa! Welcome to the PTS National Registry. 🇳🇬\n\nTo verify a fairly used phone before buying at Farm Centre or elsewhere in Kano, please send the *15-digit IMEI* (dial *#06#* on the phone to find it).\n\nDan Allah, tura IMEI mai lamba 15 don dubawa.";
    } else {
        const imei = imeiMatch[0];
        try {
            const device = await prisma.device.findUnique({ where: { imei } });

            if (!device) {
                replyText = `❌ I did not find this IMEI (${imei}) in our National Registry.\n\nThis means the device is either unregistered or its IMEI has been tampered with. Please exercise caution.\n\nA kiyaye siyayya babu tabbaci (Do not buy without verification).`;
            } else {
                replyText = await generateLocalizedOracleResponse(
                    device.status,
                    device.brand,
                    device.model,
                    device.riskScore,
                    msgBody
                );
            }
        } catch (error) {
            console.error("DB/AI Error in WhatsApp webhook:", error);
            replyText = "Connection error! Our servers are temporarily busy. Tuba, don Allah a sake jarrabawa an jima (Please try again later).";
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
