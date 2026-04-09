require('dotenv').config();

// Global Crash Handlers for Vercel Stability
process.on('uncaughtException', (err) => {
    console.error('🔥 UNCAUGHT STARTUP ERROR:', err.message, err.stack);
});
process.on('unhandledRejection', (reason) => {
    console.error('🌊 UNHANDLED PROMISE REJECTION:', reason);
});

const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// DATABASE — loaded once as singleton
const prisma = require('./src/db');

// ─── RESILIENT ROUTE LOADER ──────────────────────────────────────────────────
// Wraps each require() so a single broken native module doesn't crash everything
function safeRoute(path) {
    try {
        return require(path);
    } catch (e) {
        console.error(`⚠️ Failed to load route: ${path}`, e.message);
        const router = express.Router();
        router.all('*', (req, res) => res.status(503).json({ error: `Module offline: ${path}`, details: e.message }));
        return router;
    }
}

// ─── ROUTES ──────────────────────────────────────────────────────────────────
app.use('/api/v1/auth', safeRoute('./src/routes/auth'));
app.use('/api/v1/devices', safeRoute('./src/routes/devices'));
app.use('/api/v1/police', safeRoute('./src/routes/police'));
app.use('/api/v1/consumers', safeRoute('./src/routes/consumers'));
app.use('/api/v1/transfers', safeRoute('./src/routes/transfers'));
app.use('/api/v1/telecom', safeRoute('./src/routes/telecom'));
app.use('/api/v1/incidents', safeRoute('./src/routes/incidents'));
app.use('/api/v1/vendors', safeRoute('./src/routes/vendors'));
app.use('/api/v1/registry', safeRoute('./src/routes/registry'));
app.use('/api/v1/passports', safeRoute('./src/routes/passports'));
app.use('/api/v1/upload', safeRoute('./src/routes/upload'));
app.use('/api/v1/admin', safeRoute('./src/routes/admin'));
app.use('/api/v1/maintenance', safeRoute('./src/routes/maintenance'));
app.use('/api/v1/public', safeRoute('./src/routes/public'));
app.use('/api/v1/swap', safeRoute('./src/routes/swap'));
app.use('/api/v1/guardian', safeRoute('./src/routes/guardian'));
app.use('/api/v1/ai', safeRoute('./src/routes/ai'));
app.use('/api/v1/ai-public', safeRoute('./src/routes/ai_public'));
app.use('/api/v1/whatsapp', safeRoute('./src/routes/whatsapp'));
app.use('/api/v1/telegram', safeRoute('./src/routes/telegram'));
app.use('/api/v1/tracking', safeRoute('./src/routes/tracking'));
app.use('/api/v1/b2b', safeRoute('./src/routes/apiKeys'));
app.use('/api/v1/payments', safeRoute('./src/routes/payments'));
app.use('/api/v1/analytics', safeRoute('./src/routes/analytics'));
app.use('/api/v1/ussd', safeRoute('./src/routes/ussd'));

// ─── HEALTH & UTILITY ENDPOINTS ──────────────────────────────────────────────
app.get('/ping', (req, res) => {
    res.json({ status: 'ok', message: 'Pong!', time: new Date() });
});

app.get('/health', async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ status: 'ok', database: 'connected', message: 'PTS Sentinel is fully operational' });
    } catch (err) {
        res.status(200).json({
            status: 'degraded',
            database: 'offline',
            message: 'PTS Backend is up, but Global Registry is currently unreachable.',
            error: err.message
        });
    }
});

app.get('/debug-env', (req, res) => {
    res.json({
        envKeys: Object.keys(process.env),
        nodeEnv: process.env.NODE_ENV,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        hasTelegramToken: !!process.env.TELEGRAM_BOT_TOKEN
    });
});

// ─── LAZY TELEGRAM INIT ───────────────────────────────────────────────────────
let telegramInitialized = false;
app.use((req, res, next) => {
    if (!telegramInitialized && process.env.TELEGRAM_BOT_TOKEN) {
        try {
            const { initTelegramOracle } = require('./src/services/telegramOracle');
            initTelegramOracle();
            telegramInitialized = true;
        } catch (e) {
            console.warn('⚠️ Telegram Oracle initialization delayed:', e.message);
        }
    }
    next();
});

// ─── SERVER ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`✅ PTS Sentinel Backend running on port ${PORT}`);
});

module.exports = app;