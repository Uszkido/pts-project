/**
 * NCC SOVEREIGN SANDBOX GENERATOR
 * Run this to create a 1,000,000 call ENTERPRISE API key for NCC/Stakeholder testing.
 */
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

async function generateNCCKey() {
    console.log('--- PTS SENTINEL: GENERATING NCC SOVEREIGN SANDBOX ---');

    // 1. Generate Raw Key
    const rawKey = crypto.randomBytes(32).toString('hex');
    const keyPrefix = 'pts_ncc_sandbox_';
    const displayKey = `${keyPrefix}${rawKey}`;

    // 2. Hash the key for DB storage
    const apiKeyHash = crypto.createHash('sha256').update(displayKey).digest('hex');

    try {
        const nccKey = await prisma.developerApiKey.create({
            data: {
                companyName: 'Nigerian Communications Commission (NCC)',
                contactEmail: 'ncc-sandbox@pts-sentinel.ng',
                apiKeyHash: apiKeyHash,
                keyPrefix: keyPrefix,
                billingPlan: 'ENTERPRISE',
                monthlyQuota: 1000000,
                isWaived: true, // PTS Sovereign Waiver enabled
                isActive: true
            }
        });

        console.log('\n✅ SUCCESS: NCC Sandbox Key Created');
        console.log('-------------------------------------------');
        console.log('ORGANIZATION: Nigerian Communications Commission (NCC)');
        console.log('QUOTA: 1,000,000 Calls/Month');
        console.log('X-API-KEY (RAW):');
        console.log(displayKey);
        console.log('-------------------------------------------');
        console.log('\n⚠️  IMPORTANT: Copy the RAW key above and send it securely to your NCC contact.');
        console.log('This key is NOT stored in the database (only the hash is stored).');
    } catch (error) {
        console.error('❌ FAILED to generate key:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

generateNCCKey();
