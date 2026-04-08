const express = require('express');
const router = express.Router();
const { extractIdDataFromImage } = require('../services/aiService');

/**
 * @route POST /api/v1/ai-public/extract-id
 * @desc Public endpoint for OCR extraction of ID cards (for registration)
 * @access Public
 */
router.post('/extract-id', async (req, res) => {
    try {
        const { idImageUrl } = req.body;
        if (!idImageUrl) return res.status(400).json({ error: "ID image is required" });

        const result = await extractIdDataFromImage(idImageUrl);
        if (result.success) {
            res.json(result);
        } else {
            res.status(422).json({ error: result.error || "Failed to extract data from ID" });
        }
    } catch (err) {
        console.error("Public AI Error:", err);
        res.status(500).json({ error: "Sovereign AI is currently overloaded." });
    }
});

module.exports = router;
