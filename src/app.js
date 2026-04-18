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
const path = require('path');

const app = express();

// Railway / reverse proxy: để req.protocol và host đúng (https) khi ghép URL ảnh
if (process.env.TRUST_PROXY !== 'false') {
    app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1) || 1);
}

// Middleware
app.use(cors()); // Cho phép FE và BE chạy trên các cổng khác nhau
app.use(express.json()); // Cho phép Backend đọc dữ liệu JSON từ trình duyệt gửi lên
app.use(express.static('public')); // Cấu hình để phục vụ file tĩnh từ thư mục public
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'))); // Ảnh báo cáo (upload)

// Swagger Documentation
swaggerSetup(app);

// Ghi lượt truy cập mỗi request tới /api (để thống kê hàng tháng)
app.use('/api', accessLogMiddleware);

const { authenticate } = require('./middleware/auth');

// ==========================================
// 1. KHỐI PUBLIC (Không yêu cầu Token)
// ==========================================
app.use('/api/auth', authRoutes);
app.use('/api', telegramRoutes); // Webhook không dùng JWT
// uploadRoutes có thể chứa GET /api/uploads/:filename nếu có, nhưng thường upload tĩnh được phục vụ ở trên. 
// Nếu upload cũng cần bảo mật (chỉ cho phép đăng ảnh khi đã đăng nhập) thì đẩy xuống dưới.
// Tạm thời đưa uploadRoutes xuống Protected block vì hành động tải file lên nên cần xác thực.

// ==========================================
// 2. MIDDLEWARE XÁC THỰC TOÀN CỤC
// ==========================================
// Bất kỳ request nào đi qua dòng này mà không có token hợp lệ đều bị chặn (401)
app.use('/api', authenticate);

// ==========================================
// 3. KHỐI PROTECTED (Yêu cầu Token)
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






