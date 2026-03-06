const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// Helper to generate a random IMEI
function generateRandomIMEI() {
    let imei = '';
    for (let i = 0; i < 15; i++) {
        imei += Math.floor(Math.random() * 10).toString();
    }
    return imei;
}

// Helper to get a random brand and model
const devices = [
    { brand: 'Apple', model: 'iPhone 15 Pro' },
    { brand: 'Apple', model: 'iPhone 14' },
    { brand: 'Samsung', model: 'Galaxy S24 Ultra' },
    { brand: 'Samsung', model: 'Galaxy Z Fold 5' },
    { brand: 'Google', model: 'Pixel 8 Pro' },
    { brand: 'OnePlus', model: '12' }
];

function getRandomDevice() {
    return devices[Math.floor(Math.random() * devices.length)];
}

async function main() {
    console.log('Starting to seed requested users as CONSUMERs with devices...');

    const defaultPassword = 'password123';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    const usersToCreate = [
        'banyo@pts.com',
        'usama@pts.com',
        'alpha@pts.com',
        'muhd@pts.com'
    ];

    for (const email of usersToCreate) {
        // Upsert user as CONSUMER
        const user = await prisma.user.upsert({
            where: { email },
            update: {
                role: 'CONSUMER',
                companyName: null,
                vendorTier: 3, // Reset to default for non-vendors if applicable, though shouldn't matter for consumers
            },
            create: {
                email,
                password: hashedPassword,
                role: 'CONSUMER',
            },
        });

        console.log(`✅ Upserted user: ${email} as CONSUMER`);

        // Check how many devices they currently have
        const currentDevices = await prisma.device.count({
            where: { registeredOwnerId: user.id }
        });

        const devicesToAdd = 5 - currentDevices;

        if (devicesToAdd > 0) {
            console.log(`   Adding ${devicesToAdd} devices to ${email}...`);
            for (let i = 0; i < devicesToAdd; i++) {
                const deviceTemplate = getRandomDevice();
                await prisma.device.create({
                    data: {
                        imei: generateRandomIMEI(),
                        serialNumber: `SN-${Math.floor(Math.random() * 1000000)}`,
                        brand: deviceTemplate.brand,
                        model: deviceTemplate.model,
                        status: 'CLEAN',
                        registeredOwnerId: user.id
                    }
                });
            }
            console.log(`   ✅ Added ${devicesToAdd} devices.`);
        } else {
            console.log(`   User already has ${currentDevices} devices (target was 5). No new ones added.`);
        }
    }

    console.log('\n✅ Successfully updated users and devices.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
