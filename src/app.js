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
const reportSummaryRoutes = require('./routes/reportSummaryRoutes');
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
const newsRoutes = require('./routes/newsRoutes');
const chatRoutes = require('./routes/chatRoutes');
const path = require('path');
const { createCorsOriginCallback } = require('./config/corsAllowedOrigins');
const { emitAdminNotification } = require('./socket/adminSocket');
const { authenticate, requireAdminOrModerator } = require('./middleware/auth');

const app = express();

// Trust reverse proxy headers on Render (reverse proxy) by default.
if (process.env.TRUST_PROXY !== 'false') {
    app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1) || 1);
}

const corsOptions = {
    origin: createCorsOriginCallback(),
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
app.use('/api/news', newsRoutes);
app.use('/api/v1/news', newsRoutes);
app.use('/api', weatherRoutes);
app.use('/api', chatRoutes);

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
app.use('/api', deviceHealthRoutes);
app.use('/api', emergencyAlertAdminRoutes);
app.use('/api', researchRoutes);
app.use('/api', crowdReportRoutes);
app.use('/api', auditLogRoutes);
app.use('/api/sensors', sensorRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/reports', reportSummaryRoutes);
app.use('/api/reports', reportModerationRoutes);
/** Alias cho Admin FE (hcm-flood-admin): /api/admin/reports/... */
app.use('/api/admin/reports', reportSummaryRoutes);
app.use('/api/admin/reports', reportModerationRoutes);
app.use('/api/report-evaluations', reportEvaluationRoutes);
app.use('/api/emergency-subscriptions', emergencySubscriptionRoutes);
app.use('/api/heatmap', heatmapRoutes);
app.use('/api/ota', otaRoutes);
app.use('/api/energy', energyRoutes);
app.use('/api', statsRoutes);
app.use('/api', uploadRoutes);

if (process.env.SOCKET_DEV_TEST_ROUTE === 'true') {
    app.post(
        '/api/dev/test-notification',
        authenticate,
        requireAdminOrModerator,
        (req, res) => {
            const { type, reportId, sensorId } = req.body || {};
            emitAdminNotification({
                type: type || 'report_pending',
                reportId: reportId != null ? Number(reportId) : 1,
                sensorId
            });
            res.json({ ok: true });
        }
    );
}

module.exports = app;
