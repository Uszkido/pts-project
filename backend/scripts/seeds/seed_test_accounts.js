const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);

    const accounts = [
        {
            email: 'admin@pts.ng',
            password: hashedPassword,
            role: 'ADMIN',
            status: 'ACTIVE',
            fullName: 'Chief Administrator',
            isEmailConfirmed: true
        },
        {
            email: 'vendor@pts.ng',
            password: hashedPassword,
            role: 'VENDOR',
            status: 'ACTIVE',
            vendorStatus: 'APPROVED',
            fullName: 'Authorized Vendor',
            companyName: 'PTS Test Hub',
            isEmailConfirmed: true
        },
        {
            email: 'consumer@pts.ng',
            password: hashedPassword,
            role: 'CONSUMER',
            status: 'ACTIVE',
            fullName: 'John Consumer',
            isEmailConfirmed: true
        },
        {
            email: 'police@pts.ng',
            password: hashedPassword,
            role: 'POLICE',
            status: 'ACTIVE',
            fullName: 'Officer Inspector',
            isEmailConfirmed: true
        }
    ];

    console.log('--- Seeding Test Accounts ---');
    for (const account of accounts) {
        const user = await prisma.user.upsert({
            where: { email: account.email },
            update: {},
            create: account
        });
        console.log(`Created/Ensured: ${user.email} (Role: ${user.role})`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
