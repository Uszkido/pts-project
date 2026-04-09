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

// AUDIT ENV VARS
const auditEnv = () => {
    const keys = [
        'DATABASE_URL', 'JWT_SECRET',
        'CLOUDINARY_URL', 'CLOUDINARY_CLOUD_NAME',
        'PAYSTACK_SECRET_KEY', 'TELEGRAM_BOT_TOKEN',
        'GOOGLE_API_KEY', 'MONO_SECRET_KEY', 'EMAIL_USER'
    ];
    const report = {};
    keys.forEach(k => {
        report[k] = process.env[k] ? 'PRESENT' : 'MISSING';
    });
    return report;
};

// BASE HANDLER
app.get('/api/v1', (req, res) => {
    res.json({
        status: 'ok',
        message: 'PTS Sentinel API v1.7.9 is operational',
        env_audit: auditEnv(),
        endpoints: loadedRoutes.map(r => r.path)
    });
});

// HEALTH
app.get('/health', async (req, res) => {
    let dbStatus = 'disconnected';
    let dbMsg = 'Database not initialized';
    try {
        if (prisma) {
            await prisma.$queryRaw`SELECT 1`;
            dbStatus = 'connected';
            dbMsg = 'PTS Sentinel is fully operational';
        }
    } catch (err) {
        dbStatus = 'offline';
        dbMsg = err.message;
    }
    res.json({
        status: dbStatus === 'connected' ? 'ok' : 'degraded',
        database: dbStatus,
        message: dbMsg,
        env: auditEnv(),
        routes: loadedRoutes
    });
});

module.exports = app;
