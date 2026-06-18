require('dotenv').config();
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const express = require('express');
const cors = require('cors');
const path = require('path');
const logger = require('../src_backend/utils/logger');
const errorHandler = require('../src_backend/middleware/errorHandler');

// ─── Global Error Guards ────────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
    logger.error('UNCAUGHT EXCEPTION — shutting down:', err.message, err.stack);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    logger.error('UNHANDLED REJECTION:', reason);
});

const app = express();

app.use(helmet());

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// ─── Core Middleware ─────────────────────────────────────────────────────────
// Restrict CORS to known origins in production
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3000', 'http://localhost:5173'];

app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? allowedOrigins : '*',
    credentials: true,
}));

// Limit payload size to a reasonable amount to prevent DoS
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Database Client ─────────────────────────────────────────────────────────
let prisma;
try {
    prisma = require(path.join(__dirname, '..', 'src_backend', 'db'));
    logger.info('Database client initialized');
} catch (e) {
    logger.error('db.js failed to load:', e.message);
}

// ─── Safe Route Loader ───────────────────────────────────────────────────────
const loadedRoutes = [];

function safeUse(apiPath, routeFile) {
    try {
        const fullPath = path.join(__dirname, '..', 'src_backend', 'routes', routeFile);
        const route = require(fullPath);
        app.use(apiPath, route);
        loadedRoutes.push({ path: apiPath, status: 'ok' });
    } catch (e) {
        logger.error(`Route load failed [${routeFile}]:`, e.message);
        loadedRoutes.push({ path: apiPath, status: 'failed', error: e.message });
        const fallback = express.Router();
        fallback.all('*', (_req, res) => res.status(503).json({
            error: 'Module offline',
            module: routeFile,
        }));
        app.use(apiPath, fallback);
    }
}

// ─── Routes ──────────────────────────────────────────────────────────────────
const routes = [
    { path: '/api/v1/auth',        file: 'auth' },
    { path: '/api/v1/devices',     file: 'devices' },
    { path: '/api/v1/police',      file: 'police' },
    { path: '/api/v1/consumers',   file: 'consumers' },
    { path: '/api/v1/transfers',   file: 'transfers' },
    { path: '/api/v1/public',      file: 'public' },
    { path: '/api/v1/admin',       file: 'admin' },
    { path: '/api/v1/registry',    file: 'registry' },
    { path: '/api/v1/upload',      file: 'upload' },
    { path: '/api/v1/telecom',     file: 'telecom' },
    { path: '/api/v1/ussd',        file: 'ussd' },
    { path: '/api/v1/ai',          file: 'ai' },
    { path: '/api/v1/analytics',   file: 'analytics' },
    { path: '/api/v1/api-keys',    file: 'apiKeys' },
    { path: '/api/v1/guardian',    file: 'guardian' },
    { path: '/api/v1/incidents',   file: 'incidents' },
    { path: '/api/v1/maintenance', file: 'maintenance' },
    { path: '/api/v1/passports',   file: 'passports' },
    { path: '/api/v1/payments',    file: 'payments' },
    { path: '/api/v1/swap',        file: 'swap' },
    { path: '/api/v1/telegram',    file: 'telegram' },
    { path: '/api/v1/tracking',    file: 'tracking' },
    { path: '/api/v1/vendors',     file: 'vendors' },
    { path: '/api/v1/whatsapp',    file: 'whatsapp' },
];

routes.forEach(({ path: apiPath, file }) => safeUse(apiPath, file));

// ─── Health Check ─────────────────────────────────────────────────────────────
// NOTE: This endpoint is public. Do NOT include admin credentials or secrets here.
// Use a separate secure admin CLI or migration script for account provisioning.
app.get('/health', async (_req, res) => {
    let dbStatus = 'disconnected';
    let dbMsg = 'Database not initialized';

    try {
        if (prisma) {
            await prisma.$queryRaw`SELECT 1`;
            dbStatus = 'connected';
            dbMsg = 'PTS API is operational';
        }
    } catch (err) {
        dbStatus = 'offline';
        dbMsg = err.message;
    }

    res.json({
        status: dbStatus === 'connected' ? 'ok' : 'degraded',
        version: process.env.npm_package_version || '1.9.0',
        database: dbStatus,
        message: dbMsg,
        routes: loadedRoutes,
    });
});

app.get('/api/v1', (_req, res) => {
    res.json({ status: 'ok', message: 'PTS API v1 Operational' });
});

app.get('/', (_req, res) => {
    res.send('PTS API Gateway. See /health for status.');
});

// ─── Error Handler (must be last) ────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;

