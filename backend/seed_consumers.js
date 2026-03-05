const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function main() {
    const hashedPassword = await bcrypt.hash('password123', 10);

    // Create Alice (Seller)
    const alice = await prisma.user.upsert({
        where: { email: 'alice@pts.com' },
        update: {},
        create: {
            email: 'alice@pts.com',
            password: hashedPassword,
            role: 'CONSUMER'
        }
    });
    console.log('Created Alice:', alice.email);

    // Create Bob (Buyer)
    const bob = await prisma.user.upsert({
        where: { email: 'bob@pts.com' },
        update: {},
        create: {
            email: 'bob@pts.com',
            password: hashedPassword,
            role: 'CONSUMER'
        }
    });
    console.log('Created Bob:', bob.email);

    // Give Alice a device
    const imei = '888888888888888';
    let device = await prisma.device.findUnique({ where: { imei } });

    if (!device) {
        device = await prisma.device.create({
            data: {
                imei,
                brand: 'Samsung',
                model: 'Galaxy S24 Ultra',
                serialNumber: 'SAMS24U-999',
                status: 'CLEAN',
                registeredOwnerId: alice.id
            }
        });
        console.log('Created test device for Alice:', device.imei);

        // Generate DDOC
        const ddocHash = crypto.createHash('sha256').update(`${device.id}-${alice.id}-${Date.now()}`).digest('hex');
        await prisma.certificate.create({
            data: {
                deviceId: device.id,
                ownerId: alice.id,
                qrHash: ddocHash
            }
        });
        console.log('Generated DDOC for Alice\'s device');
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
