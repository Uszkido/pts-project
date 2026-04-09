const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// Route to generate a secure SSO embedding URL for Metabase
router.get('/metabase/embed', async (req, res) => {
    try {
        const METABASE_SITE_URL = process.env.METABASE_SITE_URL || "http://localhost:3001";
        const METABASE_SECRET_KEY = process.env.METABASE_SECRET_KEY;
        const DASHBOARD_ID = parseInt(process.env.METABASE_DASHBOARD_ID || "1", 10);

        if (!METABASE_SECRET_KEY) {
            return res.status(500).json({
                error: "METABASE_SECRET_KEY is not configured in environment variables."
            });
        }

        const payload = {
            resource: { dashboard: DASHBOARD_ID },
            params: {
                // You can inject row-level secure params here (e.g. limiting vendors to only see their own stats)
                // "vendor_id": req.user.id 
            },
            exp: Math.round(Date.now() / 1000) + (10 * 60) // 10 minute expiration
        };

        const token = jwt.sign(payload, METABASE_SECRET_KEY);
        const iframeUrl = `${METABASE_SITE_URL}/embed/dashboard/${token}#bordered=true&titled=true`;

        res.json({ iframeUrl });

    } catch (err) {
        console.error("Metabase embedding error:", err);
        res.status(500).json({ error: "Failed to generate analytics URL" });
    }
});

module.exports = router;
