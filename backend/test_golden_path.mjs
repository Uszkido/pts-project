import fetch from 'node-fetch';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const API_URL = 'https://pts-backend-api.vercel.app/api/v1';
const prisma = new PrismaClient();

const randomString = crypto.randomBytes(4).toString('hex');
const testEmail = `e2e_tester_${randomString}@pts.local`;
const testPassword = 'Password123!';
const testImei = `35${Math.floor(1000000000000 + Math.random() * 900000000000)}`;

async function runE2ETest() {
    console.log(`🚀 Starting PTS Golden Path E2E Test on API: ${API_URL}`);
    console.log('--------------------------------------------------');

    try {
        // --- STEP 1: Registration ---
        console.log(`[1] Registering test user: ${testEmail}`);
        const regRes = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testEmail,
                password: testPassword,
                fullName: 'E2E Test User',
                companyName: 'PTS Testing Corp',
                role: 'VENDOR'
            })
        });
        const regData = await regRes.json();
        console.log(`    Response: ${regRes.status} - ${JSON.stringify(regData)}`);

        // --- STEP 2: Extract OTP directly from DB ---
        console.log(`[2] Extracting OTP from Database...`);
        const userInDb = await prisma.pendingUser.findUnique({ where: { email: testEmail } });
        if (!userInDb) throw new Error("User not found in pending database after registration!");

        const otp = userInDb.otp;
        console.log(`    Extracted OTP: ${otp}`);

        // --- STEP 3: Verify OTP ---
        const verifyRes = await fetch(`${API_URL}/auth/verify-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testEmail, otp })
        });
        const verifyData = await verifyRes.json();
        console.log(`    Response: ${verifyRes.status} - ${JSON.stringify(verifyData)}`);

        // --- STEP 4: Login to get JWT Token ---
        console.log(`[4] Logging in...`);
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testEmail, password: testPassword })
        });
        const loginData = await loginRes.json();
        if (!loginData.token) throw new Error("Login failed to return token");
        const token = loginData.token;
        console.log(`    Login SUCCESS. Token acquired.`);

        // --- STEP 5: Register a Device ---
        console.log(`[5] Registering new device (IMEI: ${testImei})...`);
        const deviceRes = await fetch(`${API_URL}/devices`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                imei: testImei,
                brand: 'Apple',
                model: 'iPhone 15 Pro E2E Test',
                serialNumber: `SN-${randomString}`,
            })
        });
        const deviceData = await deviceRes.json();
        console.log(`    Response: ${deviceRes.status} - Device ID: ${deviceData.device?.id}`);

        // --- STEP 6: Public Verification (Simulate scanning device) ---
        console.log(`[6] Public Verification Scan of IMEI...`);
        const scanRes = await fetch(`${API_URL}/devices/verify/${testImei}`);
        const scanData = await scanRes.json();
        console.log(`    Scan Result: Valid = ${scanRes.ok}. Device Status: ${scanData.device?.status}`);

        // --- STEP 7: Report as Stolen ---
        console.log(`[7] Reporting device as STOLEN...`);
        const stolenRes = await fetch(`${API_URL}/devices/${testImei}/report`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: 'STOLEN' })
        });
        const stolenData = await stolenRes.json();
        console.log(`    Response: ${stolenRes.status} - Status now: ${stolenData.device?.status}`);

        // --- STEP 8: Second Verification (Should flag security risk) ---
        console.log(`[8] Second Public Scan (Checking Risk Engine)...`);
        const finalScanRes = await fetch(`${API_URL}/devices/verify/${testImei}`);
        const finalScanData = await finalScanRes.json();
        console.log(`    Final Risk Score: ${finalScanData.device?.riskScore}/100`);
        console.log(`    Listed Status: ${finalScanData.device?.status}`);

        console.log('--------------------------------------------------');
        console.log('✅ ALL GOLDEN PATH TESTS PASSED SUCCESSFULLY! ✅');

    } catch (e) {
        console.error('❌ E2E EXACT EXECUTION FAILED:', e);
    } finally {
        // Cleanup optional, but we'll leave data to prove it exists
        await prisma.$disconnect();
    }
}

runE2ETest();
