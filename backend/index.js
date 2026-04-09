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

// 🛑 DB DISABLED FOR ISOLATION
let prisma = null;

// STAGE 1 RE-ENABLE (WITHOUT DB)
safeUse('/api/v1/auth', './src/routes/auth');
safeUse('/api/v1/devices', './src/routes/devices');
safeUse('/api/v1/police', './src/routes/police');
safeUse('/api/v1/consumers', './src/routes/consumers');
safeUse('/api/v1/transfers', './src/routes/transfers');

// Health endpoints
app.get('/health', async (req, res) => {
    res.status(200).json({ status: 'ok', routes: loadedRoutes, db: 'disabled' });
});

app.listen(PORT, () => console.log(`✅ Stage 1 (No DB) running on port ${PORT}`));

module.exports = app;