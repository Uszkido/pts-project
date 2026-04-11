
const https = require('https');

const API_HOST = 'pts-backend-api.vercel.app';

function request(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: API_HOST,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

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

async function run() {
    try {
        console.log('Logging in as Admin...');
        const login = await request('POST', '/api/v1/auth/login', {
            email: 'admin@pts.ng',
            password: 'admin_pts_2026'
        });
        const token = login.data.token;
        console.log('Admin Token acquired.');

        console.log('Creating Police user...');
        await request('POST', '/api/v1/admin/users', {
            email: 'police_test@pts.ng',
            password: 'password123',
            role: 'POLICE',
            fullName: 'Officer Test'
        }, token);
        console.log('Police user created.');

        console.log('Creating Vendor user...');
        await request('POST', '/api/v1/admin/users', {
            email: 'vendor_test@pts.ng',
            password: 'password123',
            role: 'VENDOR',
            fullName: 'Global Vendor',
            companyName: 'Global Devices Ltd'
        }, token);
        console.log('Vendor user created.');

        console.log('Creating Consumer user...');
        await request('POST', '/api/v1/admin/users', {
            email: 'consumer_test@pts.ng',
            password: 'password123',
            role: 'CONSUMER',
            fullName: 'Jane Doe',
            nationalId: 'NIN123456789'
        }, token);
        console.log('Consumer user created.');

        console.log('--- ALL TEST USERS CREATED ---');
        console.log('Police: police_test@pts.ng / password123');
        console.log('Vendor: vendor_test@pts.ng / password123');
        console.log('Consumer: consumer_test@pts.ng / password123');

    } catch (err) {
        console.error('Error:', err.message);
    }
}

run();
