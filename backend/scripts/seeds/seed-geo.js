const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Adding geographic coordinates to vendors...');

    const vendors = await prisma.user.findMany({
        where: { role: 'VENDOR' }
    });

    // Base coordinates for Lagos
    const baseLat = 6.45;
    const baseLng = 3.4;

    for (let i = 0; i < vendors.length; i++) {
        const vendor = vendors[i];
        // Create some spread
        const lat = baseLat + (Math.random() - 0.5) * 0.2;
        const lng = baseLng + (Math.random() - 0.5) * 0.2;

        await prisma.user.update({
            where: { id: vendor.id },
            data: {
                shopLatitude: lat,
                shopLongitude: lng,
                businessAddress: `${Math.floor(Math.random() * 100)} Broad St, Lagos`
            }
        });
        console.log(`Updated vendor ${vendor.email} with location: ${lat}, ${lng}`);
    }

    console.log('Adding coordinates to observation reports...');
    const devices = await prisma.device.findMany({
        where: { status: { in: ['STOLEN', 'LOST', 'INVESTIGATING'] } },
        take: 10
    });

    for (const device of devices) {
        const lat = baseLat + (Math.random() - 0.5) * 0.3;
        const lng = baseLng + (Math.random() - 0.5) * 0.3;

        await prisma.observationReport.create({
            data: {
                deviceId: device.id,
                latitude: lat,
                longitude: lng,
                signalType: Math.random() > 0.5 ? 'WIFI' : 'BT',
                signalStrength: -Math.floor(Math.random() * 50 + 50)
            }
        });
        console.log(`Added observation for device ${device.imei} at ${lat}, ${lng}`);
    }

    console.log('✅ Geo seeding complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
