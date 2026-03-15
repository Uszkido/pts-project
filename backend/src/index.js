require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initTelegramOracle } = require('./services/telegramOracle'); // Import AI Bot Initializer
const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/devices');
const policeRoutes = require('./routes/police');
const consumerRoutes = require('./routes/consumers');
const transferRoutes = require('./routes/transfers');
const telecomRoutes = require('./routes/telecom');
const incidentRoutes = require('./routes/incidents');
const vendorRoutes = require('./routes/vendors');
const registryRoutes = require('./routes/registry');
const passportRoutes = require('./routes/passports');
const uploadRoutes = require('./routes/upload');
const adminRoutes = require('./routes/admin');
const maintenanceRoutes = require('./routes/maintenance');
const publicRoutes = require('./routes/public');
const swapRoutes = require('./routes/swap');
const guardianRoutes = require('./routes/guardian');
const aiRoutes = require('./routes/ai');
const whatsappRoutes = require('./routes/whatsapp');
const telegramRoutes = require('./routes/telegram');

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

app.get('/health', async (req, res) => {
    try {
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
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

// Initialize AI and Telegram polling
initTelegramOracle();

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

module.exports = app;

// Trigger redeploy sync