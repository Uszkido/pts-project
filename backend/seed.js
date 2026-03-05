const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
    const hashedPassword = await bcrypt.hash('password123', 10);
    const user = await prisma.user.upsert({
        where: { email: 'vendor@pts.com' },
        update: {},
        create: {
            email: 'vendor@pts.com',
            password: hashedPassword,
            companyName: 'Lagos Tech Hub Vendor'
        }
    });
    console.log('Test vendor created:', user.email);

    const policeUser = await prisma.user.upsert({
        where: { email: 'police@pts.com' },
        update: {},
        create: {
            email: 'police@pts.com',
            password: hashedPassword,
            role: 'POLICE',
            companyName: 'Lagos State Police Command'
        }
    });
    console.log('Test police created:', policeUser.email);
}
main().catch(console.error).finally(() => prisma.$disconnect());
