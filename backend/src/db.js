const { PrismaClient } = require('@prisma/client');

let prisma;

if (process.env.NODE_ENV === 'production') {
    try {
        prisma = new PrismaClient();
    } catch (e) {
        console.error('❌ Prisma Initialization Error:', e.message);
        prisma = createOfflineProxy();
    }
} else {
    if (!global.prisma) {
        try {
            global.prisma = new PrismaClient();
        } catch (e) {
            console.error('❌ Prisma Dev Init Error:', e.message);
            global.prisma = createOfflineProxy();
        }
    }
    prisma = global.prisma;
}

function createOfflineProxy() {
    return new Proxy({}, {
        get: (target, prop) => {
            if (prop === '$queryRaw') return async () => { throw new Error('PTS_DB_OFFLINE: Global Registry currently unreachable.'); };
            if (prop === 'then') return undefined; // Handle async/await checks 

            // Return a nested proxy for table access like prisma.user.findUnique
            return new Proxy(() => { }, {
                get: () => {
                    return async () => { throw new Error('PTS_DB_OFFLINE: Database service is currently unavailable.'); };
                },
                apply: () => {
                    return async () => { throw new Error('PTS_DB_OFFLINE: Database service is currently unavailable.'); };
                }
            });
        }
    });
}

module.exports = prisma;
