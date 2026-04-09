const { PrismaClient } = require('@prisma/client');

let prisma;

if (process.env.NODE_ENV === 'production') {
    try {
        prisma = new PrismaClient();
    } catch (e) {
        console.error('❌ Prisma Initialization Failed:', e.message);
        // Provide a mock object with $queryRaw to prevent total crash
        prisma = { $queryRaw: async () => { throw new Error('Database Client Offline'); } };
    }
} else {
    if (!global.prisma) {
        try {
            global.prisma = new PrismaClient();
        } catch (e) {
            console.error('❌ Prisma Dev Init Failed:', e.message);
            global.prisma = { $queryRaw: async () => { throw new Error('Database Client Offline'); } };
        }
    }
    prisma = global.prisma;
}

module.exports = prisma;
