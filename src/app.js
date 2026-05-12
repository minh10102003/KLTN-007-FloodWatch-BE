const express = require('express');
const cors = require('cors');
const swaggerSetup = require('./config/swagger');
const floodRoutes = require('./routes/floodRoutes');
const fusionRoutes = require('./routes/fusionRoutes');
const forecastRoutes = require('./routes/forecastRoutes');
const routingRoutes = require('./routes/routingRoutes');
const weatherRoutes = require('./routes/weatherRoutes');
const deviceHealthRoutes = require('./routes/deviceHealthRoutes');
const emergencyAlertAdminRoutes = require('./routes/emergencyAlertAdminRoutes');
const telegramRoutes = require('./routes/telegramRoutes');
const researchRoutes = require('./routes/researchRoutes');
const crowdReportRoutes = require('./routes/crowdReportRoutes');
const sensorRoutes = require('./routes/sensorRoutes');
const authRoutes = require('./routes/authRoutes');
const alertRoutes = require('./routes/alertRoutes');
const reportModerationRoutes = require('./routes/reportModerationRoutes');
const reportEvaluationRoutes = require('./routes/reportEvaluationRoutes');
const emergencySubscriptionRoutes = require('./routes/emergencySubscriptionRoutes');
const heatmapRoutes = require('./routes/heatmapRoutes');
const otaRoutes = require('./routes/otaRoutes');
const energyRoutes = require('./routes/energyRoutes');
const statsRoutes = require('./routes/statsRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const auditLogRoutes = require('./routes/auditLogRoutes');
const accessLogMiddleware = require('./middleware/accessLogMiddleware');
const googleAuthRoutes = require('./routes/googleAuthRoutes');
const geocodeRoutes = require('./routes/geocodeRoutes');
const path = require('path');

const app = express();

// Trust reverse proxy headers on Railway by default.
if (process.env.TRUST_PROXY !== 'false') {
    app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1) || 1);
}

function parseCsv(raw) {
    if (!raw || typeof raw !== 'string') return [];
    return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

function isAllowedBySuffix(origin, suffixes) {
    try {
        const host = new URL(origin).hostname.toLowerCase();
        return suffixes.some((suffix) => {
            const s = String(suffix || '').toLowerCase();
            if (!s) return false;
            if (s.startsWith('.')) return host.endsWith(s);
            return host === s || host.endsWith(`.${s}`);
        });
    } catch {
        return false;
    }
}

const allowedOrigins = parseCsv(process.env.CORS_ALLOWED_ORIGINS);
const allowedOriginSuffixes = parseCsv(process.env.CORS_ALLOWED_ORIGIN_SUFFIXES);
const defaultDevOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
];
const defaultProdOrigins = [
    'https://floodsight.id.vn',
    'https://www.floodsight.id.vn',
    'https://admin.floodsight.id.vn',
    'https://floodlight.id.vn',
    'https://www.floodlight.id.vn'
];
const finalAllowedOrigins = new Set([
    ...defaultDevOrigins,
    ...defaultProdOrigins,
    ...allowedOrigins
]);
const finalAllowedSuffixes = ['.vercel.app', ...allowedOriginSuffixes];

const corsOptions = {
    origin(origin, callback) {
        // Non-browser clients (curl/postman) may not send Origin header.
        if (!origin) return callback(null, true);
        if (finalAllowedOrigins.has(origin)) return callback(null, true);
        if (isAllowedBySuffix(origin, finalAllowedSuffixes)) return callback(null, true);
        return callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    optionsSuccessStatus: 204
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Swagger Documentation
swaggerSetup(app);

// Track API access for monthly stats
app.use('/api', accessLogMiddleware);

const { apiAccess } = require('./middleware/apiAccess');

// ==========================================
// 1. PUBLIC BLOCK (No token required)
// ==========================================
app.use('/api/auth', authRoutes);
app.use('/api', telegramRoutes);
app.use('/api/v1/auth', googleAuthRoutes);
app.use('/api/v1/geocode', geocodeRoutes);

// ==========================================
// 2. GLOBAL API ACCESS (đọc công khai / optional Bearer → apiAccess)
// ==========================================
app.use('/api', apiAccess);

// ==========================================
// 3. PROTECTED BLOCK (Token required)
// ==========================================
app.use('/api', floodRoutes);
app.use('/api', fusionRoutes);
app.use('/api', forecastRoutes);
app.use('/api', routingRoutes);
app.use('/api', weatherRoutes);
app.use('/api', deviceHealthRoutes);
app.use('/api', emergencyAlertAdminRoutes);
app.use('/api', researchRoutes);
app.use('/api', crowdReportRoutes);
app.use('/api', auditLogRoutes);
app.use('/api/sensors', sensorRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/reports', reportModerationRoutes);
app.use('/api/report-evaluations', reportEvaluationRoutes);
app.use('/api/emergency-subscriptions', emergencySubscriptionRoutes);
app.use('/api/heatmap', heatmapRoutes);
app.use('/api/ota', otaRoutes);
app.use('/api/energy', energyRoutes);
app.use('/api', statsRoutes);
app.use('/api', uploadRoutes);

module.exports = app;
