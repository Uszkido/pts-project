const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
    console.log('Starting to seed database with users...');

    // Use a standard password for all test accounts so the user can easily log into any of them
    const defaultPassword = 'password123';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // --- 1. Create 5 Law Enforcement (POLICE) Accounts ---
    console.log('\n--- Creating 5 Police Accounts ---');
    for (let i = 1; i <= 5; i++) {
        const email = `police${i}@example.com`;

        // Use upsert so we don't crash if we accidentally run this script twice
        await prisma.user.upsert({
            where: { email },
            update: {},
            create: {
                email,
                password: hashedPassword,
                role: 'POLICE',
                companyName: `Precinct ${i} Cyber Division`,
            },
        });
        console.log(`Created: ${email} (Password: ${defaultPassword})`);
    }

    // --- 2. Create 20 Vendor Accounts ---
    console.log('\n--- Creating 20 Vendor Accounts ---');
    const vendorTiers = [1, 1, 2, 2, 3]; // Weights to simulate different types of vendors
    for (let i = 1; i <= 20; i++) {
        const email = `vendor${i}@example.com`;
        const tier = vendorTiers[i % vendorTiers.length];

        await prisma.user.upsert({
            where: { email },
            update: {},
            create: {
                email,
                password: hashedPassword,
                role: 'VENDOR',
                companyName: `Test Vendor Shop #${i}`,
                vendorTier: tier,
            },
        });
        console.log(`Created: ${email} (Tier ${tier})`);
    }

    // --- 3. Create 50 Consumer Accounts ---
    console.log('\n--- Creating 50 Consumer Accounts ---');
    for (let i = 1; i <= 50; i++) {
        const email = `consumer${i}@example.com`;

        await prisma.user.upsert({
            where: { email },
            update: {},
            create: {
                email,
                password: hashedPassword,
                role: 'CONSUMER',
                companyName: null,
            },
        });
        if (i % 10 === 0) {
            console.log(`Created consumer ${i} of 50...`);
        }
    }

    console.log('\n✅ Successfully seeded all 75 requested users into the live Neon database!');
    console.log(`\nAll accounts use the password: '${defaultPassword}'`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
