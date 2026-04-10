const logger = require('../utils/logger');

// Function to send an image with optional caption via WhatsApp Cloud API
async function sendWhatsAppImage(phoneNumberId, to, imageUrl, caption = "") {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const numId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!token) return logger.warn("⚠️ WHATSAPP_ACCESS_TOKEN is missing.");

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
            logger.error('WhatsApp Image API Error:', JSON.stringify(err));
        } else {
            logger.info(`✅ WhatsApp image sent to ${to}`);
        }
    } catch (error) {
        logger.error('Error sending WhatsApp image:', error);
    }
}

// Function to send a text message via WhatsApp Cloud API
async function sendWhatsAppMessage(phoneNumberId, to, text) {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const numId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!token) return logger.warn("⚠️ WHATSAPP_ACCESS_TOKEN is missing.");

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
            logger.error('WhatsApp API Error:', JSON.stringify(err));
        } else {
            logger.info(`✅ WhatsApp reply sent to ${to}`);
        }
    } catch (error) {
        logger.error('Error sending WhatsApp message:', error);
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
        logger.error('Error fetching WhatsApp media URL:', error);
        return null;
    }
}

module.exports = {
    sendWhatsAppMessage,
    sendWhatsAppImage,
    getWhatsAppMediaUrl
};
