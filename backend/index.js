require('dotenv').config();

// Global Crash Handlers for Vercel Stability
process.on('uncaughtException', (err) => {
    console.error('🔥 UNCAUGHT STARTUP ERROR:', err.message, err.stack);
    // On Vercel, we can't do much but log, but let's try to keep going
});
process.on('unhandledRejection', (reason) => {
    console.error('🌊 UNHANDLED PROMISE REJECTION:', reason);
});

const express = require('express');
const cors = require('cors');

// DATABASE (Loaded early to establish fail-safe)
const prisma = require('./src/db');

// ROUTES
const authRoutes = require('./src/routes/auth');
const deviceRoutes = require('./src/routes/devices');
const policeRoutes = require('./src/routes/police');
const consumerRoutes = require('./src/routes/consumers');
const transferRoutes = require('./src/routes/transfers');
const telecomRoutes = require('./src/routes/telecom');
const incidentRoutes = require('./src/routes/incidents');
const vendorRoutes = require('./src/routes/vendors');
const registryRoutes = require('./src/routes/registry');
const passportRoutes = require('./src/routes/passports');
const uploadRoutes = require('./src/routes/upload');
const adminRoutes = require('./src/routes/admin');
const maintenanceRoutes = require('./src/routes/maintenance');
const publicRoutes = require('./src/routes/public');
const swapRoutes = require('./src/routes/swap');
const guardianRoutes = require('./src/routes/guardian');
const aiRoutes = require('./src/routes/ai');
const aiPublicRoutes = require('./src/routes/ai_public');
const whatsappRoutes = require('./src/routes/whatsapp');
const telegramRoutes = require('./src/routes/telegram');
const trackingRoutes = require('./src/routes/tracking');
const apiKeysRoutes = require('./src/routes/apiKeys');
const paymentRoutes = require('./src/routes/payments');
const analyticsRoutes = require('./src/routes/analytics');
const ussdRoutes = require('./src/routes/ussd');

const prisma = require('./src/db');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/devices', deviceRoutes);
app.use('/api/v1/police', policeRoutes);
app.use('/api/v1/consumers', consumerRoutes);
app.use('/api/v1/transfers', transferRoutes);
app.use('/api/v1/telecom', telecomRoutes);
app.use('/api/v1/incidents', incidentRoutes);
app.use('/api/v1/vendors', vendorRoutes);
app.use('/api/v1/registry', registryRoutes);
app.use('/api/v1/passports', passportRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/maintenance', maintenanceRoutes);
app.use('/api/v1/public', publicRoutes);
app.use('/api/v1/swap', swapRoutes);
app.use('/api/v1/guardian', guardianRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/ai-public', aiPublicRoutes);
app.use('/api/v1/whatsapp', whatsappRoutes);
app.use('/api/v1/telegram', telegramRoutes);
app.use('/api/v1/tracking', trackingRoutes);
app.use('/api/v1/b2b', apiKeysRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/ussd', ussdRoutes);

app.get('/ping', (req, res) => {
    res.json({ status: 'ok', message: 'Pong!' });
});

app.get('/health', async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ status: 'ok', database: 'connected', message: 'PTS Sentinel is fully operational' });
    } catch (err) {
        // Return 200 but with a warning status so the frontend shows "Degraded" instead of crashing
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
        telegramTokenLength: process.env.TELEGRAM_BOT_TOKEN ? process.env.TELEGRAM_BOT_TOKEN.length : 0,
        nodeEnv: process.env.NODE_ENV
    });
});

// ─── LAZY INITIALIZATION ─────────────────────────────────────────────────────
// We delay heavy module loading until after the primary app engine is ready.
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

// Start the HTTP server only in local development (not on Vercel).
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}


// ─── NEON DATABASE SETUP ─────────────────────────────────────────────────────
// Note: We use the shared prisma instance from ./src/db to prevent 
// connection pool exhaustion in serverless environments.
if (process.env.NODE_ENV === 'production') {
    console.log('🛡️ PTS Backend initialized in Production Mode');
}

module.exports = app;

// Trigger redeploy sync