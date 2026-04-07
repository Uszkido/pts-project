const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

/**
 * B2B DEVELOPER API PORTAL
 * This handles the automated generation and validation of API Keys for large institutions 
 * (Banks, Fintechs, E-Commerce) to programmatically check IMEI status.
 */

// Generate a new secure API Key for a verified company
router.post('/generate', async (req, res) => {
    try {
        const { companyName, contactEmail, billingPlan } = req.body;

        if (!companyName || !contactEmail) {
            return res.status(400).json({ error: 'Company Name and Contact Email are required.' });
        }

        // 1. Generate a raw, cryptographically secure 32-byte key
        const rawSecret = crypto.randomBytes(32).toString('hex');

        // 2. Format it to look professional (e.g. pts_live_8f9a2...)
        const rawApiKey = `pts_live_${rawSecret}`;

        // 3. Hash it before storing in Database. We NEVER store raw API keys.
        // If the database is breached, the attacker only gets hashes, protecting the B2B clients.
        const apiKeyHash = crypto.createHash('sha256').update(rawApiKey).digest('hex');

        // 4. Register the developer profile
        const devKey = await prisma.developerApiKey.create({
            data: {
                companyName,
                contactEmail,
                apiKeyHash,
                keyPrefix: 'pts_live_',
                billingPlan: billingPlan || 'PAYG',
                monthlyQuota: billingPlan === 'ENTERPRISE' ? 1000000 : 10000
            }
        });

        // REVEAL ONCE ONLY: We send the raw key back one time.
        // The business must store it safely in their own .env files.
        res.status(201).json({
            message: 'API Key generated successfully. For security, this will ONLY BE SHOWN ONCE.',
            company: companyName,
            rawApiKey: rawApiKey,
            securityNote: 'Please store this key in your .env layer. PTS does not store raw keys and cannot recover it if lost.'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to generate API Key' });
    }
});

// The actual Verification Endpoint that Banks/Fintechs will hit constantly
// Example request: GET /api/v1/b2b/verify/351234567890123
router.get('/verify/:imei', async (req, res) => {
    try {
        // 1. Authenticate the request via 'x-api-key' header
        const providedKey = req.headers['x-api-key'];
        if (!providedKey || !providedKey.startsWith('pts_live_')) {
            return res.status(401).json({ error: 'Unauthorized: Missing or malformed PTS API Key.' });
        }

        // 2. Hash the provided key to verify against DB
        const providedHash = crypto.createHash('sha256').update(providedKey).digest('hex');

        const developer = await prisma.developerApiKey.findUnique({
            where: { apiKeyHash: providedHash }
        });

        if (!developer || !developer.isActive) {
            return res.status(403).json({ error: 'Forbidden: Invalid or disabled API Key.' });
        }

        // 3. Rate Limiting / Billing Check
        if (developer.currentUsage >= developer.monthlyQuota) {
            return res.status(429).json({ error: 'Quota Exceeded: You have hit your monthly API limit. Upgrade to Enterprise.' });
        }

        // 4. Perform the actual IMEI fetch
        const { imei } = req.params;
        const device = await prisma.device.findUnique({
            where: { imei },
            select: {
                imei: true,
                brand: true,
                model: true,
                status: true,
                riskScore: true,
                isBricked: true
            }
        });

        // Increment billing usage (asynchronously to keep response insanely fast)
        prisma.developerApiKey.update({
            where: { id: developer.id },
            data: { currentUsage: { increment: 1 }, lastUsedAt: new Date() }
        }).catch(err => console.error("Billing update failed", err));

        // 5. Respond to the Bank/Fintech
        if (!device) {
            return res.status(404).json({
                imei,
                status: 'UNKNOWN',
                message: 'Device not found in the PTS National Registry. Cannot verify safety.'
            });
        }

        res.json({
            imei: device.imei,
            brand: device.brand,
            model: device.model,
            status: device.status, // CLEAN, STOLEN, LOST, etc.
            riskScore: device.riskScore,
            isBricked: device.isBricked,
            isSafeTransaction: device.status === 'CLEAN' && device.riskScore > 50
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal PTS Gateway Error' });
    }
});

module.exports = router;
