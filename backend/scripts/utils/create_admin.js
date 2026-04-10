const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

(async () => {
    const pw = await bcrypt.hash('admin123', 10);
    const user = await prisma.user.create({
        data: {
            email: 'admin@pts.gov',
            password: pw,
            role: 'ADMIN',
            fullName: 'System Administrator',
            vendorStatus: 'APPROVED'
        }
    });
    console.log('Admin created:', user.email, user.id);
    await prisma.$disconnect();
})();
