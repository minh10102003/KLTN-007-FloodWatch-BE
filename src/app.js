const express = require('express');
const cors = require('cors');
const floodRoutes = require('./routes/floodRoutes');
const crowdReportRoutes = require('./routes/crowdReportRoutes');
const sensorRoutes = require('./routes/sensorRoutes');

const app = express();

// Middleware
app.use(cors()); // Cho phép FE và BE chạy trên các cổng khác nhau
app.use(express.json()); // Cho phép Backend đọc dữ liệu JSON từ trình duyệt gửi lên
app.use(express.static('public')); // Cấu hình để phục vụ file tĩnh từ thư mục public

// Routes
app.use('/api', floodRoutes);
app.use('/api', crowdReportRoutes);
app.use('/api', sensorRoutes);

module.exports = app;


