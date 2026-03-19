const fetch = require('node-fetch') || global.fetch;

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID || '';
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY || '';

/**
 * Sends a real-time Push Notification directly to a User's Mobile App via OneSignal
 * @param {string} userId - The User.id (Mapped as external_id when they log in on the app)
 * @param {string} title - Alert Title
 * @param {string} message - Alert Body / Message
 * @param {object} data - Hidden foreground/background data to trigger app navigation or logic
 */
const sendPushNotification = async (userId, title, message, data = {}) => {
    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
        console.warn(`[PUSH SIMULATION] To User '${userId}': ${title} - ${message}`);
        console.warn('⚠️ ONESIGNAL_APP_ID or REST_API_KEY not configured in .env. Logging push instead.');
        return false;
    }

    try {
        const response = await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`
            },
            body: JSON.stringify({
                app_id: ONESIGNAL_APP_ID,
                target_channel: "push",
                include_aliases: {
                    external_id: [userId] // By using external_id, we never need to save device Player IDs in our DB!
                },
                headings: { "en": title },
                contents: { "en": message },
                data: data
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('OneSignal Push Delivery Failed:', errText);
            return false;
        }

        console.log(`✅ Push Notification beamed to User: ${userId}`);
        return true;
    } catch (error) {
        console.error('Critical Error sending Push Notification:', error.message);
        return false;
    }
};

module.exports = {
    sendPushNotification
};
