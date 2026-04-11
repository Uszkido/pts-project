const https = require('https');

const API_HOST = 'pts-backend-api.vercel.app';

function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: API_HOST,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(json);
                    } else {
                        reject(new Error(`Status ${res.statusCode}: ${JSON.stringify(json)}`));
                    }
                } catch (e) {
                    reject(new Error(`Status ${res.statusCode}: Raw body: ${data}`));
                }
            });
        });

        req.on('error', (e) => reject(e));
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function testPortals() {
    console.log('--- PTS PROD SYSTEM INTEGRITY CHECK (No Axios) ---');

    try {
        console.log('\n[1] Triggering Health Check & Admin Override...');
        const health = await request('GET', '/health');
        console.log('Health Status:', health.status);
        console.log('Admin Fix:', health.admin_fix);

        console.log('\n[2] Testing Admin Login (admin@pts.ng)...');
        const adminLogin = await request('POST', '/api/v1/auth/login', {
            email: 'admin@pts.ng',
            password: 'admin_pts_2026'
        });
        console.log('Status: SUCCESS');
        console.log('Role:', adminLogin.data.user.role);

        const testId = Date.now();

        console.log('\n[3] Testing Police Portal (Registration + Login)...');
        const policeEmail = `police_${testId}@pts.ng`;
        await request('POST', '/api/v1/auth/register', {
            email: policeEmail,
            password: 'password123',
            role: 'POLICE',
            fullName: 'Officer Test',
            badgeNumber: 'PTS-999'
        });
        const policeLogin = await request('POST', '/api/v1/auth/login', {
            email: policeEmail,
            password: 'password123'
        });
        console.log('Login Role:', policeLogin.data.user.role);

        console.log('\n[4] Testing Vendor Portal (Registration + Login)...');
        const vendorEmail = `vendor_${testId}@pts.ng`;
        await request('POST', '/api/v1/auth/register', {
            email: vendorEmail,
            password: 'password123',
            role: 'VENDOR',
            businessName: 'Global Devices Ltd'
        });
        const vendorLogin = await request('POST', '/api/v1/auth/login', {
            email: vendorEmail,
            password: 'password123'
        });
        console.log('Login Role:', vendorLogin.data.user.role);

        console.log('\n[5] Testing Consumer Portal (Registration + Login)...');
        const consumerEmail = `consumer_${testId}@pts.ng`;
        await request('POST', '/api/v1/auth/register', {
            email: consumerEmail,
            password: 'password123',
            role: 'CONSUMER',
            fullName: 'Jane Doe',
            nationalId: 'NIN123456789'
        });
        const consumerLogin = await request('POST', '/api/v1/auth/login', {
            email: consumerEmail,
            password: 'password123'
        });
        console.log('Login Role:', consumerLogin.data.user.role);

        console.log('\n--- ALL PORTALS VERIFIED AT API LEVEL ---');
    } catch (error) {
        console.error('\n!!! VERIFICATION FAILED !!!');
        console.error(error.message);
    }
}

testPortals();
