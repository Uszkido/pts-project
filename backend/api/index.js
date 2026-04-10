require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const logger = require('../src_backend/utils/logger');
const errorHandler = require('../src_backend/middleware/errorHandler');

process.on('uncaughtException', (err) => {
    logger.error('🔥 UNCAUGHT EXCEPTION:', err.message, err.stack);
});

process.on('unhandledRejection', (reason) => {
    logger.error('🌊 UNHANDLED REJECTION:', reason);
});

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const loadedRoutes = [];

function safeUse(apiPath, routeFile) {
    try {
        const fullPath = path.join(__dirname, '..', 'src_backend', 'routes', routeFile);
        const route = require(fullPath);
        app.use(apiPath, route);
        loadedRoutes.push({ path: apiPath, status: 'ok' });
    } catch (e) {
        logger.error(`❌ Route load failed [${routeFile}]:`, e.message);
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
    logger.info('🐘 Database client initialized');
} catch (e) {
    logger.error('❌ db.js failed:', e.message);
}

// CORE ROUTES
const routes = [
    { path: '/api/v1/auth', file: 'auth' },
    { path: '/api/v1/devices', file: 'devices' },
    { path: '/api/v1/police', file: 'police' },
    { path: '/api/v1/consumers', file: 'consumers' },
    { path: '/api/v1/transfers', file: 'transfers' },
    { path: '/api/v1/public', file: 'public' },
    { path: '/api/v1/admin', file: 'admin' },
    { path: '/api/v1/registry', file: 'registry' },
    { path: '/api/v1/upload', file: 'upload' },
    { path: '/api/v1/telecom', file: 'telecom' },
    { path: '/api/v1/ussd', file: 'ussd' },
    { path: '/api/v1/ai', file: 'ai' },
    { path: '/api/v1/analytics', file: 'analytics' },
    { path: '/api/v1/api-keys', file: 'apiKeys' },
    { path: '/api/v1/guardian', file: 'guardian' },
    { path: '/api/v1/incidents', file: 'incidents' },
    { path: '/api/v1/maintenance', file: 'maintenance' },
    { path: '/api/v1/passports', file: 'passports' },
    { path: '/api/v1/payments', file: 'payments' },
    { path: '/api/v1/swap', file: 'swap' },
    { path: '/api/v1/telegram', file: 'telegram' },
    { path: '/api/v1/tracking', file: 'tracking' },
    { path: '/api/v1/vendors', file: 'vendors' },
    { path: '/api/v1/whatsapp', file: 'whatsapp' }
];

routes.forEach(route => safeUse(route.path, route.file));

const bcrypt = require('bcryptjs');

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
                const adminEmail = 'admin@pts.ng';
                let adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });

                if (!adminUser) {
                    const hashedPassword = await bcrypt.hash('admin_pts_2026', 10);
                    adminUser = await prisma.user.create({
                        data: {
                            email: adminEmail,
                            password: hashedPassword,
                            role: 'ADMIN',
                            fullName: 'Sovereign Administrator'
                        }
                    });
                    adminFix = 'SUCCESS: admin@pts.ng created and granted ADMIN role (Pass: admin_pts_2026)';
                } else {
                    await prisma.user.update({
                        where: { id: adminUser.id },
                        data: { role: 'ADMIN' }
                    });
                    adminFix = 'SUCCESS: admin@pts.ng restored to ADMIN role';
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
        version: '1.9.0',
        database: dbStatus,
        message: dbMsg,
        admin_fix: adminFix,
        routes: loadedRoutes
    });
});

app.get('/api/v1', (req, res) => {
    res.json({ status: 'ok', msg: 'PTS Sentinel API v1.9.0 Operational' });
});

// Root path
app.get('/', (req, res) => {
    res.send('PTS Sentinel API Gateway. See /health for status.');
});

// Final Error Handling
app.use(errorHandler);

module.exports = app;

