const axios = require('axios');

/**
 * PTS SENTINEL — WhatsApp Notification Service
 * Status: SUSPENDED (v1.7.7)
 * ============================================
 * Keys are kept in process.env but the actual sending is disabled.
 */

const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

const sendWhatsAppMessage = async (to, text) => {
    console.log(`[WhatsApp Service] (SUSPENDED) Would have sent to ${to}: ${text.substring(0, 50)}...`);
    return { status: 'suspended', message: 'WhatsApp service is temporarily offline.' };
};

const sendTemplateMessage = async (to, templateName, components = []) => {
    console.log(`[WhatsApp Service] (SUSPENDED) Would have sent template ${templateName} to ${to}`);
    return { status: 'suspended', message: 'WhatsApp service is temporarily offline.' };
};

module.exports = { sendWhatsAppMessage, sendTemplateMessage };
