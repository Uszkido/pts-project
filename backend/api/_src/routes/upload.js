const express = require('express');
const router = express.Router();
const upload = require('../upload');
const authenticateToken = require('../middleware/auth');

// Upload a single public document (e.g. CAC, Selfie during registration)
// We might not require authentication for registration uploads, but we do for evidence.
router.post('/document', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        res.json({ message: 'File uploaded successfully', url: req.file.path });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Upload evidence for an incident report (Requires Auth)
router.post('/evidence', authenticateToken, upload.single('evidence'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No evidence file uploaded' });
        }
        res.json({ message: 'Evidence uploaded successfully', url: req.file.path });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Upload multiple device photos for Visual Identity
router.post('/multi', authenticateToken, upload.array('files', 5), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }
        const urls = req.files.map(f => f.path);
        res.json({ message: 'Files uploaded successfully', urls });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
