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
    // Return 200 OK immediately so Meta doesn't retry sending the message
    res.sendStatus(200);

    const body = req.body;

    if (body.object === "whatsapp_business_account") {
        if (
            body.entry &&
            body.entry[0].changes &&
            body.entry[0].changes[0] &&
            body.entry[0].changes[0].value.messages &&
            body.entry[0].changes[0].value.messages[0]
        ) {
            const phoneNumberId = body.entry[0].changes[0].value.metadata.phone_number_id;
            const from = body.entry[0].changes[0].value.messages[0].from; // Sender's phone number
            const msgBody = body.entry[0].changes[0].value.messages[0].text.body;

            console.log(`📩 Received WhatsApp message from ${from}: ${msgBody}`);

            // Scan message for a 15-digit IMEI
            const imeiMatch = msgBody.match(/\b\d{15}\b/);

            let replyText = "";

            if (!imeiMatch) {
                replyText = "Barka da zuwa! Welcome to the PTS National Registry. 🇳🇬\n\nTo verify a fairly used phone before buying at Farm Centre or elsewhere, please reply with the *15-digit IMEI* (dial *#06#* to find it).\n\nDan Allah, tura IMEI mai lamba 15 don dubawa.";
            } else {
                const imei = imeiMatch[0];

                try {
                    // Check Database
                    const device = await prisma.device.findUnique({ where: { imei } });

                    if (!device) {
                        replyText = `❌ I did not find this IMEI (${imei}) in our National Registry.\n\nThis means the device is either completely new and unregistered, or the IMEI has been compromised. A kiyaye siyayya babu tabbaci.`;
                    } else {
                        // Run through Gemini AI localization module
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
                    replyText = "Connection error! Tuba, don Allah a sake jarrabawa an jima (Please try again later).";
                }
            }

            // Send Reply back to user via Meta Graph API
            await sendWhatsAppMessage(phoneNumberId, from, replyText);
        }
    }
});

// Function to send the generated message via WhatsApp Cloud API
async function sendWhatsAppMessage(phoneNumberId, to, text) {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    if (!token) {
        console.warn("⚠️ WHATSAPP_ACCESS_TOKEN is missing. Cannot send WhatsApp reply.");
        return;
    }

    try {
        const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
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
            console.error('WhatsApp API Error:', err);
        }
    } catch (error) {
        console.error('Error sending WhatsApp message:', error);
    }
}

module.exports = router;
