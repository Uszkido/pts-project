const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const prisma = new PrismaClient();

/**
 * B2B DEVELOPER API PORTAL
 * This handles the automated generation and validation of API Keys for large institutions 
 * (Banks, Fintechs, E-Commerce) to programmatically check IMEI status.
 */

// Email transporter (reuses the same SMTP setup as OTP delivery)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

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
        // If the database is breached, the attacker only gets useless hashes.
        const apiKeyHash = crypto.createHash('sha256').update(rawApiKey).digest('hex');

        // 4. Register the developer profile in DB
        await prisma.developerApiKey.create({
            data: {
                companyName,
                contactEmail,
                apiKeyHash,
                keyPrefix: 'pts_live_',
                billingPlan: billingPlan || 'PAYG',
                monthlyQuota: billingPlan === 'ENTERPRISE' ? 1000000 : 500 // 500 free trial calls
            }
        });

        // 5. AUTOMATICALLY EMAIL THE KEY to the company's contact address
        // This is the fully automated, scalable delivery mechanism.
        // No manual work is needed from the PTS team regardless of scale.
        const mailOptions = {
            from: `"PTS Developer Portal" <${process.env.EMAIL_USER}>`,
            to: contactEmail,
            subject: `🔑 Your PTS API Key — ${companyName}`,
            html: `
                <div style="background:#020817;color:#e2e8f0;font-family:monospace;padding:40px;border-radius:12px;max-width:600px;margin:0 auto;border:1px solid #1e293b;">
                    <div style="text-align:center;margin-bottom:30px;">
                        <div style="font-size:28px;font-weight:900;letter-spacing:0.2em;color:#3b82f6;">PTS</div>
                        <div style="font-size:11px;color:#64748b;letter-spacing:0.4em;text-transform:uppercase;">Police Tracking System — Developer Portal</div>
                    </div>
                    <h2 style="color:#10b981;font-size:18px;">API Key Ready, ${companyName}</h2>
                    <p style="color:#94a3b8;line-height:1.7;">Your integration request has been approved and your unique API Key has been generated and cryptographically registered in the PTS National Registry.</p>
                    
                    <div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:20px;margin:24px 0;border-left:4px solid #3b82f6;">
                        <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.2em;margin-bottom:8px;">YOUR SECRET API KEY</div>
                        <div style="font-size:13px;color:#10b981;word-break:break-all;font-weight:bold;">${rawApiKey}</div>
                    </div>

                    <div style="background:#7f1d1d30;border:1px solid #7f1d1d;border-radius:8px;padding:16px;margin-bottom:24px;">
                        <strong style="color:#f87171;">⚠️ SECURITY NOTICE:</strong>
                        <p style="color:#fca5a5;font-size:13px;margin:8px 0 0;">This key is shown ONCE and will NEVER be displayed again. PTS does not store raw keys. Store it immediately in your server's environment variables (.env) and never share it publicly or commit it to GitHub.</p>
                    </div>

                    <div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:20px;margin-bottom:24px;">
                        <div style="font-size:12px;color:#64748b;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.1em;">Integration Details</div>
                        <div style="font-size:13px;line-height:2.2;">
                            <span style="color:#64748b;">Plan:</span> <span style="color:#fff;">${billingPlan || 'PAYG (Pay As You Go)'}</span><br/>
                            <span style="color:#64748b;">Monthly Quota:</span> <span style="color:#fff;">${billingPlan === 'ENTERPRISE' ? '1,000,000' : '10,000'} API Calls</span><br/>
                            <span style="color:#64748b;">Endpoint:</span> <span style="color:#3b82f6;">GET /api/v1/b2b/verify/:imei</span><br/>
                            <span style="color:#64748b;">Auth Header:</span> <span style="color:#fff;">x-api-key: &lt;your key&gt;</span>
                        </div>
                    </div>

                    <p style="color:#475569;font-size:11px;text-align:center;">© Vexel Innovations 2026 — PTS National Device Registry</p>
                </div>
            `
        };

        // Fire email asynchronously — keeps HTTP response fast regardless of SMTP speed
        transporter.sendMail(mailOptions).catch(err =>
            console.error('API key email delivery failed:', err.message)
        );

        // 6. Respond to whoever triggered the generation (e.g. your admin panel)
        res.status(201).json({
            message: `API Key generated and emailed directly to ${contactEmail}.`,
            company: companyName,
            plan: billingPlan || 'PAYG',
            securityNote: 'Raw key delivered to company email. It is NOT stored in the PTS database.'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to generate API Key' });
    }
});

// The verification endpoint that Banks/Fintechs hit constantly to check an IMEI
// Example: GET /api/v1/b2b/verify/351234567890123
// Header:  x-api-key: pts_live_xxxx
router.get('/verify/:imei', async (req, res) => {
    try {
        // 1. Authenticate via 'x-api-key' header
        const providedKey = req.headers['x-api-key'];
        if (!providedKey || !providedKey.startsWith('pts_live_')) {
            return res.status(401).json({ error: 'Unauthorized: Missing or malformed PTS API Key.' });
        }

        // 2. Hash the provided key and look it up
        const providedHash = crypto.createHash('sha256').update(providedKey).digest('hex');
        const developer = await prisma.developerApiKey.findUnique({
            where: { apiKeyHash: providedHash }
        });

        if (!developer || !developer.isActive) {
            return res.status(403).json({ error: 'Forbidden: Invalid or disabled API Key.' });
        }

        // 3. Rate Limiting / Billing Check
        if (developer.currentUsage >= developer.monthlyQuota) {
            return res.status(429).json({ error: 'Quota Exceeded: Monthly API limit reached. Please upgrade to Enterprise.' });
        }

        // 4. Perform the IMEI lookup
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

        // Increment billing usage asynchronously (keeps response fast)
        prisma.developerApiKey.update({
            where: { id: developer.id },
            data: { currentUsage: { increment: 1 }, lastUsedAt: new Date() }
        }).catch(err => console.error('Billing update failed', err));

        // 5. Return result
        if (!device) {
            return res.status(404).json({
                imei,
                status: 'UNKNOWN',
                message: 'Device not found in the PTS National Registry.'
            });
        }

        res.json({
            imei: device.imei,
            brand: device.brand,
            model: device.model,
            status: device.status,
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
