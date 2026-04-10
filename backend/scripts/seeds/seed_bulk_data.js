const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);

    // 1. Initial Accounts
    const baseAccounts = [
        { email: 'admin@pts.ng', role: 'ADMIN', fullName: 'Chief Administrator' },
        { email: 'vendor@pts.ng', role: 'VENDOR', fullName: 'Authorized Vendor', companyName: 'PTS Test Hub', vendorStatus: 'APPROVED' },
        { email: 'consumer@pts.ng', role: 'CONSUMER', fullName: 'John Consumer' },
        { email: 'police@pts.ng', role: 'POLICE', fullName: 'Officer Inspector' }
    ];

    console.log('--- Ensuring Base Accounts ---');
    for (const acc of baseAccounts) {
        await prisma.user.upsert({
            where: { email: acc.email },
            update: {},
            create: {
                ...acc,
                password: hashedPassword,
                status: 'ACTIVE',
                isEmailConfirmed: true
            }
        });
    }

    // 2. Add 10 more accounts
    console.log('--- Generating 10 Additional Accounts ---');
    const newAccounts = [];
    const roles = ['CONSUMER', 'VENDOR', 'CONSUMER', 'CONSUMER', 'VENDOR', 'POLICE', 'CONSUMER', 'VENDOR', 'CONSUMER', 'CONSUMER'];

    for (let i = 1; i <= 10; i++) {
        const id = i.toString().padStart(2, '0');
        const role = roles[i - 1];
        const email = `user${id}@pts.ng`;
        const fullName = `Test User ${id}`;

        const userData = {
            email,
            password: hashedPassword,
            role,
            fullName,
            status: 'ACTIVE',
            isEmailConfirmed: true
        };

        if (role === 'VENDOR') {
            userData.companyName = `Vendor Business ${id}`;
            userData.vendorStatus = 'APPROVED';
        }

        const user = await prisma.user.upsert({
            where: { email },
            update: {},
            create: userData
        });
        newAccounts.push(user);
        console.log(`Created: ${user.email} (${user.role})`);
    }

    // 3. Add 10 more devices and assign randomly
    console.log('--- Generating 10 Additional Devices ---');
    const brands = ['Apple', 'Samsung', 'Google', 'Nothing', 'Xiaomi'];
    const models = ['iPhone 15', 'Galaxy S24', 'Pixel 8', 'Phone (2)', 'Redmi Note 13'];

    // Get all potential owners (base + new)
    const allOwners = await prisma.user.findMany({
        where: { role: { in: ['CONSUMER', 'VENDOR'] } }
    });

    for (let i = 1; i <= 10; i++) {
        const imei = `3589${Math.floor(Math.random() * 90000000000).toString().padStart(11, '0')}`;
        const brand = brands[Math.floor(Math.random() * brands.length)];
        const model = models[Math.floor(Math.random() * models.length)];
        const owner = allOwners[Math.floor(Math.random() * allOwners.length)];

        const device = await prisma.device.create({
            data: {
                imei,
                brand,
                model,
                status: 'CLEAN',
                riskScore: 100,
                registeredOwnerId: owner.id,
                screenSerialNumber: `SN-SCR-${i}${Math.random().toString(36).substring(7).toUpperCase()}`,
                batterySerialNumber: `SN-BAT-${i}${Math.random().toString(36).substring(7).toUpperCase()}`,
                motherboardSerialNumber: `SN-MOB-${i}${Math.random().toString(36).substring(7).toUpperCase()}`
            }
        });
        console.log(`Created Device: ${brand} ${model} (${imei}) assigned to ${owner.email}`);
    }

    console.log('--- SEEDING COMPLETE ---');
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
