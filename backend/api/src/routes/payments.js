const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

// -------------------------------------------------------------
// 💳 PAYSTACK WEBHOOK: AUTOMATIC TOP-UP
// This endpoint is called by Paystack when a client pays.
// -------------------------------------------------------------
router.post('/paystack-webhook', async (req, res) => {
    // 1. Verify Paystack Signature (Security)
    const secret = process.env.PAYSTACK_SECRET_KEY || 'sk_test_placeholder';
    const hash = crypto.createHmac('sha512', secret).update(JSON.stringify(req.body)).digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
        console.error('❌ PAYSTACK: Invalid signature');
        return res.status(401).send('Unauthorized');
    }

    const event = req.body;
    console.log(`--- PAYSTACK EVENT RECEIVED: ${event.event} ---`);

    // 2. Handle Successful Payment
    if (event.event === 'charge.success') {
        const { amount, customer, metadata } = event.data;
        const email = customer.email;
        const amountInNgn = amount / 100; // Paystack sends in kobo

        // --- SCENARIO A: VENDOR TIER 1 UPGRADE FEE ---
        if (metadata && metadata.purpose === 'VENDOR_TIER_UPGRADE') {
            const vendorId = metadata.vendorId;
            console.log(`✅ SUCCESS: Vendor ${email} paid ₦${amountInNgn} for Enterprise Tier 1 Upgrade.`);
            try {
                // Automatically bump vendor tier to 1 instantly
                await prisma.user.update({
                    where: { email }, // using email since customer.email is verified by paystack
                    data: { vendorTier: 1, vendorStatus: 'APPROVED' }
                });

                // Send automated message
                await prisma.message.create({
                    data: {
                        senderId: 'SYSTEM', // Assuming SYSTEM or similar handle
                        receiverId: vendorId, // if the payload had it, though finding by email is safer
                        subject: '📈 Enterprise Tier Unlock Success',
                        body: `Your payment of ₦${amountInNgn} was successful. Your shop is now permanently upgraded to Enterprise Tier 1. You can now access Bulk Uploading and Priority Law Enforcement Routing.`
                    }
                }).catch(e => console.log("Non-fatal: couldn't send sys message to vendor."));

            } catch (err) {
                console.error('❌ FAILED to upgrade vendor tier:', err.message);
            }
        }
        // --- SCENARIO B: DEVELOPER API QUOTA TOP-UP ---
        else {
            // Calculate calls bought (Example: ₦10 per call)
            const callsToAdd = Math.floor(amountInNgn / 10);
            console.log(`✅ SUCCESS: B2B API ${email} paid ₦${amountInNgn}. Adding ${callsToAdd} calls.`);

            try {
                const developer = await prisma.developerApiKey.findFirst({
                    where: { contactEmail: email }
                });

                if (developer) {
                    await prisma.developerApiKey.update({
                        where: { id: developer.id },
                        data: {
                            totalCallsPurchased: { increment: callsToAdd },
                            monthlyQuota: { increment: callsToAdd }, // Instantly increase their limit
                            lastPaymentAmount: amountInNgn,
                            lastPaymentDate: new Date()
                        }
                    });
                    console.log(`🚀 QUOTA UPDATED for ${developer.companyName}`);
                } else {
                    console.warn(`⚠️  WARNING: Payment received from ${email}, but no B2B Developer found. Could be an unaccounted payment.`);
                }
            } catch (err) {
                console.error('❌ FAILED to top-up B2B quota:', err.message);
            }
        }
    }

    res.sendStatus(200); // Always respond 200 to Paystack
});

// GET Payment Status (For frontend)
router.get('/status/:email', async (req, res) => {
    try {
        const developer = await prisma.developerApiKey.findFirst({
            where: { contactEmail: req.params.email },
            select: {
                companyName: true,
                monthlyQuota: true,
                currentUsage: true,
                billingPlan: true,
                totalCallsPurchased: true
            }
        });

        if (!developer) return res.status(404).json({ message: 'Developer not found' });
        res.json({ status: 'success', data: developer });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
