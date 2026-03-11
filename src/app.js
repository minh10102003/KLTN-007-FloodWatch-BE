const express = require('express');
const cors = require('cors');
const swaggerSetup = require('./config/swagger');
const floodRoutes = require('./routes/floodRoutes');
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
const path = require('path');

const app = express();

// Middleware
app.use(cors()); // Cho phép FE và BE chạy trên các cổng khác nhau
app.use(express.json()); // Cho phép Backend đọc dữ liệu JSON từ trình duyệt gửi lên
app.use(express.static('public')); // Cấu hình để phục vụ file tĩnh từ thư mục public
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'))); // Ảnh báo cáo (upload)

// Swagger Documentation
swaggerSetup(app);

// Ghi lượt truy cập mỗi request tới /api (để thống kê hàng tháng)
app.use('/api', accessLogMiddleware);

// Routes
app.use('/api', floodRoutes);
app.use('/api', crowdReportRoutes);
app.use('/api', sensorRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/reports', reportModerationRoutes);
app.use('/api/report-evaluations', reportEvaluationRoutes);
app.use('/api/emergency-subscriptions', emergencySubscriptionRoutes);
app.use('/api/heatmap', heatmapRoutes);
app.use('/api/ota', otaRoutes);
app.use('/api/energy', energyRoutes);
app.use('/api', statsRoutes);
app.use('/api', uploadRoutes);
app.use('/api', auditLogRoutes);

module.exports = app;






