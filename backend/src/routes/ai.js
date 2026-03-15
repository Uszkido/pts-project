const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { analyzePhishingMessage, getLegalAdvice } = require('../services/aiService');

/**
 * @route POST /api/v1/ai/scam-shield
 * @desc Analyze a message for phishing/scam patterns
 * @access Protected
 */
router.post('/scam-shield', authenticateToken, async (req, res) => {
    try {
        const { messageText } = req.body;
        if (!messageText) return res.status(400).json({ error: "Message text is required" });

        const result = await analyzePhishingMessage(messageText);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: "AI Shield is currently processing other threats." });
    }
});

/**
 * @route POST /api/v1/ai/legal-advisor
 * @desc Get legal advice regarding stolen property
 * @access Protected
 */
router.post('/legal-advisor', authenticateToken, async (req, res) => {
    try {
        const { query, language = 'ENGLISH' } = req.body;
        if (!query) return res.status(400).json({ error: "Legal query is required" });

        const advice = await getLegalAdvice(query, language);
        res.json({ advice });
    } catch (err) {
        res.status(500).json({ error: "Legal AI is currently in court." });
    }
});

module.exports = router;
