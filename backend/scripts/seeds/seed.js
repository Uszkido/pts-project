const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');

async function main() {
    const hashedPassword = await bcrypt.hash('password123', 10);

    // 1. Create a dummy Test Vendor
    const vendor = await prisma.user.create({
        data: {
            email: 'testvendor@example.com',
            password: hashedPassword,
            role: 'VENDOR',
            companyName: 'Test Tech Shop',
            vendorTier: 2,
        },
    });

    console.log('Created Vendor:', vendor.email);

    // 2. Create a dummy Clean Device
    const cleanDevice = await prisma.device.create({
        data: {
            imei: '111111111111111',
            brand: 'Apple',
            model: 'iPhone 15 Pro',
            status: 'CLEAN',
            riskScore: 98,
            registeredOwnerId: vendor.id,
        },
    });

    console.log('Created Device IMEI:', cleanDevice.imei);

    // 3. Create a dummy Stolen Device
    const stolenDevice = await prisma.device.create({
        data: {
            imei: '999999999999999',
            brand: 'Samsung',
            model: 'Galaxy S24 Ultra',
            status: 'STOLEN',
            riskScore: 12,
            registeredOwnerId: vendor.id,
        },
    });

    console.log('Created Device IMEI:', stolenDevice.imei);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
