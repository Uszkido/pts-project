const prisma = require('./api/src_backend/db');

async function check() {
    try {
        const userCount = await prisma.user.count();
        const deviceCount = await prisma.device.count();
        console.log(`📊 DB STATUS [pts-backend-api]:`);
        console.log(`- Users: ${userCount}`);
        console.log(`- Devices: ${deviceCount}`);

        const admin = await prisma.user.findFirst({ where: { email: 'admin@pts.ng' } });
        if (admin) {
            console.log(`✅ Admin found: ${admin.email}, Role: ${admin.role}, isAdmin: ${admin.isAdmin}`);
        } else {
            console.log(`❌ Admin admin@pts.ng NOT FOUND!`);
        }
    } catch (e) {
        console.error('❌ DB Check failed:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

check();
