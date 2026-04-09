const express = require('express');
const router = express.Router();
const { handleTelegramUpdate } = require('../services/telegramOracle');

// Telegram Webhook Terminal
router.post('/webhook', async (req, res) => {
    try {
        await handleTelegramUpdate(req.body);
        res.sendStatus(200);
    } catch (err) {
        console.error("Telegram Webhook Error:", err);
        res.sendStatus(500);
    }
});

// Helper for setting the webhook manually if needed
router.get('/setup', async (req, res) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const url = process.env.TELEGRAM_WEBHOOK_URL; // e.g. https://your-app.vercel.app/api/telegram/webhook

    if (!token || !url) {
        return res.status(400).send("Provide TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_URL in .env");
    }

    try {
        const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${url}`);
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
