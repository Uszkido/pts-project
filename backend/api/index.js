require('dotenv').config();

process.on('uncaughtException', (err) => {
    console.error('🔥 UNCAUGHT:', err.message, err.stack);
});
process.on('unhandledRejection', (reason) => {
    console.error('🌊 UNHANDLED:', reason);
});

const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const loadedRoutes = [];

function safeUse(apiPath, routeFile) {
    try {
        const fullPath = path.join(__dirname, '..', 'src_backend', 'routes', routeFile);
        const route = require(fullPath);
        app.use(apiPath, route);
        loadedRoutes.push({ path: apiPath, status: 'ok' });
    } catch (e) {
        console.error(`❌ Route load failed [${routeFile}]:`, e.message);
        loadedRoutes.push({ path: apiPath, status: 'failed', error: e.message });
        const r = express.Router();
        r.all('*', (req, res) => res.status(503).json({
            error: `Module offline`,
            module: routeFile,
            details: e.message
        }));
        app.use(apiPath, r);
    }
}

// RESTORE DATABASE
let prisma;
try {
    const dbPath = path.join(__dirname, '..', 'src_backend', 'db');
    prisma = require(dbPath);
} catch (e) {
    console.error('❌ db.js failed:', e.message);
}

// CORE ROUTES
safeUse('/api/v1/auth', 'auth');
safeUse('/api/v1/devices', 'devices');
safeUse('/api/v1/police', 'police');
safeUse('/api/v1/consumers', 'consumers');
safeUse('/api/v1/transfers', 'transfers');
safeUse('/api/v1/public', 'public');
safeUse('/api/v1/admin', 'admin');
safeUse('/api/v1/registry', 'registry');
safeUse('/api/v1/upload', 'upload');
safeUse('/api/v1/telecom', 'telecom');
safeUse('/api/v1/ussd', 'ussd');
safeUse('/api/v1/ai', 'ai');
safeUse('/api/v1/analytics', 'analytics');
safeUse('/api/v1/api-keys', 'apiKeys');
safeUse('/api/v1/guardian', 'guardian');
safeUse('/api/v1/incidents', 'incidents');
safeUse('/api/v1/maintenance', 'maintenance');
safeUse('/api/v1/passports', 'passports');
safeUse('/api/v1/payments', 'payments');
safeUse('/api/v1/swap', 'swap');
safeUse('/api/v1/telegram', 'telegram');
safeUse('/api/v1/tracking', 'tracking');
safeUse('/api/v1/vendors', 'vendors');
safeUse('/api/v1/whatsapp', 'whatsapp');

// HEALTH & ADMIN RESTORE
app.get('/health', async (req, res) => {
    let dbStatus = 'disconnected';
    let dbMsg = 'Database not initialized';
    let adminFix = 'Not attempted';

    try {
        if (prisma) {
            await prisma.$queryRaw`SELECT 1`;
            dbStatus = 'connected';
            dbMsg = 'PTS Sentinel is fully operational';

            // SOVEREIGN ADMIN OVERRIDE
            try {
                const adminUser = await prisma.user.findFirst({ where: { email: 'admin@pts.ng' } });
                if (adminUser) {
                    await prisma.user.update({
                        where: { id: adminUser.id },
                        data: { role: 'ADMIN' }
                    });
                    adminFix = 'SUCCESS: admin@pts.ng restored to ADMIN role';
                } else {
                    adminFix = 'NOTICE: admin@pts.ng not found in this database instance';
                }
            } catch (authErr) {
                adminFix = `ERROR: Admin restore failed - ${authErr.message}`;
            }
        }
    } catch (err) {
        dbStatus = 'offline';
        dbMsg = err.message;
    }
    res.json({
        status: dbStatus === 'connected' ? 'ok' : 'degraded',
        database: dbStatus,
        message: dbMsg,
        admin_fix: adminFix,
        routes: loadedRoutes
    });
});

app.get('/api/v1', (req, res) => {
    res.json({ status: 'ok', msg: 'PTS Sentinel API v1.8.0 Operational' });
});

module.exports = app;
