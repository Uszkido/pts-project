const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function seedVerification() {
    try {
        console.log("Seeding Enterprise Phase 3 Verification Data...");

        const password = await bcrypt.hash('password123', 10);

        // 1. Create a Vendor
        const vendor = await prisma.user.upsert({
            where: { email: 'vendor@pts.com' },
            update: {},
            create: {
                email: 'vendor@pts.com',
                password,
                role: 'VENDOR',
                companyName: 'Best Buy Electronics',
            }
        });

        // 2. Create a Police Admin
        const police = await prisma.user.upsert({
            where: { email: 'admin@pts.gov' },
            update: {},
            create: {
                email: 'admin@pts.gov',
                password,
                role: 'POLICE',
                companyName: 'National Police Agency',
            }
        });

        console.log('✅ Vendor and Police accounts verified.');

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

seedVerification();
