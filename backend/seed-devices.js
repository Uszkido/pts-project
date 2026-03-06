const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const brandsAndModels = {
    'Apple': ['iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 15', 'iPhone 14 Pro', 'iPhone 13', 'iPhone 12 Mini'],
    'Samsung': ['Galaxy S24 Ultra', 'Galaxy S23', 'Galaxy Z Fold 5', 'Galaxy A54', 'Galaxy M14'],
    'Google': ['Pixel 8 Pro', 'Pixel 8', 'Pixel 7a', 'Pixel 6 Pro'],
    'Xiaomi': ['13 Pro', '12T', 'Redmi Note 12', 'Poco F5'],
    'Tecno': ['Phantom V Fold', 'Camon 20 Premier', 'Spark 10 Pro'],
    'Infinix': ['VIP', 'Zero 30 5G', 'Note 30 Pro']
};

const statuses = ['CLEAN', 'CLEAN', 'CLEAN', 'CLEAN', 'CLEAN', 'STOLEN', 'LOST', 'INVESTIGATING'];

function generateImei() {
    let imei = '';
    for (let i = 0; i < 15; i++) {
        imei += Math.floor(Math.random() * 10).toString();
    }
    return imei;
}

function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
    console.log('Starting to seed database with 100 devices...');

    // Fetch all available users to assign devices to
    const users = await prisma.user.findMany({ select: { id: true, email: true, role: true } });

    if (users.length === 0) {
        console.error('No users found in the database. Run user seed script first.');
        process.exit(1);
    }

    console.log(`Found ${users.length} users. Assigning devices...`);

    let devicesCreated = 0;
    const brands = Object.keys(brandsAndModels);

    for (let i = 1; i <= 100; i++) {
        const brand = getRandomElement(brands);
        const model = getRandomElement(brandsAndModels[brand]);
        const status = getRandomElement(statuses);
        const owner = getRandomElement(users);
        let imei = generateImei();

        let riskScore;
        if (status === 'CLEAN') {
            riskScore = Math.floor(Math.random() * 20) + 80; // 80 - 100
        } else if (status === 'STOLEN' || status === 'LOST') {
            riskScore = Math.floor(Math.random() * 30); // 0 - 30
        } else {
            riskScore = Math.floor(Math.random() * 30) + 40; // 40 - 70
        }

        try {
            await prisma.device.create({
                data: {
                    imei,
                    brand,
                    model,
                    status,
                    riskScore,
                    registeredOwnerId: owner.id,
                }
            });
            devicesCreated++;
            if (devicesCreated % 10 === 0) {
                console.log(`Created ${devicesCreated} of 100 devices...`);
            }
        } catch (e) {
            // In case of extremely rare IMEI collision, just skip
            console.error(`Failed to create device ${i}: ${e.message.split('\\n')[0]}`);
        }
    }

    console.log(`\n✅ Successfully seeded ${devicesCreated} specific devices into the live database!`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
