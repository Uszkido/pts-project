require('dotenv').config();

// Global Crash Handlers for Vercel Stability
process.on('uncaughtException', (err) => console.error('🔥 UNCAUGHT:', err.message, err.stack));
process.on('unhandledRejection', (reason) => console.error('🌊 UNHANDLED:', reason));

const express = require('express');
const cors = require('cors');
// const { initTelegramOracle } = require('./src/services/telegramOracle'); // Moved below for better safety in production
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
const whatsappRoutes = require('./src/routes/whatsapp');
const telegramRoutes = require('./src/routes/telegram');
const trackingRoutes = require('./src/routes/tracking');
const apiKeysRoutes = require('./src/routes/apiKeys');
const paymentRoutes = require('./src/routes/payments');

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
app.use('/api/v1/whatsapp', whatsappRoutes);
app.use('/api/v1/telegram', telegramRoutes);
app.use('/api/v1/tracking', trackingRoutes);
app.use('/api/v1/b2b', apiKeysRoutes);
app.use('/api/v1/payments', paymentRoutes);

app.get('/ping', (req, res) => {
    res.json({ status: 'ok', message: 'Pong!' });
});

app.get('/health', async (req, res) => {
    try {
        const prisma = require('./src/db');
        await prisma.$queryRaw`SELECT 1`;
        res.json({ status: 'ok', message: 'PTS Backend and Database are running' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Database connection failed', error: err.message });
    }
});

app.get('/debug-env', (req, res) => {
    res.json({
        envKeys: Object.keys(process.env),
        telegramTokenLength: process.env.TELEGRAM_BOT_TOKEN ? process.env.TELEGRAM_BOT_TOKEN.length : 0,
        nodeEnv: process.env.NODE_ENV
    });
});

// Initialize Telegram Oracle in ALL environments.
// In production (Vercel), it runs in webhook mode (no polling).
// In dev, it runs with polling.
try {
    const { initTelegramOracle } = require('./src/services/telegramOracle');
    initTelegramOracle();
} catch (e) {
    console.warn('⚠️ Skipping Telegram Oracle startup:', e.message);
}

// Start the HTTP server only in local development (not on Vercel).
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}


// ─── NEON DATABASE KEEP-ALIVE ────────────────────────────────────────────────
// Neon free-tier suspends after 5 minutes of inactivity.
// This silent ping runs every 4 minutes to keep the connection warm.
if (process.env.NODE_ENV === 'production') {
    const prisma = require('./src/db');
    setInterval(async () => {
        try {
            await prisma.$queryRaw`SELECT 1`;
            console.log('💓 DB Keep-Alive Ping: OK');
        } catch (e) {
            console.warn('⚠️ DB Keep-Alive failed:', e.message);
        }
    }, 4 * 60 * 1000); // Every 4 minutes
}

module.exports = app;

// Trigger redeploy sync