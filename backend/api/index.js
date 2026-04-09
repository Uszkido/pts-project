require('dotenv').config();

process.on('uncaughtException', (err) => {
    console.error('🔥 UNCAUGHT:', err.message, err.stack);
});
process.on('unhandledRejection', (reason) => {
    console.error('🌊 UNHANDLED:', reason);
});

const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const loadedRoutes = [];

function safeUse(path, routeFile) {
    try {
        const route = require(routeFile);
        app.use(path, route);
        loadedRoutes.push({ path, status: 'ok' });
    } catch (e) {
        console.error(`❌ Route load failed [${routeFile}]:`, e.message);
        loadedRoutes.push({ path, status: 'failed', error: e.message });
        const r = express.Router();
        r.all('*', (req, res) => res.status(503).json({
            error: `Module offline`,
            module: routeFile,
            details: e.message
        }));
        app.use(path, r);
    }
}

// RESTORE DATABASE (Safe Load)
let prisma;
try {
    // Note: Since we are in api/index.js, src is at ../src
    prisma = require('../src/db');
} catch (e) {
    console.error('❌ db.js failed:', e.message);
}

// CORE ROUTES (Fixed Paths)
safeUse('/api/v1/auth', '../src/routes/auth');
safeUse('/api/v1/devices', '../src/routes/devices');
safeUse('/api/v1/police', '../src/routes/police');
safeUse('/api/v1/consumers', '../src/routes/consumers');
safeUse('/api/v1/transfers', '../src/routes/transfers');
safeUse('/api/v1/public', '../src/routes/public');
safeUse('/api/v1/admin', '../src/routes/admin');
safeUse('/api/v1/registry', '../src/routes/registry');
safeUse('/api/v1/upload', '../src/routes/upload');
safeUse('/api/v1/telecom', '../src/routes/telecom');
safeUse('/api/v1/ussd', '../src/routes/ussd');

// BASE HANDLER
app.get('/api/v1', (req, res) => {
    res.json({
        status: 'ok',
        message: 'PTS Sentinel API v1.7.1 is operational',
        endpoints: loadedRoutes.map(r => r.path)
    });
});

// PING
app.get('/ping', (req, res) => {
    res.json({ status: 'ok', msg: 'PTS_SENTINEL_STABLE_PROD_V1' });
});

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
        routes: loadedRoutes
    });
});

module.exports = app;
