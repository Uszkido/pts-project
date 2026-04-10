const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        select: {
            email: true,
            role: true,
            vendorStatus: true
        }
    });

    console.log('--- Database Users ---');
    if (users.length === 0) {
        console.log('No users found. Database is empty.');
    } else {
        users.forEach(u => {
            console.log(`Email: ${u.email} | Role: ${u.role} | Status: ${u.vendorStatus}`);
        });
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
