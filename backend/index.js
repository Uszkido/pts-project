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
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// STAGE 1: Only safe, lightweight routes (no native deps)
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
        r.all('*', (req, res) => res.status(503).json({ error: `Module offline`, module: routeFile, details: e.message }));
        app.use(path, r);
    }
}

// Load db
let prisma;
try {
    prisma = require('./src/db');
} catch (e) {
    console.error('❌ db.js failed:', e.message);
    prisma = null;
}

// Routes — loaded one by one
safeUse('/api/v1/auth', './src/routes/auth');
safeUse('/api/v1/devices', './src/routes/devices');
safeUse('/api/v1/police', './src/routes/police');
safeUse('/api/v1/consumers', './src/routes/consumers');
safeUse('/api/v1/transfers', './src/routes/transfers');
safeUse('/api/v1/telecom', './src/routes/telecom');
safeUse('/api/v1/incidents', './src/routes/incidents');
safeUse('/api/v1/vendors', './src/routes/vendors');
safeUse('/api/v1/registry', './src/routes/registry');
safeUse('/api/v1/passports', './src/routes/passports');
safeUse('/api/v1/upload', './src/routes/upload');
safeUse('/api/v1/admin', './src/routes/admin');
safeUse('/api/v1/maintenance', './src/routes/maintenance');
safeUse('/api/v1/public', './src/routes/public');
safeUse('/api/v1/swap', './src/routes/swap');
safeUse('/api/v1/guardian', './src/routes/guardian');
safeUse('/api/v1/ai', './src/routes/ai');
safeUse('/api/v1/ai-public', './src/routes/ai_public');
safeUse('/api/v1/whatsapp', './src/routes/whatsapp');
safeUse('/api/v1/telegram', './src/routes/telegram');
safeUse('/api/v1/tracking', './src/routes/tracking');
safeUse('/api/v1/b2b', './src/routes/apiKeys');
safeUse('/api/v1/payments', './src/routes/payments');
safeUse('/api/v1/analytics', './src/routes/analytics');
safeUse('/api/v1/ussd', './src/routes/ussd');

// Health endpoints
app.get('/ping', (req, res) => {
    res.json({ status: 'ok', message: 'Pong!', time: new Date() });
});

app.get('/health', async (req, res) => {
    let dbStatus = 'unknown';
    let dbError = null;
    try {
        if (prisma) {
            await prisma.$queryRaw`SELECT 1`;
            dbStatus = 'connected';
        } else {
            dbStatus = 'offline';
            dbError = 'db.js failed to load';
        }
    } catch (err) {
        dbStatus = 'offline';
        dbError = err.message;
    }
    res.status(200).json({
        status: dbStatus === 'connected' ? 'ok' : 'degraded',
        database: dbStatus,
        routes: loadedRoutes,
        message: dbStatus === 'connected' ? 'PTS Sentinel is fully operational' : 'API is up but database is unreachable',
        error: dbError
    });
});

app.get('/debug-env', (req, res) => {
    res.json({
        nodeEnv: process.env.NODE_ENV,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        hasDirectUrl: !!process.env.DIRECT_URL,
        hasTelegram: !!process.env.TELEGRAM_BOT_TOKEN,
        hasGemini: !!process.env.GEMINI_API_KEY
    });
});

// Lazy telegram init
let telegramInitialized = false;
app.use((req, res, next) => {
    if (!telegramInitialized && process.env.TELEGRAM_BOT_TOKEN) {
        try {
            const { initTelegramOracle } = require('./src/services/telegramOracle');
            initTelegramOracle();
            telegramInitialized = true;
        } catch (e) {
            console.warn('⚠️ Telegram Oracle delayed:', e.message);
        }
    }
    next();
});

app.listen(PORT, () => console.log(`✅ PTS Sentinel running on port ${PORT}`));

module.exports = app;