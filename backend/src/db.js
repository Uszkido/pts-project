let prisma;

function createOfflineProxy() {
    return new Proxy({}, {
        get: (target, prop) => {
            if (prop === '$queryRaw') return async () => { throw new Error('PTS_DB_OFFLINE: Global Registry currently unreachable.'); };
            if (prop === 'then') return undefined; // prevent accidental await

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

try {
    const { PrismaClient } = require('@prisma/client');

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
} catch (e) {
    // @prisma/client itself failed to load (binary mismatch, missing generation, etc.)
    console.error('❌ @prisma/client could not be loaded:', e.message);
    prisma = createOfflineProxy();
}

module.exports = prisma;
